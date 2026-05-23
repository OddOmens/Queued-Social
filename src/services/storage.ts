import { supabase } from '@/lib/supabase';
import { v4 as uuidv4 } from 'uuid';

const BUCKET_NAME = 'media-files'; // Legacy bucket
const R2_BUCKET_NAME = 'queued-social';

export interface UploadResult {
    path: string;
    publicUrl: string;
    filename: string;
    type: string;
    provider: 'supabase' | 'r2';
}

export async function uploadMedia(file: File, userId: string): Promise<UploadResult> {
    // Compress image if it's an image file
    let fileToUpload = file;
    if (file.type.startsWith('image/')) {
        try {
            fileToUpload = await compressImage(file);
            console.log(`compressed ${file.name}: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(fileToUpload.size / 1024 / 1024).toFixed(2)}MB`);
        } catch (e) {
            console.warn('Image compression failed, uploading original', e);
        }
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${uuidv4()}.${fileExt}`;

    // Try R2 Upload first
    try {
        console.log('Attempting upload to Cloudflare R2...');
        const { data, error } = await supabase.functions.invoke('upload-media', {
            body: {
                action: 'upload',
                filename: fileName,
                fileType: fileToUpload.type,
                userId: userId
            }
        });

        if (error) throw error;
        if (!data?.signedUrl) throw new Error('No signed URL returned from upload-media function');

        // Upload to R2
        const upload = await fetch(data.signedUrl, {
            method: 'PUT',
            body: fileToUpload,
            headers: {
                'Content-Type': fileToUpload.type
            }
        });

        if (!upload.ok) {
            throw new Error(`R2 Upload failed: ${upload.statusText}`);
        }

        const r2Path = data.key; // e.g., "userId/filename.jpg"

        // Insert into media_files
        const { data: dbData, error: dbError } = await supabase.from('media_files').insert({
            user_id: userId,
            filename: fileName,
            original_filename: file.name,
            file_path: r2Path,
            file_size: fileToUpload.size,
            mime_type: fileToUpload.type,
            storage_bucket: R2_BUCKET_NAME,
            metadata: { provider: 'r2' }
        }).select().single();

        if (dbError) throw dbError;

        console.log('✅ Uploaded to R2 successfully');

        return {
            path: r2Path,
            // Use the edge function to get a viewable URL later, or construct a public one if configured. 
            // For now we return the path which will be resolved to a signed URL by getSignedUrl
            publicUrl: `r2://${R2_BUCKET_NAME}/${r2Path}`,
            filename: file.name,
            type: file.type,
            provider: 'r2'
        };

    } catch (r2Error) {
        console.warn('⚠️ R2 Upload failed, falling back to Supabase Storage...', r2Error);
        // Fallback to Supabase Storage (Legacy Code)
        const filePath = `${userId}/${fileName}`;

        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .upload(filePath, fileToUpload);

        if (error) {
            if (error.message.includes('Bucket not found')) {
                throw new Error('Storage bucket not found. Please contact admin.');
            }
            throw error;
        }

        const { data: urlData } = supabase.storage
            .from(BUCKET_NAME)
            .getPublicUrl(filePath);

        // Record in DB
        await supabase.from('media_files').insert({
            user_id: userId,
            filename: fileName,
            original_filename: file.name,
            file_path: filePath,
            file_size: fileToUpload.size,
            mime_type: fileToUpload.type,
            storage_bucket: BUCKET_NAME,
            metadata: { provider: 'supabase' }
        });

        return {
            path: filePath,
            publicUrl: urlData.publicUrl,
            filename: file.name,
            type: file.type,
            provider: 'supabase'
        };
    }
}

// Module-level cache: avoids redundant edge function calls for the same path.
// Each entry expires 5 minutes before the actual URL expiry.
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// Domains we own — anything else is a third-party CDN URL we can't refresh.
const OWNED_DOMAINS = ['supabase.co', 'r2.cloudflarestorage.com'];

function isExternalUrl(path: string): boolean {
    if (!path.startsWith('http')) return false;
    if (path.startsWith('r2://')) return false;
    return !OWNED_DOMAINS.some(d => path.includes(d));
}

export async function getSignedUrl(path: string, expiresIn: number = 3600): Promise<string | null> {
    if (!path) return null;

    // External CDN URLs (e.g. Instagram) cannot be refreshed — return null so
    // the caller can show a placeholder instead of looping on 403s.
    if (isExternalUrl(path)) return null;

    // Return cached URL if still valid.
    const cached = signedUrlCache.get(path);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    let result: string | null = null;

    // ── R2 path ──────────────────────────────────────────────────────────────
    if (path.startsWith('r2://') || path.includes(R2_BUCKET_NAME)) {
        let key = path;

        if (path.startsWith('r2://')) {
            const parts = path.split(`${R2_BUCKET_NAME}/`);
            if (parts.length > 1) key = parts[1];
        } else if (path.includes('r2.cloudflarestorage.com')) {
            const parts = path.split('.r2.cloudflarestorage.com/');
            if (parts.length > 1) key = parts[1];
        }

        if (key.includes('?')) key = key.split('?')[0];
        key = key.replace(/^\/+/, '');

        try {
            const { data, error } = await supabase.functions.invoke('upload-media', {
                body: { action: 'get', key }
            });
            if (!error && data?.signedUrl) result = data.signedUrl;
        } catch (e) {
            console.error('getSignedUrl: R2 invocation failed', e);
        }

    // ── Supabase Storage path ─────────────────────────────────────────────────
    } else {
        let relativePath = path;
        if (path.startsWith('http')) {
            const match = path.match(new RegExp(`(?:object\\/sign\\/|object\\/public\\/)?${BUCKET_NAME}\\/(.+)$`));
            if (!match) return null; // Can't parse — treat as unresolvable
            relativePath = match[1];
        }
        if (relativePath.includes('?')) relativePath = relativePath.split('?')[0];

        const { data, error } = await supabase.storage
            .from(BUCKET_NAME)
            .createSignedUrl(relativePath, expiresIn);

        if (!error && data?.signedUrl) {
            result = data.signedUrl;
        } else {
            // Fallback: try R2 in case file was migrated
            try {
                const { data: r2Data, error: r2Error } = await supabase.functions.invoke('upload-media', {
                    body: { action: 'get', key: relativePath }
                });
                if (!r2Error && r2Data?.signedUrl) result = r2Data.signedUrl;
            } catch (e) {
                console.error('getSignedUrl: R2 fallback failed', e);
            }
        }
    }

    if (result) {
        // Cache for (expiresIn - 5 min) to avoid using nearly-expired URLs
        signedUrlCache.set(path, { url: result, expiresAt: Date.now() + (expiresIn - 300) * 1000 });
    }

    return result;
}

export async function syncWithR2(userId: string): Promise<void> {
    console.log('🔄 Syncing Media Library with R2...');
    try {
        const { data, error } = await supabase.functions.invoke('upload-media', {
            body: {
                action: 'list',
                limit: 100 // Fetch up to 100 items for sync
            }
        });

        if (error) throw error;
        if (!data?.files) return;

        const r2Files = data.files.filter((f: any) => f.key.startsWith(`${userId}/`));
        console.log(`  → Found ${r2Files.length} files in R2 for user`);

        // Get existing files from DB
        const { data: dbFiles } = await supabase
            .from('media_files')
            .select('file_path')
            .eq('user_id', userId);

        const existingPaths = new Set(dbFiles?.map(f => f.file_path) || []);

        const newFiles = r2Files.filter((f: any) => !existingPaths.has(f.key));

        if (newFiles.length === 0) {
            console.log('  → No new files to sync');
            return;
        }

        console.log(`  → Found ${newFiles.length} new files to insert into DB`);

        const inserts = newFiles.map((f: any) => {
            const filename = f.key.split('/').pop() || 'unknown';
            const ext = filename.split('.').pop();
            return {
                user_id: userId,
                filename: filename,
                original_filename: filename, // Best guess since we lost original name
                file_path: f.key,
                file_size: f.size,
                mime_type: ext ? `image/${ext === 'png' ? 'png' : 'jpeg'}` : 'application/octet-stream', // Rudimentary mime type guess
                storage_bucket: R2_BUCKET_NAME,
                metadata: { provider: 'r2', synced_at: new Date().toISOString() }
            };
        });

        const { error: insertError } = await supabase.from('media_files').insert(inserts);
        if (insertError) console.error('Error syncing files to DB:', insertError);
        else console.log('✅ Successfully synced R2 files to DB');

    } catch (e) {
        console.error('Failed to sync with R2:', e);
    }
}

export async function getMediaLibrary(userId: string, limit = 50) {
    let { data, error } = await supabase
        .from('media_files')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

    if (error) throw error;

    // Auto-sync if empty (or very few items compared to what user might expect)
    // To avoid aggressive syncing, we could only do it if count is 0
    if (!data || data.length === 0) {
        await syncWithR2(userId);

        // Fetch again
        const { data: retryData, error: retryError } = await supabase
            .from('media_files')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (!retryError) data = retryData;
    }

    return data;
}

export async function deleteMedia(fileId: string, filePath: string): Promise<void> {
    // First, get the file info to determine storage provider
    const { data: fileInfo, error: fetchError } = await supabase
        .from('media_files')
        .select('*')
        .eq('id', fileId)
        .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    if (fileInfo.storage_bucket === R2_BUCKET_NAME) {
        // Delete from R2
        try {
            const { error } = await supabase.functions.invoke('upload-media', {
                body: {
                    action: 'delete',
                    key: filePath
                }
            });

            if (error) throw error;
        } catch (e) {
            console.error('Error deleting from R2:', e);
            throw new Error('Failed to delete file from R2 storage');
        }
    } else {
        // Delete from Supabase Storage
        const { error } = await supabase.storage
            .from(BUCKET_NAME)
            .remove([filePath]);

        if (error) throw error;
    }

    // Delete from database
    const { error: dbError } = await supabase
        .from('media_files')
        .delete()
        .eq('id', fileId);

    if (dbError) throw dbError;
}

export async function prepareMediaUrlsForPublishing(mediaUrls: string[]): Promise<string[]> {
    if (!mediaUrls || mediaUrls.length === 0) return [];

    console.log(`🔍 Preparing ${mediaUrls.length} media URLs for publishing...`);
    const processedUrls: string[] = [];
    const errors: string[] = [];

    for (let i = 0; i < mediaUrls.length; i++) {
        const url = mediaUrls[i];
        try {
            console.log(`  [${i + 1}/${mediaUrls.length}] Processing: ${url.substring(0, 80)}...`);

            // If it's a Supabase storage URL, try to get a fresh signed URL
            if ((url.includes('supabase.co/storage') && url.includes(BUCKET_NAME)) || url.startsWith('r2://') || url.includes(R2_BUCKET_NAME) || (!url.startsWith('http') && !url.startsWith('blob:'))) {
                // Should use getSignedUrl to handle both
                try {
                    const signedUrl = await getSignedUrl(url, 86400); // 24 hours
                    if (signedUrl) {
                        // We skip the HEAD request validation here because browser CORS policies often block
                        // requests to R2/S3 buckets even if the URL is valid for the backend or social platforms.
                        processedUrls.push(signedUrl);
                        console.log(`    ✅ URL generated successfully`);
                    } else {
                        const errorMsg = `Could not generate signed URL for: ${url}`;
                        errors.push(errorMsg);
                    }
                } catch (e) {
                    errors.push(`Error resolving signed URL: ${e}`);
                }

                // Old logic for validation is mostly superseded by getSignedUrl check, 
                // but let's break here to avoid the old code running.
                continue;
            }

            // External URL or already processed - verify it's accessible
            console.log(`    → External URL, verifying accessibility...`);
            try {
                const testResponse = await fetch(url, { method: 'HEAD' });
                if (testResponse.ok) {
                    processedUrls.push(url);
                    console.log(`    ✅ External URL accessible`);
                } else {
                    const errorMsg = `External URL not accessible (HTTP ${testResponse.status})`;
                    console.error(`    ❌ ${errorMsg}`);
                    errors.push(errorMsg);
                }
            } catch (fetchError) {
                const errorMsg = `Network error accessing external URL`;
                console.error(`    ❌ ${errorMsg}`, fetchError);
                errors.push(errorMsg);
            }
        } catch (error) {
            const errorMsg = `Error processing media URL: ${error instanceof Error ? error.message : String(error)}`;
            console.error(`    ❌ ${errorMsg}`, error);
            errors.push(errorMsg);
        }
    }

    if (errors.length > 0) {
        console.error(`❌ Failed to prepare ${errors.length} media URL(s):`, errors);
        throw new Error(`Failed to load ${errors.length} media file(s). ${errors[0]}`);
    }

    console.log(`✅ Successfully prepared ${processedUrls.length} media URLs`);
    return processedUrls;
}

/**
 * Compresses an image file using HTML Canvas
 * - Max dimension: 1920px
 * - Quality: 0.8
 * - Format: JPEG
 */
async function compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                URL.revokeObjectURL(img.src);
                return reject(new Error('Canvas context not available'));
            }

            // Calculate new dimensions (max 1920px)
            let width = img.width;
            let height = img.height;
            const maxDim = 1920;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
                URL.revokeObjectURL(img.src);
                if (blob) {
                    const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
                        type: 'image/jpeg',
                        lastModified: Date.now(),
                    });
                    resolve(newFile);
                } else {
                    reject(new Error('Canvas toBlob failed'));
                }
            }, 'image/jpeg', 0.8);
        };
        img.onerror = (e) => {
            URL.revokeObjectURL(img.src);
            reject(e);
        };
    });
}

