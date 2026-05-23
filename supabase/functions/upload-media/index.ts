import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { S3Client } from 'https://deno.land/x/s3_lite_client@0.6.1/mod.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        // 2. Load Env Vars
        const R2_ACCOUNT_ID = Deno.env.get('R2_ACCOUNT_ID')
        const R2_ACCESS_KEY_ID = Deno.env.get('R2_ACCESS_KEY_ID')
        const R2_SECRET_ACCESS_KEY = Deno.env.get('R2_SECRET_ACCESS_KEY')
        const BUCKET_NAME = Deno.env.get('R2_BUCKET_NAME') || 'queued-social'

        if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
            throw new Error('Server configuration error: Missing R2 credentials')
        }

        // 3. Initialize S3 Lite Client (Deno native)
        const s3 = new S3Client({
            endPoint: `${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            port: 443,
            useSSL: true,
            region: 'auto',
            accessKey: R2_ACCESS_KEY_ID,
            secretKey: R2_SECRET_ACCESS_KEY,
            bucket: BUCKET_NAME,
            pathStyle: false
        })

        // 4. Parse Body
        let body;
        try {
            body = await req.json();
        } catch (e) {
            throw new Error('Invalid JSON body');
        }

        const { action, filename, fileType, userId, key } = body;

        // 5. Handle Actions
        if (action === 'upload') {
            if (!filename || !fileType || !userId) {
                throw new Error('Missing upload fields');
            }

            const objectKey = `${userId}/${filename}`

            // Generate Presigned URL for PUT
            const signedUrl = await s3.getPresignedUrl('PUT', objectKey, {
                expirySeconds: 3600,
            })

            return new Response(JSON.stringify({
                signedUrl,
                key: objectKey,
                bucket: BUCKET_NAME
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })

        } else if (action === 'get') {
            if (!key) {
                throw new Error('Missing get key');
            }

            // Sanitize key server-side as a failsafe
            let cleanKey = key;
            try {
                // If it looks like a URL, try to extract validity
                if (cleanKey.match(/^https?:\/\//) || cleanKey.includes('cloudflarestorage')) {
                    // Try to remove standard R2 prefix
                    // Expected format: https://<account>.r2.cloudflarestorage.com/<bucket>/<key>
                    // OR https://<custom_domain>/<key>

                    // 1. naive remove protocol
                    cleanKey = cleanKey.replace(/^https?:\/\//, '');

                    // 2. remove domain parts if they exist

                    // Handle full R2 URLs by splitting on the domain
                    if (cleanKey.includes('.r2.cloudflarestorage.com/')) {
                        const parts = cleanKey.split('.r2.cloudflarestorage.com/');
                        if (parts.length > 1) {
                            cleanKey = parts[1];
                        }
                    }
                    // Fallback for custom domains or other formats checking for bucket path
                    else {
                        const bucketToken = `/${BUCKET_NAME}/`;
                        if (cleanKey.includes(bucketToken)) {
                            cleanKey = cleanKey.split(bucketToken)[1];
                        } else {
                            // Last resort fallback: look for the first slash
                            const firstSlash = cleanKey.indexOf('/');
                            if (firstSlash !== -1) {
                                const potentialKey = cleanKey.substring(firstSlash + 1);
                                cleanKey = potentialKey;
                            }
                        }
                    }

                    // 3. Remove query parameters (critical for signed URLs passed as keys)
                    if (cleanKey.includes('?')) {
                        cleanKey = cleanKey.split('?')[0];
                    }
                }
            } catch (kErr) {
                console.warn('Key sanitization failed, using original', kErr);
            }

            // Generate Presigned URL for GET
            const signedUrl = await s3.getPresignedUrl('GET', cleanKey, {
                expirySeconds: 86400, // 24h
            })

            return new Response(JSON.stringify({
                signedUrl
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        } else if (action === 'list') {
            const limit = body.limit || 50;
            const cursor = body.cursor; // Continuation token if supported by s3 client wrapper, mostly handling basic list here

            // List objects from R2
            // s3_lite_client listObjects returns an async iterator or list? 
            // Checking docs or assuming standard behavior: usually returns list of objects.
            // library: https://deno.land/x/s3_lite_client@0.6.1/mod.ts
            // listObjects(options?: { prefix?: string, delimiter?: string, continuationToken?: string, maxKeys?: number })

            const result = await s3.listObjects({
                maxKeys: limit,
                continuationToken: cursor
            });

            // Result usually contains .contents which is array of objects
            const files = (result.contents || []).map((item: any) => ({
                key: item.key,
                size: item.size,
                lastModified: item.lastModified,
                etag: item.etag
            }));

            return new Response(JSON.stringify({
                files,
                truncated: result.isTruncated,
                nextCursor: result.nextContinuationToken
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        } else if (action === 'delete') {
            if (!key) {
                throw new Error('Missing delete key');
            }

            // Sanitize key (same as get)
            let cleanKey = key;
            try {
                if (cleanKey.match(/^https?:\/\//) || cleanKey.includes('cloudflarestorage')) {
                    cleanKey = cleanKey.replace(/^https?:\/\//, '');
                    const bucketToken = `/${BUCKET_NAME}/`;
                    if (cleanKey.includes(bucketToken)) {
                        cleanKey = cleanKey.split(bucketToken)[1];
                    } else {
                        const firstSlash = cleanKey.indexOf('/');
                        if (firstSlash !== -1) {
                            cleanKey = cleanKey.substring(firstSlash + 1);
                        }
                    }
                }
            } catch (kErr) {
                console.warn('Key sanitization failed for delete, using original', kErr);
            }

            // Delete the object from R2
            await s3.deleteObject(cleanKey);

            return new Response(JSON.stringify({
                success: true,
                message: 'File deleted successfully'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        throw new Error(`Invalid action: ${action}`)

    } catch (error: any) {
        console.error('Edge Function Error:', error);
        return new Response(JSON.stringify({
            error: error.message
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        })
    }
})
