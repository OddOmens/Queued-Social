import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { ImagePlus, Calendar as CalendarIcon, Send, Save, Loader2, X, FileText, Trash2, Plus, LayoutTemplate, Edit, Layers, Repeat, Clock, MessageCircle, Image as ImageIcon, Sparkles, CheckCircle2, Info, PartyPopper, ArrowRight, PenLine } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Post } from '@/types/data';
import * as postsService from '@/services/posts';
import { getTemplates, createTemplate, getFirstThreads, createFirstThread } from '@/services/posts';
import * as storageService from '@/services/storage';
import { getSignedUrl } from '@/services/storage';
import * as credentialsService from '@/services/credentials';
import * as publishService from '@/services/publish';
import * as analyticsService from '@/services/analytics';
import { BestTimeSlot, getBestTimeForDay } from '@/services/analytics';


const PostThumbnail = ({ src, className, style }: { src: string, className?: string, style?: React.CSSProperties }) => {
    const [imgSrc, setImgSrc] = useState(src?.startsWith('r2://') ? '' : src);
    const [failed, setFailed] = useState(false);
    const retriedRef = useRef(false);

    // Proactively resolve R2 URLs
    useEffect(() => {
        retriedRef.current = false;
        if (src?.startsWith('r2://')) {
            getSignedUrl(src).then(signed => {
                if (signed) setImgSrc(signed);
                else setFailed(true);
            }).catch(() => setFailed(true));
        } else {
            setImgSrc(src);
            setFailed(false);
        }
    }, [src]);

    const handleError = () => {
        if (!src || src.startsWith('blob:') || src.startsWith('r2://')) return;
        if (retriedRef.current || failed) {
            setFailed(true);
            return;
        }
        retriedRef.current = true;
        getSignedUrl(src).then(signed => {
            if (signed) setImgSrc(signed);
            else setFailed(true);
        }).catch(() => setFailed(true));
    };

    if (failed) {
        return (
            <div className={className} style={{ ...style, backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ImagePlus className="h-8 w-8 text-gray-400" />
            </div>
        );
    }

    // Don't render img tag until we have a potentially valid src (avoids broken image icon)
    if (!imgSrc) {
        return (
            <div className={className} style={{ ...style, backgroundColor: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
        );
    }

    return <img src={imgSrc} onError={handleError} className={className} style={style} />;
};

export default function PublishPage() {
    const [content, setContent] = useState('');
    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    const [mediaFiles, setMediaFiles] = useState<File[]>([]);
    const [uploadedMedia, setUploadedMedia] = useState<{ url: string, type: string }[]>([]);
    const [firstComment, setFirstComment] = useState('');
    const [useRandomComment, setUseRandomComment] = useState(false);
    const [commentFolder, setCommentFolder] = useState('');
    const [availableCommentFolders, setAvailableCommentFolders] = useState<string[]>([]);
    const [commentTemplates, setCommentTemplates] = useState<any[]>([]);
    const [isSavingComment, setIsSavingComment] = useState(false);

    // Save Comment Modal State
    const [isSaveCommentModalOpen, setIsSaveCommentModalOpen] = useState(false);
    const [newCommentName, setNewCommentName] = useState('');
    const [newCommentFolder, setNewCommentFolder] = useState('');

    const [scheduledDate, setScheduledDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [draftId, setDraftId] = useState<string | null>(null);
    const [platformAccounts, setPlatformAccounts] = useState<any[]>([]);
    const [recentPosts, setRecentPosts] = useState<any[]>([]); // Keep simply to avoid breaking if used elsewhere, but we won't show it.

    // Derived active platforms for UI
    const activePlatforms = Array.from(new Set(
        selectedAccountIds.map(id => platformAccounts.find(a => a.id === id)?.platform).filter(Boolean)
    ));

    // Bulk & Recurring State
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [bulkPostsPerDay, setBulkPostsPerDay] = useState(1);
    const [bulkTimeFrames, setBulkTimeFrames] = useState<{ start: string, end: string }[]>([{ start: '09:00', end: '17:00' }]);
    const [bulkSchedulingMode, setBulkSchedulingMode] = useState<'consecutive' | 'custom-days'>('consecutive');
    const [bulkCustomDays, setBulkCustomDays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']); // Default to weekdays

    const [isRecurring, setIsRecurring] = useState(false);
    const [recurringDays, setRecurringDays] = useState<string[]>([]); // ['Sun', 'Mon', ...]
    const [recurringTimeWindow, setRecurringTimeWindow] = useState({ start: '09:00', end: '17:00' });
    const [recurringCount, setRecurringCount] = useState(1);

    const [loadingPublish, setLoadingPublish] = useState(false);
    const [previewPlatform, setPreviewPlatform] = useState<'linkedin' | 'instagram' | 'threads' | 'all'>('linkedin');
    const [isLibraryOpen, setIsLibraryOpen] = useState<boolean | 'media' | 'comments'>(false);

    // Shared image feature for bulk/recurring posts
    const [useSharedImage, setUseSharedImage] = useState(false);
    const [useSequentialImages, setUseSequentialImages] = useState(false);
    const [useRandomImage, setUseRandomImage] = useState(false);
    const [bulkMediaOverrides, setBulkMediaOverrides] = useState<Record<number, number | null>>({});

    // Analytics state for time suggestions
    const [bestTimeSlots, setBestTimeSlots] = useState<BestTimeSlot[]>([]);
    const [useBestTimesBulk, setUseBestTimesBulk] = useState(true); // Default to true as user requested "it should try to post based on best times"

    // Success state — shown after scheduling completes
    const [publishResult, setPublishResult] = useState<{ count: number; firstDate: Date | null; isDraft: boolean } | null>(null);

    // Helper to render text with character limit highlighting
    const renderPreviewText = (text: string, limit: number) => {
        if (!text) return <span className="text-gray-400 italic">Start typing...</span>;

        const safeText = text || '';
        const isOver = safeText.length > limit;

        return (
            <div className="relative">
                <span className="whitespace-pre-wrap">
                    {safeText.slice(0, limit)}
                    {isOver && (
                        <span className="bg-red-100 text-red-600 decoration-red-500 decoration-wavy underline">
                            {safeText.slice(limit)}
                        </span>
                    )}
                </span>
                <div className={`text-[10px] font-mono mt-1 text-right ${isOver ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                    {safeText.length}/{limit}
                </div>
            </div>
        );
    };

    // Validation Logic
    const isContentValid = () => {
        if (!content.trim()) return false;

        const platforms = Array.from(new Set(
            selectedAccountIds.map(id => platformAccounts.find(a => a.id === id)?.platform).filter(Boolean)
        ));

        if (platforms.length === 0) return false;

        const messages = isBulkMode ? content.split('---').map(c => c.trim()).filter(c => c) : [content];
        if (messages.length === 0) return false;

        const limits: Record<string, number> = { linkedin: 3000, instagram: 2200, threads: 500 };

        for (const msg of messages) {
            for (const p of platforms) {
                // @ts-ignore
                if (msg.length > (limits[p] || 3000)) return false;
            }
        }
        return true;
    };

    const isValid = isContentValid();

    // Template State
    const [templates, setTemplates] = useState<any[]>([]);
    const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [editingTemplate, setEditingTemplate] = useState<any>(null);
    const [loadingTemplates, setLoadingTemplates] = useState(false);

    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // Load available accounts and templates
    useEffect(() => {
        if (!user) return;
        credentialsService.getConnectedPlatforms(user.id).then(setPlatformAccounts).catch(console.error);
        loadTemplates();
        analyticsService.getBestPostingTimes(user.id).then(setBestTimeSlots).catch(console.error);
    }, [user]);

    const loadTemplates = async () => {
        setLoadingTemplates(true);
        try {
            const data = await postsService.getTemplates();
            setTemplates(data || []);
        } catch (e) {
            console.error('Failed to load templates', e);
        } finally {
            setLoadingTemplates(false);
        }
    };

    // Load Draft, Template, or Existing Post (Edit Mode)
    useEffect(() => {
        const draftParam = searchParams.get('draft');
        const templateParam = searchParams.get('template');
        const editParam = searchParams.get('edit');
        const hookParam = searchParams.get('hook');

        const loadData = async () => {
            if (draftParam || editParam) {
                const targetId = draftParam || editParam;
                setLoading(true);
                try {
                    const { data } = await supabase.from('scheduled_posts').select('*').eq('id', targetId).single();
                    if (data) {
                        setDraftId(data.id);
                        setContent(data.content?.text || '');

                        // Try to match specific account first, then fallback to platform match
                        let internalIdToSelect: string | undefined;
                        if (data.platform_account_id) {
                            // Find the internal credential ID for this platform account ID
                            const matchingCred = platformAccounts.find(p => p.platformAccountId === data.platform_account_id);
                            if (matchingCred) internalIdToSelect = matchingCred.id;
                        }

                        // Fallback: if no specific account ID in draft, or account not found, try to select ALL accounts of that platform? 
                        // Or just the first one? Let's just try to find based on platform if specific account search failed.
                        if (!internalIdToSelect) {
                            const matchingCred = platformAccounts.find(p => p.platform === data.platform);
                            if (matchingCred) internalIdToSelect = matchingCred.id;
                        }

                        if (internalIdToSelect) {
                            setSelectedAccountIds([internalIdToSelect]);
                        } else {
                            // If we still can't find a matching account, maybe we just don't select any
                            // or we wait until accounts are loaded. 
                            // Note: platformAccounts might be empty on first render.
                        }

                        if (data.scheduled_time) {
                            const d = new Date(data.scheduled_time);
                            const offset = d.getTimezoneOffset() * 60000;
                            const localISOTime = (new Date(d.getTime() - offset)).toISOString().slice(0, 16);
                            setScheduledDate(localISOTime);
                        } else {
                            setScheduledDate('');
                        }
                        if (data.content?.mediaUrls) {
                            setUploadedMedia(data.content.mediaUrls.map((url: string) => ({ url, type: 'image' })));
                        }
                        if (data.content?.firstComment) {
                            setFirstComment(data.content.firstComment);
                        } else {
                            setFirstComment('');
                        }
                        if (data.content?.meta) {
                            const m = data.content.meta;

                            // Restore original media pool if available (for random image mode)
                            if (m.originalMediaUrls && Array.isArray(m.originalMediaUrls)) {
                                setUploadedMedia(m.originalMediaUrls.map((url: string) => ({ url, type: 'image' })));
                            }

                            setIsBulkMode(!!m.isBulkMode);
                            if (m.bulkPostsPerDay) setBulkPostsPerDay(m.bulkPostsPerDay);
                            if (m.bulkTimeFrames) setBulkTimeFrames(m.bulkTimeFrames);
                            if (m.useSequentialImages) setUseSequentialImages(m.useSequentialImages);
                            if (m.useRandomImage) setUseRandomImage(m.useRandomImage);

                            setIsRecurring(!!m.isRecurring);
                            if (m.recurringDays) setRecurringDays(m.recurringDays);
                            if (m.recurringTimeWindow) setRecurringTimeWindow(m.recurringTimeWindow);
                            if (m.recurringCount) setRecurringCount(m.recurringCount);
                        }
                    }
                } catch (err) {
                    console.error('Failed to load post', err);
                } finally {
                    setLoading(false);
                }
            } else if (templateParam) {
                const loadTemplate = async () => {
                    setLoading(true);
                    try {
                        let templateData = templates.find(t => t.id === templateParam);

                        // If not found in state (e.g. direct nav), try service which returns combined list
                        if (!templateData) {
                            const allTemplates = await postsService.getTemplates();
                            templateData = allTemplates.find(t => t.id === templateParam);
                        }

                        if (templateData) {
                            setContent(templateData.content?.text || '');
                            if (templateData.platform) {
                                const matchingCred = platformAccounts.find(p => p.platform === templateData.platform);
                                if (matchingCred) setSelectedAccountIds([matchingCred.id]);
                            }
                        } else {
                            // Fallback to direct DB query only if strict UUID (though system ones are handled above)
                            const { data } = await supabase.from('post_templates').select('*').eq('id', templateParam).single();
                            if (data) {
                                setContent(data.content?.text || '');
                                const matchingCred = platformAccounts.find(p => p.platform === data.platform);
                                if (matchingCred) setSelectedAccountIds([matchingCred.id]);
                            }
                        }
                    } catch (err) {
                        console.error('Failed to load template', err);
                    } finally {
                        setLoading(false);
                    }
                };
                loadTemplate();
            } else if (hookParam) {
                const loadHook = async () => {
                    setLoading(true);
                    try {
                        const { data, error } = await supabase.from('first_threads').select('*').eq('id', hookParam).single();
                        if (error) throw error;
                        if (data) {
                            // Combine hook_text and first_comment into a single post
                            // (Threads API reply_to_id supported with manage_replies scope)
                            let combinedText = data.hook_text || '';
                            // Don't combine, set as first comment
                            setContent(combinedText);
                            setFirstComment(data.first_comment || '');

                            // Select Threads account if available
                            const threadsAccount = platformAccounts.find(p => p.platform === 'threads');
                            if (threadsAccount) setSelectedAccountIds([threadsAccount.id]);

                            // Load media if any
                            if (data.media_urls && data.media_urls.length > 0) {
                                setUploadedMedia(data.media_urls.map((url: string) => ({ url, type: 'image' })));
                            }
                        }
                    } catch (err) {
                        console.error('Failed to load hook', err);
                    } finally {
                        setLoading(false);
                    }
                };
                loadHook();
            }
        }

        // Only run if accounts are loaded so we can match
        if (platformAccounts.length > 0) {
            loadData();
        }
    }, [searchParams, platformAccounts]);

    // Auto-switch preview platform if the current one is no longer available
    useEffect(() => {
        const currentActive = Array.from(new Set(
            selectedAccountIds.map(id => platformAccounts.find(a => a.id === id)?.platform).filter(Boolean)
        ));
        if (currentActive.length > 0 && previewPlatform !== 'all' && !currentActive.includes(previewPlatform)) {
            setPreviewPlatform(currentActive[0] as any);
        }
    }, [selectedAccountIds, platformAccounts, previewPlatform]);

    const toggleAccount = (accountId: string) => {
        setSelectedAccountIds(prev =>
            prev.includes(accountId)
                ? prev.filter(id => id !== accountId)
                : [...prev, accountId]
        );
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setMediaFiles(Array.from(e.target.files));
        }
    };

    // File Preview Effect
    const [filePreviews, setFilePreviews] = useState<string[]>([]);
    useEffect(() => {
        if (mediaFiles.length === 0) {
            setFilePreviews([]);
            return;
        }
        const newPreviews = mediaFiles.map(file => URL.createObjectURL(file));
        setFilePreviews(newPreviews);
        return () => newPreviews.forEach(url => URL.revokeObjectURL(url));
    }, [mediaFiles]);

    // Template Handlers
    useEffect(() => {
        // Fetch comment templates for dropdowns
        getFirstThreads().then(threads => {
            // We consider all saved threads as potential "First Comment" sources
            setCommentTemplates(threads);
            const folders = Array.from(new Set(threads.map(t => t.category))).filter(Boolean);
            setAvailableCommentFolders(folders);
        });
    }, []);

    const handleOpenSaveCommentModal = () => {
        if (!firstComment) return;
        setNewCommentName('My Comment');
        setNewCommentFolder('General');
        setIsSaveCommentModalOpen(true);
    };

    const handleConfirmSaveComment = async () => {
        if (!newCommentName || !newCommentFolder) return alert('Name and Folder are required');

        setIsSavingComment(true);
        try {
            await createFirstThread({
                name: newCommentName,
                category: newCommentFolder,
                hookText: '', // It's just a comment template, so hook implies main post which we ignore for this use case
                firstComment: firstComment
            });
            alert('Comment saved to library!');

            // Refresh
            const threads = await getFirstThreads();
            setCommentTemplates(threads);
            const folders = Array.from(new Set(threads.map(t => t.category))).filter(Boolean);
            setAvailableCommentFolders(folders);

            setIsSaveCommentModalOpen(false);
        } catch (e: any) {
            console.error(e);
            alert('Failed to save comment');
        } finally {
            setIsSavingComment(false);
        }
    };

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) return alert('Please enter a template name');
        if (!content && mediaFiles.length === 0 && uploadedMedia.length === 0) return alert('Template must have some content');

        // Determine platform from selected accounts (just grab the first one's platform)
        let templatePlatform = 'linkedin';
        if (selectedAccountIds.length > 0) {
            const acc = platformAccounts.find(a => a.id === selectedAccountIds[0]);
            if (acc) templatePlatform = acc.platform;
        }

        try {
            if (editingTemplate) {
                // Update existing
                await postsService.updateTemplate(editingTemplate.id, {
                    name: newTemplateName,
                    content: {
                        text: content,
                        type: mediaFiles.length > 0 || uploadedMedia.length > 0 ? 'media' : 'single',
                        mediaUrls: uploadedMedia.map(m => m.url)
                    },
                    platform: templatePlatform as any,
                    category: 'saved'
                });
                alert('Template updated!');
            } else {
                // Create new
                await postsService.createTemplate({
                    name: newTemplateName,
                    content: {
                        text: content,
                        type: mediaFiles.length > 0 || uploadedMedia.length > 0 ? 'media' : 'single',
                        mediaUrls: uploadedMedia.map(m => m.url)
                    },
                    platform: templatePlatform as any,
                    category: 'saved'
                });
                alert('Template saved!');
            }

            setNewTemplateName('');
            setEditingTemplate(null);
            loadTemplates();
        } catch (e: any) {
            console.error(e);
            alert('Failed to save template: ' + e.message);
        }
    };

    const handleLoadTemplate = (template: any) => {
        if (!confirm('This will overwrite current content. Continue?')) return;
        setContent(template.content?.text || '');
        if (template.platform) {
            const matchingCred = platformAccounts.find(p => p.platform === template.platform);
            if (matchingCred) setSelectedAccountIds([matchingCred.id]);
        }
        if (template.content?.mediaUrls) {
            setUploadedMedia(template.content.mediaUrls.map((url: string) => ({ url, type: 'image' })));
        }
        setIsTemplateModalOpen(false);
    };

    const handleDeleteTemplate = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Delete this template?')) return;
        try {
            await postsService.deleteTemplate(id);
            if (editingTemplate?.id === id) {
                handleCancelEdit();
            }
            loadTemplates();
        } catch (e) {
            console.error(e);
        }
    };

    const handleEditTemplate = (template: any, e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingTemplate(template);
        setNewTemplateName(template.name);
        // Note: We do NOT load the content automatically into the editor when clicking Edit.
        // The user should have the content they want in the editor, or they should load it first, then click edit?
        // Actually, usually "Editing" a template implies modifying ITS content.
        // So we probably SHOULD load its content into the editor if the editor is empty, or warn.
        // But for now, let's assume the user uses the current editor state to update the template.
        // A better UX might be: Load template -> Edit text -> Click Update.
    };

    const handleCancelEdit = () => {
        setEditingTemplate(null);
        setNewTemplateName('');
    };


    const handlePublish = async (isDraft = false) => {
        if (!user) return;
        if (selectedAccountIds.length === 0 && !isDraft) {
            alert('Please select at least one account.');
            return;
        }

        setLoading(true);
        try {
            // Fetch existing scheduled posts to check for time conflicts
            const existingPosts = await postsService.getPosts('scheduled');
            const existingTimes = existingPosts
                .filter(p => p.scheduledTime)
                .map(p => p.scheduledTime!.getTime());

            const isSafeTime = (date: Date, blockedTimes: number[]): boolean => {
                const checkTime = date.getTime();
                const buffer = 120 * 60 * 1000; // 120 minutes (2 hours) in ms
                for (const time of blockedTimes) {
                    if (Math.abs(checkTime - time) < buffer) return false;
                }
                return true;
            };

            let finalMediaUrls = [...uploadedMedia.map(m => m.url)];
            if (mediaFiles.length > 0) {
                for (const file of mediaFiles) {
                    const result = await storageService.uploadMedia(file, user.id);
                    finalMediaUrls.push(result.publicUrl);
                }
            }

            // Prepare and validate media URLs before publishing
            if (finalMediaUrls.length > 0) {
                console.log('📸 Preparing media URLs for publishing:', finalMediaUrls.length);
                try {
                    const preparedUrls = await storageService.prepareMediaUrlsForPublishing(finalMediaUrls);

                    if (preparedUrls.length !== finalMediaUrls.length) {
                        const missingCount = finalMediaUrls.length - preparedUrls.length;
                        throw new Error(`${missingCount} media file(s) could not be loaded. Please try re-uploading your images.`);
                    }

                    finalMediaUrls = preparedUrls;
                    console.log('✅ All media URLs validated and prepared');
                } catch (prepError: any) {
                    console.error('❌ Media preparation failed:', prepError);
                    throw new Error(`Failed to prepare media for publishing: ${prepError.message}`);
                }
            }

            // Pre-fetch comment templates if randomizing
            let specificFolderComments: any[] = [];
            if (useRandomComment && commentFolder) {
                specificFolderComments = commentTemplates.filter(t => t.category === commentFolder);
                if (specificFolderComments.length === 0) {
                    throw new Error(`No comments found in folder "${commentFolder}"`);
                }
            }

            // Ensure accounts are selected or handle draft fallback
            const accountsToPost = selectedAccountIds.length > 0
                ? selectedAccountIds.map(id => platformAccounts.find(a => a.id === id)).filter(Boolean)
                : [];

            if (accountsToPost.length === 0) {
                if (isDraft && platformAccounts.length > 0) {
                    accountsToPost.push(platformAccounts[0]);
                } else if (isDraft) {
                    throw new Error('Please connect an account first.');
                }
            }

            // Post Generation Logic (Bulk vs Recurring vs Single)
            const itemsToPost: { text: string, date: Date | null }[] = [];
            // Safely parse scheduledDate as LOCAL time. A bare "YYYY-MM-DD" string is
            // interpreted as UTC midnight by JS, which shifts the date back a day for
            // UTC-offset timezones (e.g. Minnesota UTC-5/6). Appending "T12:00:00"
            // (no Z) forces local-noon parsing to guarantee the correct calendar day.
            const parseDateAsLocal = (s: string): Date => {
                if (!s) return new Date();
                // If it's already a datetime string (has 'T'), use as-is
                if (s.includes('T')) return new Date(s);
                // Plain date — append local noon to avoid UTC-midnight rollback
                return new Date(`${s}T12:00:00`);
            };
            const baseDate = scheduledDate ? parseDateAsLocal(scheduledDate) : null;

            if (isBulkMode) {
                const messages = content.split('---').map(c => c.trim()).filter(c => c);
                if (messages.length === 0) throw new Error('Bulk content is empty.');
                if (!baseDate && !isDraft) throw new Error('Start date required for bulk scheduling.');

                if (bulkSchedulingMode === 'custom-days') {
                    // Custom Days Mode - one post per selected day
                    if (bulkCustomDays.length === 0) throw new Error('Please select at least one day for custom days scheduling.');

                    const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    let currentDate = new Date(baseDate || new Date());
                    let messageIndex = 0;
                    let safetyCounter = 0;

                    while (messageIndex < messages.length && safetyCounter < 730) { // Max 2 years ahead
                        const dayStr = dayMap[currentDate.getDay()];

                        if (bulkCustomDays.includes(dayStr)) {
                            const msg = messages[messageIndex];

                            if (baseDate) {
                                let d: Date;
                                let safe = false;
                                let attempts = 0;

                                // Try to use best time if enabled and available
                                const best = useBestTimesBulk ? getBestTimeForDay(bestTimeSlots, currentDate.getDay()) : null;

                                if (best) {
                                    let targetHour = best.hour;
                                    let targetMin = Math.floor(Math.random() * 20); // Add jitter

                                    do {
                                        d = new Date(currentDate);
                                        d.setHours(targetHour, targetMin, 0, 0);

                                        if (isSafeTime(d, existingTimes)) {
                                            safe = true;
                                        } else {
                                            targetMin += 15;
                                            if (targetMin >= 60) {
                                                targetMin %= 60;
                                                targetHour = (targetHour + 1) % 24;
                                            }
                                        }
                                        attempts++;
                                    } while (!safe && attempts < 50);
                                } else {
                                    const frame = bulkTimeFrames[0];
                                    const [startH, startM] = frame.start.split(':').map(Number);
                                    const [endH, endM] = frame.end.split(':').map(Number);
                                    const startMin = startH * 60 + startM;
                                    const endMin = endH * 60 + endM;
                                    const maxVal = endMin > startMin ? endMin : startMin + 60;

                                    do {
                                        const randomMin = Math.floor(Math.random() * (maxVal - startMin + 1)) + startMin;
                                        d = new Date(currentDate);
                                        d.setHours(Math.floor(randomMin / 60), randomMin % 60, 0, 0);

                                        if (isSafeTime(d, existingTimes)) {
                                            safe = true;
                                        }
                                        attempts++;
                                    } while (!safe && attempts < 50);
                                }

                                if (!safe) {
                                    // Fallback to avoid infinite loop
                                    d = new Date(currentDate);
                                    d.setHours(12, 0, 0, 0);
                                    console.warn('Could not find a conflict-free slot after 50 attempts, scheduling anyway.');
                                }

                                itemsToPost.push({ text: msg, date: d });
                                existingTimes.push(d.getTime()); // Block this time for subsequent posts in this batch
                            } else {
                                itemsToPost.push({ text: msg, date: null });
                            }

                            messageIndex++;
                        }

                        currentDate.setDate(currentDate.getDate() + 1);
                        safetyCounter++;
                    }
                } else {
                    // Consecutive Days Mode - original logic
                    let currentDayOffset = 0;
                    let postsScheduledToday = 0;

                    messages.forEach((msg, i) => {
                        let date: Date | null = null;

                        if (baseDate) {
                            // Determine Day
                            const d = new Date(baseDate);
                            d.setDate(d.getDate() + currentDayOffset);

                                // Determine Frame/Time
                                let newDate: Date | null = null;
                                let safe = false;
                                let attempts = 0;

                                const best = useBestTimesBulk ? getBestTimeForDay(bestTimeSlots, d.getDay()) : null;

                                if (best) {
                                    let targetHour = best.hour;
                                    let targetMin = Math.floor(Math.random() * 20); // Add jitter

                                    // If we have multiple posts per day and the best time is already taken, we need to find another slot
                                    // For now, we'll just let the safety check handle it
                                    do {
                                        newDate = new Date(d);
                                        newDate.setHours(targetHour, targetMin, 0, 0);

                                        if (isSafeTime(newDate, existingTimes)) {
                                            safe = true;
                                        } else {
                                            targetMin += 30; // Push further if conflict
                                            if (targetMin >= 60) {
                                                targetMin %= 60;
                                                targetHour = (targetHour + 1) % 24;
                                            }
                                        }
                                        attempts++;
                                    } while (!safe && attempts < 50);
                                } else {
                                    const frame = bulkTimeFrames[postsScheduledToday % bulkTimeFrames.length];
                                    const [startH, startM] = frame.start.split(':').map(Number);
                                    const [endH, endM] = frame.end.split(':').map(Number);
                                    const startMin = startH * 60 + startM;
                                    const endMin = endH * 60 + endM;
                                    const maxVal = endMin > startMin ? endMin : startMin + 60;

                                    do {
                                        const randomMin = Math.floor(Math.random() * (maxVal - startMin + 1)) + startMin;
                                        newDate = new Date(d);
                                        newDate.setHours(Math.floor(randomMin / 60), randomMin % 60, 0, 0);

                                        if (isSafeTime(newDate, existingTimes)) {
                                            safe = true;
                                        }
                                        attempts++;
                                    } while (!safe && attempts < 50);
                                }

                                if (!safe) {
                                    newDate = new Date(d);
                                    newDate.setHours(12, 0, 0, 0);
                                    console.warn('Could not find a conflict-free slot after 50 attempts, scheduling anyway.');
                                }

                                date = newDate;
                                if (date) existingTimes.push(date.getTime()); // Block current for next iteration

                            // Increment counters
                            postsScheduledToday++;
                            if (postsScheduledToday >= bulkPostsPerDay) {
                                postsScheduledToday = 0;
                                currentDayOffset++;
                            }
                        }

                        itemsToPost.push({ text: msg, date });
                    });
                }
            } else if (isRecurring && !isDraft && baseDate) {
                // Recurring Logic
                if (recurringDays.length === 0) throw new Error('Please select at least one day for recurrence.');

                let currentDate = new Date(baseDate);
                let count = 0;
                // Max loop safety
                let safeLoop = 0;
                const dayMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

                while (count < recurringCount && safeLoop < 365) {
                    const dayStr = dayMap[currentDate.getDay()];

                    if (recurringDays.includes(dayStr)) {
                        let targetHour: number;
                        let targetMin: number;
                        let d: Date;
                        let safe = false;
                        let attempts = 0;

                        const best = useBestTimesBulk ? getBestTimeForDay(bestTimeSlots, currentDate.getDay()) : null;

                        if (best) {
                            targetHour = best.hour;
                            targetMin = Math.floor(Math.random() * 20); // Jitter

                            do {
                                d = new Date(currentDate);
                                d.setHours(targetHour, targetMin, 0, 0);

                                if (isSafeTime(d, existingTimes)) {
                                    safe = true;
                                } else {
                                    targetMin += 20;
                                    if (targetMin >= 60) {
                                        targetMin %= 60;
                                        targetHour = (targetHour + 1) % 24;
                                    }
                                }
                                attempts++;
                            } while (!safe && attempts < 50);
                        } else {
                            // Random Time in Window
                            const [startH, startM] = recurringTimeWindow.start.split(':').map(Number);
                            const [endH, endM] = recurringTimeWindow.end.split(':').map(Number);
                            const startMin = startH * 60 + startM;
                            const endMin = endH * 60 + endM;
                            const maxVal = endMin > startMin ? endMin : startMin + 60;

                            do {
                                const randomMin = Math.floor(Math.random() * (maxVal - startMin + 1)) + startMin;
                                d = new Date(currentDate);
                                d.setHours(Math.floor(randomMin / 60), randomMin % 60, 0, 0);

                                if (isSafeTime(d, existingTimes)) {
                                    safe = true;
                                }
                                attempts++;
                            } while (!safe && attempts < 50);
                        }

                        if (!safe) {
                            d = new Date(currentDate);
                            d.setHours(12, 0, 0, 0);
                        }

                        itemsToPost.push({ text: content, date: d });
                        existingTimes.push(d.getTime());
                        count++;
                    }

                    // Advance 1 day
                    currentDate.setDate(currentDate.getDate() + 1);
                    safeLoop++;
                }
            } else {
                // Single Post
                itemsToPost.push({ text: content, date: baseDate });
            }

            // Loop through all generated items
            for (let i = 0; i < itemsToPost.length; i++) {
                const item = itemsToPost[i];

                for (let j = 0; j < accountsToPost.length; j++) {
                    const account = accountsToPost[j];
                    if (!account) continue;

                    const isLastItem = i === itemsToPost.length - 1;
                    const isLastAccount = j === accountsToPost.length - 1;

                    // Determine media for this specific post
                    let postMediaUrls = [...finalMediaUrls];
                    if (isBulkMode && bulkMediaOverrides[i] !== undefined) {
                        const overrideIndex = bulkMediaOverrides[i];
                        if (overrideIndex === null) {
                            postMediaUrls = [];
                        } else if (finalMediaUrls[overrideIndex]) {
                            postMediaUrls = [finalMediaUrls[overrideIndex]];
                        }
                    } else if (isBulkMode && useSequentialImages && finalMediaUrls.length > 0) {
                        // Use deterministic round-robin so it matches the preview exactly
                        // Post 1 -> Image 1, Post 2 -> Image 2, etc.
                        const index = i % finalMediaUrls.length;
                        postMediaUrls = [finalMediaUrls[index]];
                    } else if (isBulkMode && useRandomImage && finalMediaUrls.length > 0) {
                        // Truly random image per post
                        const index = Math.floor(Math.random() * finalMediaUrls.length);
                        postMediaUrls = [finalMediaUrls[index]];
                    }

                    // Determine First Comment
                    let thisPostFirstComment = firstComment;
                    if (useRandomComment && specificFolderComments.length > 0) {
                        const randomTemplate = specificFolderComments[Math.floor(Math.random() * specificFolderComments.length)];
                        thisPostFirstComment = randomTemplate.firstComment || '';
                    }

                    // For Threads, we now support native threaded replies
                    // For other platforms (Instagram, LinkedIn), firstComment is sent if supported
                    const shouldSendFirstComment = !!thisPostFirstComment;

                    // Create Payload
                    const payload: Partial<Post> = {
                        userId: user.id,
                        platform: account.platform,
                        platformAccountId: account.id,
                        accountName: account.accountName || account.accountUsername,
                        content: {
                            type: postMediaUrls.length > 0 ? 'media' : 'single',
                            text: item.text,
                            firstComment: shouldSendFirstComment ? thisPostFirstComment : undefined,
                            mediaUrls: postMediaUrls,
                            meta: {
                                isBulkMode,
                                useSequentialImages,
                                useRandomImage,
                                originalMediaUrls: (useSequentialImages || useRandomImage) ? finalMediaUrls : undefined,
                                isThread: account.platform === 'threads',
                                originalDate: item.date ? item.date.toISOString() : undefined,
                                bulkPostsPerDay,
                                bulkTimeFrames,
                                isRecurring,
                                recurringDays,
                                recurringTimeWindow,
                                recurringCount
                            }
                        },
                        scheduledTime: item.date,
                        status: (isDraft ? 'draft' : (item.date ? 'scheduled' : 'publishing')) as any,
                    };

                    console.log(`[Publish] Processing ${account.platform} (Account Index: ${j}, Total Accounts: ${accountsToPost.length})`);
                    console.log(`[Publish] Media URLs count: ${finalMediaUrls.length}`);
                    console.log(`[Publish] Payload Media URLs:`, payload.content.mediaUrls);

                    let savedPostId: string;

                    // Update logic: Only update draft if it's the FIRST item and FIRST account and we have a draftId
                    // This prevents overwriting the draft multiple times or losing the draft reference improperly
                    const isFirstAccount = j === 0;
                    const isFirstItem = i === 0;

                    if (draftId && isFirstItem && isFirstAccount) {
                        await postsService.updatePost(draftId, payload);
                        savedPostId = draftId;
                    } else {
                        const newPost = await postsService.createPost(payload);
                        savedPostId = newPost.id;
                    }

                    if (!item.date && !isDraft) {
                        try {
                            await publishService.publishPostInstant({
                                postId: savedPostId,
                                platform: payload.platform!,
                                platformAccountId: payload.platformAccountId!,
                                content: {
                                    text: payload.content!.text!,
                                    mediaUrls: payload.content!.mediaUrls,
                                    type: payload.content!.type as any,
                                    firstComment: payload.content!.firstComment
                                },
                                cleanupMedia: isLastItem && isLastAccount // Only cleanup on the very last operation
                            });
                        } catch (publishError: any) {
                            console.error('Publishing failed', publishError);
                            await postsService.updatePost(savedPostId, { status: 'failed', errorMessage: publishError.message });
                        }
                    }
                }
            }

            // Count how many items were scheduled and grab the first date
            const scheduledItems = itemsToPost.filter(i => i.date !== null);
            const firstScheduledDate = scheduledItems.length > 0 ? scheduledItems[0].date : null;
            const totalPosts = itemsToPost.length * accountsToPost.length;
            setPublishResult({ count: totalPosts, firstDate: firstScheduledDate, isDraft });
        } catch (error: any) {
            console.error('Failed to publish:', error);
            alert(error.message || 'Failed to publish post');
        } finally {
            setLoading(false);
        }
    };

    // ── Success Screen ──────────────────────────────────────────────────────────
    if (publishResult) {
        const { count, firstDate, isDraft: wasDraft } = publishResult;
        const formattedDate = firstDate
            ? firstDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
            : null;
        const formattedTime = firstDate
            ? firstDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
            : null;

        return (
            <div className="flex items-center justify-center min-h-[70vh] animate-in fade-in duration-500">
                <div className="text-center max-w-lg w-full px-4">
                    {/* Animated checkmark ring */}
                    <div className="relative mx-auto mb-8 flex items-center justify-center" style={{ width: 120, height: 120 }}>
                        <div className="absolute inset-0 rounded-full bg-green-500 opacity-15 animate-ping" style={{ animationDuration: '2s' }} />
                        <div className="absolute inset-0 rounded-full bg-green-500 opacity-10" />
                        <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-green-500 shadow-lg shadow-green-500/30">
                            <CheckCircle2 className="h-12 w-12 text-white drop-shadow" strokeWidth={1.5} />
                        </div>
                    </div>

                    {/* Heading */}
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <PartyPopper className="h-5 w-5 text-yellow-500" />
                        <h1 className="text-3xl font-bold tracking-tight">
                            {wasDraft ? 'Draft Saved!' : count > 1 ? `${count} Posts Scheduled!` : 'Post Scheduled!'}
                        </h1>
                        <PartyPopper className="h-5 w-5 text-yellow-500 scale-x-[-1]" />
                    </div>

                    {/* Sub-message */}
                    {!wasDraft && firstDate && (
                        <p className="text-muted-foreground text-base mb-1">
                            First post drops on <span className="font-semibold text-foreground">{formattedDate}</span>
                        </p>
                    )}
                    {!wasDraft && firstDate && formattedTime && (
                        <p className="text-muted-foreground text-sm mb-6">
                            at <span className="font-semibold text-foreground">{formattedTime}</span> (local time)
                        </p>
                    )}
                    {!wasDraft && !firstDate && (
                        <p className="text-muted-foreground text-base mb-6">Your post is being published now.</p>
                    )}
                    {wasDraft && (
                        <p className="text-muted-foreground text-base mb-6">Your draft has been saved and can be edited anytime.</p>
                    )}

                    {/* CTA buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
                        <Button
                            size="lg"
                            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm border-0"
                            onClick={() => navigate('/schedule')}
                        >
                            View Schedule
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                        <Button
                            size="lg"
                            variant="outline"
                            className="gap-2"
                            onClick={() => {
                                // Reset all state for a fresh post
                                setPublishResult(null);
                                setContent('');
                                setSelectedAccountIds([]);
                                setUploadedMedia([]);
                                setMediaFiles([]);
                                setScheduledDate('');
                                setFirstComment('');
                                setIsBulkMode(false);
                                setIsRecurring(false);
                                setDraftId(null);
                            }}
                        >
                            <PenLine className="h-4 w-4" />
                            Compose Another
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-auto lg:h-[calc(100vh-8rem)] relative">
            {/* Template Modal */}
            {isTemplateModalOpen && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <Card className="w-full max-w-2xl max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-4 border-b flex justify-between items-center bg-muted/40 rounded-t-xl">
                            <h2 className="text-xl font-bold flex items-center gap-2"><LayoutTemplate className="h-5 w-5" /> Templates</h2>
                            <Button variant="ghost" size="icon" onClick={() => setIsTemplateModalOpen(false)}><X className="h-4 w-4" /></Button>
                        </div>
                        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                            {/* Create New */}
                            <div className="p-6 border-b md:border-b-0 md:border-r md:w-1/3 flex flex-col gap-4 bg-muted/10">
                                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">
                                    {editingTemplate ? 'Update Template' : 'Save Current Draft'}
                                </h3>
                                <div className="space-y-2">
                                    <Label>Template Name</Label>
                                    <Input
                                        placeholder="My new template..."
                                        value={newTemplateName}
                                        onChange={e => setNewTemplateName(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <Button className="flex-1" onClick={handleSaveTemplate} disabled={!newTemplateName.trim()}>
                                            {editingTemplate ? <Save className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                            {editingTemplate ? 'Update' : 'Save'}
                                        </Button>
                                        {editingTemplate && (
                                            <Button variant="outline" size="icon" onClick={handleCancelEdit}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-auto">
                                    {editingTemplate
                                        ? "Updates the selected template with the current editor content."
                                        : "Saves the current text and platform selection as a reusable template."}
                                </p>
                            </div>

                            {/* List */}
                            {/* List */}
                            <div className="flex-1 p-0 overflow-y-auto">
                                <div className="p-4 sticky top-0 bg-background/95 backdrop-blur z-10 border-b">
                                    <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Library ({templates.length})</h3>
                                </div>
                                {templates.length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground">
                                        <LayoutTemplate className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                        <p>No templates yet.</p>
                                    </div>
                                ) : (
                                    <div className="divide-y relative">
                                        {/* Built-in Section */}
                                        {templates.filter(t => t.userId === 'system').length > 0 && (
                                            <div>
                                                <div className="bg-muted/30 p-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b">Built-in</div>
                                                {templates.filter(t => t.userId === 'system').map(t => (
                                                    <div key={t.id} className="p-4 hover:bg-muted/50 transition-colors flex justify-between items-start gap-4 cursor-pointer" onClick={() => handleLoadTemplate(t)}>
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-medium text-sm">{t.name}</span>
                                                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">{t.platform}</span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground line-clamp-2">{t.content?.text}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Custom Section */}
                                        {templates.filter(t => t.userId !== 'system').length > 0 && (
                                            <div>
                                                <div className="bg-muted/30 p-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-t">My Templates</div>
                                                {templates.filter(t => t.userId !== 'system').map(t => (
                                                    <div key={t.id} className="p-4 hover:bg-muted/50 transition-colors flex justify-between items-start gap-4">
                                                        <div className="flex-1 cursor-pointer" onClick={() => handleLoadTemplate(t)}>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-medium text-sm">{t.name}</span>
                                                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase">{t.platform}</span>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground line-clamp-2">{t.content?.text}</p>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={(e) => handleEditTemplate(t, e)}>
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={(e) => handleDeleteTemplate(t.id, e)}>
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </Card>
                </div>
            )}

            {/* Editor Column */}
            <div className="flex flex-col gap-6">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Create Post</h1>
                    <p className="text-muted-foreground mt-2">Draft and schedule your content across platforms.</p>
                </div>

                <Card className="flex-1 flex flex-col">
                    <CardContent className="p-6 flex-1 flex flex-col gap-6">

                        {/* Account Selector */}
                        <div className="space-y-3">
                            <Label className="text-base">Select Accounts</Label>
                            {platformAccounts.length === 0 ? (
                                <div className="p-4 border border-dashed rounded-lg text-center text-muted-foreground bg-muted/20">
                                    No accounts connected. Go to Settings to connect accounts.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {platformAccounts.map(account => (
                                        <div
                                            key={account.id}
                                            className={`flex items-center space-x-3 border p-3 rounded-md cursor-pointer transition-colors ${selectedAccountIds.includes(account.id) ? 'bg-primary/10 border-primary' : 'hover:bg-accent'}`}
                                            onClick={() => toggleAccount(account.id)}
                                        >
                                            <Checkbox checked={selectedAccountIds.includes(account.id)} onCheckedChange={() => toggleAccount(account.id)} />
                                            <div className="flex-1 overflow-hidden">
                                                <div className="font-medium truncate">{account.accountName || account.accountUsername || 'Unknown Account'}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{account.platform}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Content Area & Threaded Reply */}
                        <div className="flex-1 flex flex-col">
                            <div className="flex gap-4 group">
                                <div className="flex flex-col items-center">
                                    <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0 border-2 border-background ring-2 ring-muted/20">
                                        {user?.user_metadata?.avatar_url ? (
                                            <img src={user.user_metadata.avatar_url} className="h-full w-full object-cover" />
                                        ) : (
                                            <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                        )}
                                    </div>
                                    {(firstComment || selectedAccountIds.some(id => platformAccounts.find(a => a.id === id)?.platform === 'threads')) && (
                                        <div className="w-1 flex-1 bg-muted/40 rounded-full my-1 min-h-[20px]"></div>
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col gap-2 pb-6">
                                    <div className="flex justify-between items-center">
                                        <Label htmlFor="content" className="font-bold text-sm">Post Content</Label>
                                        <div className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full font-mono uppercase tracking-tight">Main Post</div>
                                    </div>
                                    <Textarea
                                        id="content"
                                        placeholder={isBulkMode ? "Post 1 content\n---\nPost 2 content\n---\nPost 3 content..." : "What's on your mind?"}
                                        className={`min-h-[140px] resize-none text-base p-4 shadow-sm border-muted-foreground/10 focus-visible:ring-primary/20 transition-all ${selectedAccountIds.some(id => {
                                            const p = platformAccounts.find(a => a.id === id)?.platform;
                                            const limit = p === 'threads' ? 500 : p === 'instagram' ? 2200 : 3000;
                                            return content.length > limit;
                                        }) ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                    />
                                    <div className="flex justify-between items-start">
                                        <div className="text-[11px] text-muted-foreground italic">
                                            {isBulkMode && "Pro tip: Use '---' to split into multiple posts"}
                                        </div>
                                        {content.length > 0 && (
                                            <div className={`text-[11px] font-medium ${!isValid ? 'text-red-500' : 'text-muted-foreground'}`}>
                                                {content.length} characters
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Threaded Reply / First Comment */}
                            {(selectedAccountIds.some(id => platformAccounts.find(a => a.id === id)?.platform === 'threads') || firstComment) && (
                                <div className="flex gap-4 group animate-in slide-in-from-top-2 duration-300">
                                    <div className="flex flex-col items-center">
                                        <div className="h-10 w-10 rounded-full bg-muted overflow-hidden shrink-0 border-2 border-background ring-2 ring-muted/20">
                                            {user?.user_metadata?.avatar_url ? (
                                                <img src={user.user_metadata.avatar_url} className="h-full w-full object-cover" />
                                            ) : (
                                                <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-bold text-xs">
                                                    YOU
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="flex justify-between items-center">
                                            <Label htmlFor="first-comment" className="font-bold text-sm">
                                                {selectedAccountIds.some(id => platformAccounts.find(a => a.id === id)?.platform === 'threads')
                                                    ? "Threaded Reply"
                                                    : "First Comment"}
                                            </Label>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-1.5 bg-muted/30 px-2 py-0.5 rounded-md">
                                                    <Checkbox
                                                        id="random-comment"
                                                        className="h-3.5 w-3.5"
                                                        checked={useRandomComment}
                                                        onCheckedChange={(c) => {
                                                            setUseRandomComment(!!c);
                                                            if (c) setFirstComment('');
                                                        }}
                                                    />
                                                    <Label htmlFor="random-comment" className="text-[10px] font-medium cursor-pointer text-muted-foreground uppercase">Randomize</Label>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground bg-primary/5 text-primary-foreground/70 px-2 py-0.5 rounded-full font-mono uppercase tracking-tight">Post 2</div>
                                            </div>
                                        </div>

                                        {useRandomComment ? (
                                            <div className="p-4 border border-dashed rounded-lg bg-muted/10 border-muted-foreground/20">
                                                <Label className="text-[11px] mb-2 block font-semibold text-muted-foreground">Select Comment Folder</Label>
                                                <select
                                                    className="w-full p-2.5 rounded-md border text-sm bg-background/50 focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                                    value={commentFolder}
                                                    onChange={(e) => setCommentFolder(e.target.value)}
                                                >
                                                    <option value="">-- Select Folder --</option>
                                                    {availableCommentFolders.map(f => (
                                                        <option key={f} value={f}>{f}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="relative">
                                                <Textarea
                                                    id="first-comment"
                                                    placeholder={selectedAccountIds.some(id => platformAccounts.find(a => a.id === id)?.platform === 'threads') ? "Add more context, links, or a call to action..." : "Add a first comment..."}
                                                    className="min-h-[100px] resize-none text-base p-4 shadow-sm border-muted-foreground/10 focus-visible:ring-primary/20 transition-all"
                                                    value={firstComment}
                                                    onChange={(e) => setFirstComment(e.target.value)}
                                                />
                                                {!useRandomComment && firstComment.length > 0 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="absolute bottom-2 right-2 h-7 text-[10px] bg-background/80 hover:bg-background border shadow-sm px-2 gap-1.5"
                                                        onClick={handleOpenSaveCommentModal}
                                                        disabled={isSavingComment}
                                                    >
                                                        <Save className="h-3 w-3" /> Save to Library
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>


                        {/* Media & Schedule Tools */}
                        <div className="flex flex-col gap-4">
                            {/* Mode Toggles */}
                            <div className="flex items-center gap-6 p-4 bg-muted/20 rounded-lg border">
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="bulk-mode" className="font-medium cursor-pointer">Bulk Mode</Label>
                                    <Checkbox
                                        id="bulk-mode"
                                        checked={isBulkMode}
                                        onCheckedChange={(c) => {
                                            setIsBulkMode(!!c);
                                            if (c) setIsRecurring(false);
                                        }}
                                    />
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label htmlFor="recurring" className="font-medium cursor-pointer">Recurring Mode</Label>
                                    <Checkbox
                                        id="recurring"
                                        checked={isRecurring}
                                        onCheckedChange={(c) => {
                                            setIsRecurring(!!c);
                                            if (c) setIsBulkMode(false);
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Media Uploader & Library */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Media</Label>
                                    {(isBulkMode || isRecurring) && (
                                        <div className="flex flex-col gap-2">
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="shared-image"
                                                    checked={useSharedImage}
                                                    onCheckedChange={(c) => {
                                                        setUseSharedImage(!!c);
                                                        if (c) {
                                                            setUseSequentialImages(false);
                                                            setUseRandomImage(false);
                                                        }
                                                    }}
                                                />
                                                <Label htmlFor="shared-image" className="text-xs font-normal cursor-pointer text-muted-foreground">
                                                    Use all images for all posts
                                                </Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="sequential-image"
                                                    checked={useSequentialImages}
                                                    onCheckedChange={(c) => {
                                                        setUseSequentialImages(!!c);
                                                        if (c) {
                                                            setUseSharedImage(false);
                                                            setUseRandomImage(false);
                                                        }
                                                    }}
                                                />
                                                <Label htmlFor="sequential-image" className="text-xs font-normal cursor-pointer text-muted-foreground">
                                                    Assign image 1 to post 1, image 2 to post 2, etc.
                                                </Label>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    id="random-image"
                                                    checked={useRandomImage}
                                                    onCheckedChange={(c) => {
                                                        setUseRandomImage(!!c);
                                                        if (c) {
                                                            setUseSharedImage(false);
                                                            setUseSequentialImages(false);
                                                        }
                                                    }}
                                                />
                                                <Label htmlFor="random-image" className="text-xs font-normal cursor-pointer text-muted-foreground">
                                                    Randomize image per post
                                                </Label>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                {useSharedImage && (isBulkMode || isRecurring) && (uploadedMedia.length > 0 || mediaFiles.length > 0) && (
                                    <div className="text-xs text-blue-400 bg-blue-950/30 px-3 py-2 rounded-md border border-blue-900">
                                        ℹ️ This image will be used for all {isBulkMode ? 'bulk' : 'recurring'} posts
                                    </div>
                                )}
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                    {/* Existing Uploaded Media (URLs) */}
                                    {uploadedMedia.map((media, i) => (
                                        <div key={i} className="relative aspect-square group">
                                            <PostThumbnail src={media.url} className="w-full h-full object-cover rounded-lg border bg-muted" />
                                            <button
                                                onClick={() => setUploadedMedia(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {/* New File Previews */}
                                    {filePreviews.map((src, i) => (
                                        <div key={`preview-${i}`} className="relative aspect-square group">
                                            <img src={src} className="w-full h-full object-cover rounded-lg border bg-muted" />
                                            <button
                                                onClick={() => {
                                                    const newFiles = [...mediaFiles];
                                                    newFiles.splice(i, 1);
                                                    setMediaFiles(newFiles);
                                                }}
                                                className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Add Buttons */}
                                    <div className="flex flex-col gap-2">
                                        <Label htmlFor="media-upload" className="flex-1 min-h-[100px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-accent/50 transition-colors">
                                            <ImagePlus className="h-6 w-6 mb-2 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground font-medium">Upload</span>
                                            <input
                                                id="media-upload"
                                                type="file"
                                                accept="image/*,video/*"
                                                multiple
                                                className="hidden"
                                                onChange={handleFileSelect}
                                            />
                                        </Label>

                                        <Button variant="outline" size="sm" onClick={() => setIsLibraryOpen(true)} className="w-full">
                                            <Layers className="h-4 w-4 mr-2" /> Library
                                        </Button>
                                    </div>
                                </div>
                            </div>

                             {/* Schedule Date */}
                            {!isBulkMode && !isRecurring && (
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Schedule Date & Time</Label>
                                        <div className="flex gap-2">
                                            <Input
                                                type="datetime-local"
                                                value={scheduledDate}
                                                onChange={(e) => setScheduledDate(e.target.value)}
                                                min={new Date().toISOString().slice(0, 16)}
                                            />
                                        </div>
                                    </div>
                                    {scheduledDate && (
                                        <div className="p-3 bg-indigo-950/30 border border-indigo-900 rounded-lg animate-in slide-in-from-top-1">
                                            {(() => {
                                                const d = new Date(scheduledDate);
                                                const best = getBestTimeForDay(bestTimeSlots, d.getDay());
                                                if (!best) return <p className="text-xs text-muted-foreground italic px-1">No historical data for {d.toLocaleDateString('en-US', { weekday: 'long' })} yet.</p>;
                                                
                                                const bestHour = best.hour;
                                                const bestTimeStr = `${bestHour === 0 ? 12 : bestHour > 12 ? bestHour - 12 : bestHour}${bestHour >= 12 ? 'pm' : 'am'}`;
                                                const isBestTimeSelected = d.getHours() === best.hour && d.getMinutes() === 0;

                                                return (
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <Sparkles className="h-4 w-4 text-indigo-500" />
                                                            <p className="text-xs font-medium">
                                                                Suggested time for {d.toLocaleDateString('en-US', { weekday: 'short' })}: <span className="text-indigo-400 font-bold">{bestTimeStr}</span>
                                                            </p>
                                                        </div>
                                                        {!isBestTimeSelected ? (
                                                            <Button 
                                                                variant="outline" 
                                                                size="sm" 
                                                                className="h-7 text-[11px] bg-background hover:bg-indigo-600 hover:text-white border-indigo-200 transition-all font-semibold"
                                                                onClick={() => {
                                                                    const date = new Date(scheduledDate);
                                                                    date.setHours(best.hour, 0, 0, 0);
                                                                    const offset = date.getTimezoneOffset() * 60000;
                                                                    const localISOTime = (new Date(date.getTime() - offset)).toISOString().slice(0, 16);
                                                                    setScheduledDate(localISOTime);
                                                                }}
                                                            >
                                                                Use Best Time
                                                            </Button>
                                                        ) : (
                                                            <div className="flex items-center gap-1.5 text-[11px] font-bold text-green-400 bg-green-950/20 px-2 py-0.5 rounded-md">
                                                                <CheckCircle2 className="h-3 w-3" />
                                                                Applied
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}
                                </div>
                            )}


                            {/* Bulk Settings */}
                            {isBulkMode && (
                                <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
                                    {/* Scheduling Mode Toggle */}
                                    <div className="space-y-2">
                                        <Label>Scheduling Type</Label>
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant={bulkSchedulingMode === 'consecutive' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setBulkSchedulingMode('consecutive')}
                                                className="flex-1"
                                            >
                                                Consecutive Days
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={bulkSchedulingMode === 'custom-days' ? 'default' : 'outline'}
                                                size="sm"
                                                onClick={() => setBulkSchedulingMode('custom-days')}
                                                className="flex-1"
                                            >
                                                Custom Days
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Day Selector for Custom Days */}
                                    {bulkSchedulingMode === 'custom-days' && (
                                        <div className="space-y-2">
                                            <Label>Select Days</Label>
                                            <div className="flex flex-wrap gap-2">
                                                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                                    <div
                                                        key={day}
                                                        className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer border ${bulkCustomDays.includes(day) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
                                                        onClick={() => {
                                                            setBulkCustomDays(prev =>
                                                                prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                                                            );
                                                        }}
                                                    >
                                                        {day}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Start Date</Label>
                                            <Input
                                                type="date"
                                                value={scheduledDate ? scheduledDate.split('T')[0] : ''}
                                                onChange={(e) => {
                                                    // Append T12:00:00 (no Z) so JS parses as local time, not UTC midnight
                                                    setScheduledDate(e.target.value ? `${e.target.value}T12:00:00` : '');
                                                }}
                                            />
                                        </div>
                                        {bulkSchedulingMode === 'consecutive' && (
                                            <div className="space-y-2">
                                                <Label>Posts Per Day</Label>
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    max="10"
                                                    value={bulkPostsPerDay}
                                                    onChange={(e) => setBulkPostsPerDay(Number(e.target.value))}
                                                />
                                            </div>
                                        )}
                                    </div>
                                     <div className="space-y-4">
                                        <div className="flex items-center justify-between bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-900/50">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-indigo-500" />
                                                <Label htmlFor="use-best-times" className="text-xs font-semibold cursor-pointer">Post at Best Times</Label>
                                            </div>
                                            <Checkbox 
                                                id="use-best-times"
                                                checked={useBestTimesBulk}
                                                onCheckedChange={(c) => setUseBestTimesBulk(!!c)}
                                            />
                                        </div>
                                        
                                        {!useBestTimesBulk ? (
                                            <div className="space-y-2 animate-in fade-in duration-300">
                                                <Label>Time Frame</Label>
                                                <div className="flex items-center gap-2">
                                                    <Clock className="h-4 w-4 text-muted-foreground" />
                                                    <Input
                                                        type="time"
                                                        value={bulkTimeFrames[0].start}
                                                        onChange={(e) => setBulkTimeFrames([{ ...bulkTimeFrames[0], start: e.target.value }])}
                                                    />
                                                    <span>to</span>
                                                    <Input
                                                        type="time"
                                                        value={bulkTimeFrames[0].end}
                                                        onChange={(e) => setBulkTimeFrames([{ ...bulkTimeFrames[0], end: e.target.value }])}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-muted/30 rounded-lg text-[11px] text-muted-foreground border border-dashed flex items-start gap-2">
                                                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                                <p>Each post will be automatically scheduled at the peak engagement hour for its specific day of the week.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Recurring Settings */}
                            {isRecurring && (
                                <div className="space-y-4 p-4 bg-muted/20 rounded-lg border">
                                    <div className="space-y-2">
                                        <Label>Select Days</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                                                <div
                                                    key={day}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium cursor-pointer border ${recurringDays.includes(day) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}
                                                    onClick={() => {
                                                        setRecurringDays(prev =>
                                                            prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                                                        );
                                                    }}
                                                >
                                                    {day}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Repeats</Label>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="50"
                                                value={recurringCount}
                                                onChange={(e) => setRecurringCount(Number(e.target.value))}
                                                placeholder="Total posts"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Start Date</Label>
                                            <Input
                                                type="date"
                                                value={scheduledDate ? scheduledDate.split('T')[0] : ''}
                                                onChange={(e) => {
                                                    // Append T12:00:00 (no Z) so JS parses as local time, not UTC midnight
                                                    setScheduledDate(e.target.value ? `${e.target.value}T12:00:00` : '');
                                                }}
                                            />
                                        </div>
                                    </div>
                                     <div className="space-y-4">
                                        <div className="flex items-center justify-between bg-indigo-950/20 p-2.5 rounded-lg border border-indigo-900/50">
                                            <div className="flex items-center gap-2">
                                                <Sparkles className="h-4 w-4 text-indigo-500" />
                                                <Label htmlFor="use-best-times-recurring" className="text-xs font-semibold cursor-pointer">Post at Best Times</Label>
                                            </div>
                                            <Checkbox 
                                                id="use-best-times-recurring"
                                                checked={useBestTimesBulk}
                                                onCheckedChange={(c) => setUseBestTimesBulk(!!c)}
                                            />
                                        </div>

                                        {!useBestTimesBulk ? (
                                            <div className="space-y-2 animate-in fade-in duration-300">
                                                <Label>Time Window</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="time"
                                                        value={recurringTimeWindow.start}
                                                        onChange={(e) => setRecurringTimeWindow({ ...recurringTimeWindow, start: e.target.value })}
                                                    />
                                                    <span>to</span>
                                                    <Input
                                                        type="time"
                                                        value={recurringTimeWindow.end}
                                                        onChange={(e) => setRecurringTimeWindow({ ...recurringTimeWindow, end: e.target.value })}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-muted/30 rounded-lg text-[11px] text-muted-foreground border border-dashed flex items-start gap-2">
                                                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                                                <p>Each recurring post will be scheduled at the peak engagement hour for that specific day.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="pt-4 border-t mt-auto space-y-2">
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setIsTemplateModalOpen(true)}>
                                    <LayoutTemplate className="h-4 w-4 mr-2" /> Use Template
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleSaveTemplate} disabled={!content && mediaFiles.length === 0}>
                                    <Save className="h-4 w-4 mr-2" /> Save as Template
                                </Button>
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button variant="secondary" onClick={() => handlePublish(true)} disabled={loading}>
                                    Save Draft
                                </Button>
                                <Button onClick={() => handlePublish(false)} disabled={loading || !isValid}>
                                    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                    {scheduledDate ? 'Schedule' : 'Publish Now'}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Unified Library Modal */}
            <LibraryModal
                isOpen={isLibraryOpen}
                onClose={() => setIsLibraryOpen(false)}
                initialTab={isLibraryOpen === 'comments' ? 'comments' : 'media'}
                platform={activePlatforms.includes('threads') ? 'threads' : activePlatforms[0] as any}
                commentTemplates={commentTemplates}
                onSelectMedia={(items) => {
                    setUploadedMedia(prev => [...prev, ...items]);
                    setIsLibraryOpen(false);
                }}
                onSelectComment={(text) => {
                    setFirstComment(text);
                    setUseRandomComment(false);
                    // Also try to infer folder if possible?
                    const template = commentTemplates.find(t => t.content?.text === text);
                    if (template && template.category) {
                        setCommentFolder(template.category);
                    }
                    setIsLibraryOpen(false);
                }}
            />
            <div className="flex flex-col gap-4 lg:overflow-hidden mt-8 lg:mt-0">
                <div className="flex-1 flex flex-col gap-4 min-h-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold">Preview</h2>
                        <span className="text-xs text-muted-foreground">See how your post will look</span>
                    </div>

                    <div className="h-[500px] lg:h-auto lg:flex-1 lg:min-h-0 relative bg-muted/30 border rounded-lg overflow-hidden">
                        {isBulkMode ? (
                            <div className="w-full h-full flex flex-col">
                                <div className="flex justify-center p-2 mb-2 sticky top-0 z-10">
                                    <div className="bg-muted p-1 rounded-lg inline-flex shadow-sm">
                                        {['linkedin', 'instagram', 'threads'].map(p => {
                                            const isActive = activePlatforms.includes(p);
                                            // Show if it's active, OR if no platforms are selected (show all by default), OR if "all" is selected (logic below handles the view)
                                            // Actually, the request is "only see the preview options of where we are going to post".
                                            if (activePlatforms.length > 0 && !isActive) return null;

                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setPreviewPlatform(p as any)}
                                                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${previewPlatform === p ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        })}
                                        {(activePlatforms.length === 0 || activePlatforms.length > 1) && (
                                            <button
                                                onClick={() => setPreviewPlatform('all')}
                                                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${previewPlatform === 'all' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                All
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <div className="absolute inset-0 top-12 overflow-y-auto p-4 space-y-6">
                                    {(() => {
                                        const messages = content.split('---').map(c => c.trim()).filter(c => c);
                                        if (messages.length === 0) return (
                                            <div className="text-center text-muted-foreground italic mt-20">
                                                Type content containing "---" to see bulk previews...
                                            </div>
                                        );

                                        const baseDate = scheduledDate
                                            ? (scheduledDate.includes('T') ? new Date(scheduledDate) : new Date(`${scheduledDate}T12:00:00`))
                                            : null;
                                        let currentDayOffset = 0;
                                        let postsScheduledToday = 0;

                                        // Prepare media pool
                                        const allMediaItems = [
                                            ...uploadedMedia.map(m => ({ url: m.url, isBlob: false })),
                                            ...filePreviews.map(p => ({ url: p, isBlob: true }))
                                        ];

                                        const previews = messages.map((msg, i) => {
                                            let dateDisplay = 'Set Start Date';
                                            let timeDisplay = '';

                                            if (baseDate) {
                                                const d = new Date(baseDate);
                                                d.setDate(d.getDate() + currentDayOffset);
                                                
                                                dateDisplay = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
                                                
                                                const best = useBestTimesBulk ? getBestTimeForDay(bestTimeSlots, d.getDay()) : null;
                                                if (best) {
                                                    const h = best.hour;
                                                    timeDisplay = `${h === 0 ? 12 : h > 12 ? h - 12 : h}:00${h >= 12 ? 'pm' : 'am'} (Best)`;
                                                } else {
                                                    const frame = bulkTimeFrames[postsScheduledToday % bulkTimeFrames.length];
                                                    timeDisplay = `${frame.start} - ${frame.end}`;
                                                }

                                                postsScheduledToday++;
                                                if (postsScheduledToday >= bulkPostsPerDay) {
                                                    postsScheduledToday = 0;
                                                    currentDayOffset++;
                                                }
                                            }

                                            // Determine media for this preview
                                            let postMedia = allMediaItems;
                                            if (bulkMediaOverrides[i] !== undefined) {
                                                const overrideIndex = bulkMediaOverrides[i];
                                                if (overrideIndex === null) {
                                                    postMedia = [];
                                                } else if (allMediaItems[overrideIndex]) {
                                                    postMedia = [allMediaItems[overrideIndex]];
                                                }
                                            } else if (useSequentialImages && allMediaItems.length > 0) {
                                                const index = i % allMediaItems.length; // Deterministic round-robin to match publish logic
                                                postMedia = [allMediaItems[index]];
                                            } else if (useRandomImage && allMediaItems.length > 0) {
                                                // Truly random image per post preview
                                                const index = Math.floor(Math.random() * allMediaItems.length);
                                                postMedia = [allMediaItems[index]];
                                            }

                                            return { msg, dateDisplay, timeDisplay, postMedia };
                                        });

                                        return previews.map((p, i) => (
                                            <div key={i} className="flex flex-col gap-6">
                                                <div className="flex justify-between items-center px-4 py-2 bg-muted border rounded-lg shadow-sm w-full max-w-md mx-auto">
                                                    <div className="text-xs text-muted-foreground font-medium font-sans">Post {i + 1}</div>
                                                    <div className="flex items-center gap-2 font-sans">
                                                        <span className="text-xs text-muted-foreground">Image:</span>
                                                        <div className="relative">
                                                            <select 
                                                                className="text-xs border border-border rounded-md py-1.5 pl-2 pr-7 bg-background text-slate-700 shadow-sm appearance-none outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer max-w-[120px] truncate"
                                                                value={bulkMediaOverrides[i] !== undefined ? (bulkMediaOverrides[i] === null ? "NONE" : bulkMediaOverrides[i]?.toString()) : "DEFAULT"}
                                                                onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    if (val === "DEFAULT") {
                                                                        const newOverrides = {...bulkMediaOverrides};
                                                                        delete newOverrides[i];
                                                                        setBulkMediaOverrides(newOverrides);
                                                                    } else if (val === "NONE") {
                                                                        setBulkMediaOverrides(prev => ({...prev, [i]: null}));
                                                                    } else {
                                                                        setBulkMediaOverrides(prev => ({...prev, [i]: parseInt(val)}));
                                                                    }
                                                                }}
                                                            >
                                                                <option value="DEFAULT">Auto</option>
                                                                <option value="NONE">No Image</option>
                                                                {allMediaItems.map((_, midx) => (
                                                                    <option key={midx} value={midx}>Image {midx + 1}</option>
                                                                ))}
                                                            </select>
                                                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-muted-foreground">
                                                                <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                                {(previewPlatform === 'linkedin' || previewPlatform === 'all') && (
                                                    // BULK LINKEDIN STYLE
                                                    <div className="w-full max-w-md mx-auto bg-background text-foreground rounded-lg border shadow-sm overflow-hidden font-sans">
                                                        <div className="p-4 pb-2 flex gap-3">
                                                            <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0 overflow-hidden relative">
                                                                {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="h-full w-full object-cover" />}
                                                                <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold h-4 w-4 flex items-center justify-center rounded-full border border-white">
                                                                    {i + 1}
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start">
                                                                    <div>
                                                                        <div className="font-semibold text-sm leading-tight text-foreground">{user?.user_metadata?.full_name || "Your Name"}</div>
                                                                        <div className="text-xs text-muted-foreground truncate leading-tight mt-0.5">Marketing Director | Growth | AI</div>
                                                                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                            <span>{p.dateDisplay} • {p.timeDisplay || 'TBD'}</span>
                                                                            <span>🌐</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="px-4 py-2 text-sm text-foreground whitespace-pre-wrap leading-normal break-words">
                                                            {renderPreviewText(p.msg, 3000)}
                                                        </div>

                                                        {p.postMedia.length > 0 && (
                                                            <div className="mt-2 w-full bg-muted border-t border-b overflow-hidden relative">
                                                                <PostThumbnail src={p.postMedia[0].url} className="w-full h-auto max-h-[600px] object-contain bg-black/5" />
                                                                {p.postMedia.length > 1 && (
                                                                    <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                                                                        +{p.postMedia.length - 1} more
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        <div className="px-4 py-2 border-t mt-2 flex justify-between text-muted-foreground">
                                                            <div className="flex gap-4">
                                                                <span className="flex items-center gap-1.5 text-xs font-semibold hover:bg-muted p-2 rounded cursor-pointer">👍 Like</span>
                                                                <span className="flex items-center gap-1.5 text-xs font-semibold hover:bg-muted p-2 rounded cursor-pointer">💬 Comment</span>
                                                                <span className="flex items-center gap-1.5 text-xs font-semibold hover:bg-muted p-2 rounded cursor-pointer">🔁 Repost</span>
                                                                <span className="flex items-center gap-1.5 text-xs font-semibold hover:bg-muted p-2 rounded cursor-pointer">✈️ Send</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {(previewPlatform === 'instagram' || previewPlatform === 'all') && (
                                                    // BULK INSTAGRAM STYLE
                                                    <div className="w-full max-w-md mx-auto bg-background text-foreground border rounded-xl shadow-sm overflow-hidden font-sans">
                                                        <div className="p-3 flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-full bg-pink-500 p-[1.5px]">
                                                                <div className="h-full w-full rounded-full bg-background p-[1.5px]">
                                                                    <div className="h-full w-full rounded-full bg-gray-200 overflow-hidden">
                                                                        {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="h-full w-full object-cover" />}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <span className="font-semibold text-sm">{(user?.user_metadata as any)?.preferred_username || user?.email?.split("@")[0] || "your_username"}</span>
                                                        </div>
                                                        {p.postMedia.length > 0 ? (
                                                            <div className="w-full bg-muted border-y flex items-center justify-center relative">
                                                                <PostThumbnail src={p.postMedia[0].url} className="w-full h-auto max-h-[600px] object-contain bg-black/5" />
                                                                {p.postMedia.length > 1 && (
                                                                    <div className="absolute top-2 right-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded-full flex gap-1 items-center font-semibold">
                                                                        1/{p.postMedia.length}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="aspect-square bg-muted flex flex-col items-center justify-center text-gray-400 p-8 text-center border-y">
                                                                <ImageIcon className="h-12 w-12 mb-2 opacity-20" />
                                                                <p className="text-xs">Instagram requires an image or video</p>
                                                            </div>
                                                        )}
                                                        <div className="p-3">
                                                            <div className="flex gap-4 mb-2">
                                                                <svg aria-label="Like" height="24" role="img" viewBox="0 0 24 24" width="24"><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.956-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175 1.23 1.794 1.242 1.888.085-.67.48-1.545 1.242-2.31 1.233-1.24 2.094-1.523 3.425-1.519Z" fill="none" stroke="currentColor" strokeWidth="2"></path></svg>
                                                                <svg aria-label="Comment" height="24" role="img" viewBox="0 0 24 24" width="24"><path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                            </div>
                                                            <div className="text-sm">
                                                                <span className="font-semibold mr-2">{(user?.user_metadata as any)?.preferred_username || user?.email?.split("@")[0] || "your_username"}</span>
                                                                <span className="whitespace-pre-wrap">{renderPreviewText(p.msg, 2200)}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {(previewPlatform === 'threads' || previewPlatform === 'all') && (
                                                    // BULK THREADS STYLE
                                                    <div className="w-full max-w-md mx-auto bg-background text-foreground p-4 font-sans border border-gray-100 rounded-xl shadow-sm">
                                                        <div className="flex gap-3 relative">
                                                            {(p.msg.length > 100 || p.postMedia.length > 0) && (
                                                                <div className="absolute left-[18px] top-12 bottom-0 w-[2px] bg-gray-200"></div>
                                                            )}

                                                            <div className="h-9 w-9 rounded-full bg-gray-200 shrink-0 overflow-hidden z-10 border-2 border-white relative">
                                                                {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="h-full w-full object-cover" />}
                                                            </div>

                                                            <div className="flex-1 min-w-0 pb-2">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <div className="font-semibold text-sm flex items-center gap-2">
                                                                        {(user?.user_metadata as any)?.preferred_username || user?.email?.split("@")[0] || "your_username"}
                                                                        <span className="text-[10px] bg-black text-white px-1.5 rounded-full">{i + 1}</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-3 text-gray-400">
                                                                        <span className="text-xs">{p.dateDisplay}</span>
                                                                        <span className="text-lg leading-3 mb-2">...</span>
                                                                    </div>
                                                                </div>

                                                                <div className="text-[15px] leading-snug whitespace-pre-wrap break-words text-foreground">
                                                                    {renderPreviewText(p.msg, 500)}
                                                                </div>

                                                                {p.postMedia.length > 0 && (
                                                                    <div className="mt-3 overflow-x-auto flex gap-2 no-scrollbar snap-x">
                                                                        {p.postMedia.map((m, idx) => (
                                                                            <div key={idx} className="relative rounded-xl overflow-hidden border border-gray-100 w-full min-h-[50px] bg-muted flex items-center justify-center">
                                                                                <PostThumbnail src={m.url} className="w-full h-auto max-h-[600px] object-contain bg-black/5" />
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                <div className="flex gap-4 mt-3 text-foreground">
                                                                    <svg aria-label="Like" height="20" role="img" viewBox="0 0 24 24" width="20"><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.956-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175 1.23 1.794 1.242 1.888.085-.67.48-1.545 1.242-2.31 1.233-1.24 2.094-1.523 3.425-1.519Z" fill="none" stroke="currentColor" strokeWidth="2"></path></svg>
                                                                    <svg aria-label="Comment" height="20" role="img" viewBox="0 0 24 24" width="20"><path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                                    <svg aria-label="Repost" height="20" role="img" viewBox="0 0 24 24" width="20"><path d="M19.998 9.497a1 1 0 0 0-1 1v4.228a3.274 3.274 0 0 1-3.27 3.27h-5.313l1.791-1.787a1 1 0 0 0-1.412-1.416L7.29 18.287a1.004 1.004 0 0 0-.294.707v.001c0 .023.012.042.013.065a.923.923 0 0 0 .281.643l3.502 3.504a1 1 0 0 0 1.414-1.414l-1.797-1.798h5.318a5.276 5.276 0 0 0 5.27-5.27v-4.228a1 1 0 0 0-1-1Zm-6.41-3.496-1.795 1.795a1 1 0 1 0 1.414 1.414l3.5-3.5a1.003 1.003 0 0 0 0-1.417l-3.5-3.5a1 1 0 0 0-1.414 1.414l1.794 1.794H8.27A5.277 5.277 0 0 0 3 9.271V13.5a1 1 0 0 0 2 0V9.271a3.275 3.275 0 0 1 3.271-3.27Z" fill="currentColor"></path></svg>
                                                                    <svg aria-label="Share" height="20" role="img" viewBox="0 0 24 24" width="20"><line fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2" x1="22" x2="9.218" y1="3" y2="10.083"></line><polygon fill="none" points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></polygon></svg>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>
                        ) : (
                            // SINGLE POST PREVIEW (TABBED)
                            <div className="w-full h-full flex flex-col">
                                <div className="flex justify-center p-2 mb-2">
                                    <div className="bg-muted p-1 rounded-lg inline-flex">
                                        {['linkedin', 'instagram', 'threads'].map(p => {
                                            const isActive = activePlatforms.includes(p);
                                            if (activePlatforms.length > 0 && !isActive) return null;
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setPreviewPlatform(p as any)}
                                                    className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${previewPlatform === p ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        })}
                                        {(activePlatforms.length === 0 || activePlatforms.length > 1) && (
                                            <button
                                                onClick={() => setPreviewPlatform('all')}
                                                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${previewPlatform === 'all' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                                            >
                                                All
                                            </button>
                                        )}
                                    </div>
                                </div>
                                <div className="absolute inset-0 top-12 overflow-y-auto p-4 space-y-6">
                                    {(previewPlatform === 'linkedin' || previewPlatform === 'all') && (
                                        <div className="w-full max-w-md mx-auto bg-background text-foreground rounded-lg border shadow-sm overflow-hidden font-sans">
                                            <div className="p-4 pb-2 flex gap-3">
                                                <div className="h-10 w-10 rounded-full bg-slate-200 shrink-0 overflow-hidden relative">
                                                    {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="h-full w-full object-cover" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-sm leading-tight text-foreground">{user?.user_metadata?.full_name || "Your Name"}</div>
                                                    <div className="text-xs text-muted-foreground truncate mt-0.5">Marketing | AI | Growth</div>
                                                </div>
                                            </div>
                                            <div className="px-4 py-2 text-sm text-foreground whitespace-pre-wrap leading-normal">
                                                {renderPreviewText(content, 3000)}
                                            </div>
                                            {(uploadedMedia.length > 0 || mediaFiles.length > 0) && (
                                                <div className="mt-2 w-full bg-muted border-t border-b overflow-hidden relative">
                                                    <PostThumbnail src={uploadedMedia[0]?.url || filePreviews[0]} className="w-full h-auto max-h-[600px] object-contain bg-black/5" />
                                                </div>
                                            )}
                                            <div className="px-4 py-2 border-t mt-2 flex justify-between text-muted-foreground text-xs font-semibold">
                                                <span>👍 Like</span><span>💬 Comment</span><span>🔁 Repost</span><span>✈️ Send</span>
                                            </div>
                                        </div>
                                    )}

                                    {(previewPlatform === 'instagram' || previewPlatform === 'all') && (
                                        <div className="w-full max-w-md mx-auto bg-background text-foreground border rounded-xl shadow-sm overflow-hidden font-sans">
                                            <div className="p-3 flex items-center gap-3">
                                                <div className="h-8 w-8 rounded-full bg-pink-500 p-[1.5px]">
                                                    <div className="h-full w-full rounded-full bg-background p-[1.5px]">
                                                        <div className="h-full w-full rounded-full bg-gray-200 overflow-hidden">
                                                            {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="h-full w-full object-cover" />}
                                                        </div>
                                                    </div>
                                                </div>
                                                <span className="font-semibold text-sm">{(user?.user_metadata as any)?.preferred_username || user?.email?.split("@")[0] || "your_username"}</span>
                                            </div>
                                            {(uploadedMedia.length > 0 || mediaFiles.length > 0) ? (
                                                <div className="w-full bg-muted border-y flex items-center justify-center">
                                                    <PostThumbnail src={uploadedMedia[0]?.url || filePreviews[0]} className="w-full h-auto max-h-[600px] object-contain bg-black/5" />
                                                </div>
                                            ) : (
                                                <div className="aspect-square bg-muted flex flex-col items-center justify-center text-gray-400 p-8 text-center border-y">
                                                    <ImageIcon className="h-12 w-12 mb-2 opacity-20" />
                                                    <p className="text-xs">Instagram requires an image or video</p>
                                                </div>
                                            )}
                                            <div className="p-3">
                                                <div className="flex gap-4 mb-2">
                                                    <svg aria-label="Like" height="24" role="img" viewBox="0 0 24 24" width="24"><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.956-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175 1.23 1.794 1.242 1.888.085-.67.48-1.545 1.242-2.31 1.233-1.24 2.094-1.523 3.425-1.519Z" fill="none" stroke="currentColor" strokeWidth="2"></path></svg>
                                                    <svg aria-label="Comment" height="24" role="img" viewBox="0 0 24 24" width="24"><path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                </div>
                                                <div className="text-sm">
                                                    <span className="font-semibold mr-2">{(user?.user_metadata as any)?.preferred_username || user?.email?.split("@")[0] || "your_username"}</span>
                                                    <span className="whitespace-pre-wrap">{renderPreviewText(content, 2200)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {(previewPlatform === 'threads' || previewPlatform === 'all') && (
                                        <div className="space-y-0 w-full max-w-md mx-auto">
                                            {/* Primary Post */}
                                            <div className="bg-background text-foreground p-4 font-sans border border-gray-100 rounded-t-xl shadow-sm relative">
                                                <div className="flex gap-3 relative">
                                                    {/* Connection Line */}
                                                    {firstComment && (
                                                        <div className="absolute left-[18px] top-12 bottom-[-16px] w-[2px] bg-gray-200 z-0"></div>
                                                    )}

                                                    <div className="h-9 w-9 rounded-full bg-gray-200 shrink-0 overflow-hidden z-10 border-2 border-white relative">
                                                        {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="h-full w-full object-cover" />}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex justify-between items-center mb-1">
                                                            <div className="font-semibold text-sm">{(user?.user_metadata as any)?.preferred_username || user?.email?.split("@")[0] || "your_username"}</div>
                                                            <div className="text-gray-400 text-xs">now</div>
                                                        </div>
                                                        <div className="text-[15px] leading-snug whitespace-pre-wrap break-words text-foreground">
                                                            {renderPreviewText(content, 500)}
                                                        </div>
                                                        {(uploadedMedia.length > 0 || mediaFiles.length > 0) && (
                                                            <div className="mt-3 rounded-xl overflow-hidden border border-gray-100 w-full min-h-[50px] bg-muted flex items-center justify-center">
                                                                <PostThumbnail src={uploadedMedia[0]?.url || filePreviews[0]} className="w-full h-auto max-h-[600px] object-contain bg-black/5" />
                                                            </div>
                                                        )}
                                                        <div className="flex gap-4 mt-3 text-foreground opacity-60">
                                                            <svg aria-label="Like" height="18" role="img" viewBox="0 0 24 24" width="18"><path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.956-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175 1.23 1.794 1.242 1.888.085-.67.48-1.545 1.242-2.31 1.233-1.24 2.094-1.523 3.425-1.519Z" fill="none" stroke="currentColor" strokeWidth="2"></path></svg>
                                                            <svg aria-label="Comment" height="18" role="img" viewBox="0 0 24 24" width="18"><path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" fill="none" stroke="currentColor" strokeLinejoin="round" strokeWidth="2"></path></svg>
                                                            <svg aria-label="Repost" height="18" role="img" viewBox="0 0 24 24" width="18"><path d="M19.998 9.497a1 1 0 0 0-1 1v4.228a3.274 3.274 0 0 1-3.27 3.27h-5.313l1.791-1.787a1 1 0 0 0-1.412-1.416L7.29 18.287a1.004 1.004 0 0 0-.294.707v.001c0 .023.012.042.013.065a.923.923 0 0 0 .281.643l3.502 3.504a1 1 0 0 0 1.414-1.414l-1.797-1.798h5.318a5.276 5.276 0 0 0 5.27-5.27v-4.228a1 1 0 0 0-1-1Zm-6.41-3.496-1.795 1.795a1 1 0 1 0 1.414 1.414l3.5-3.5a1.003 1.003 0 0 0 0-1.417l-3.5-3.5a1 1 0 0 0-1.414 1.414l1.794 1.794H8.27A5.277 5.277 0 0 0 3 9.271V13.5a1 1 0 0 0 2 0V9.271a3.275 3.275 0 0 1 3.271-3.27Z" fill="currentColor"></path></svg>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Threaded Reply (Post 2) */}
                                            {firstComment && (
                                                <div className="bg-background text-foreground p-4 pt-0 font-sans border-x border-b border-gray-100 rounded-b-xl shadow-sm relative overflow-hidden">
                                                    <div className="flex gap-3">
                                                        <div className="h-9 w-9 rounded-full bg-gray-200 shrink-0 overflow-hidden z-10 border-2 border-white relative">
                                                            {user?.user_metadata?.avatar_url && <img src={user.user_metadata.avatar_url} className="h-full w-full object-cover" />}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <div className="font-semibold text-sm">{(user?.user_metadata as any)?.preferred_username || user?.email?.split("@")[0] || "your_username"}</div>
                                                            </div>
                                                            <div className="text-[15px] leading-snug whitespace-pre-wrap break-words text-foreground pr-4">
                                                                {renderPreviewText(firstComment, 500)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Save Comment Modal */}
            {isSaveCommentModalOpen && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-md shadow-2xl border-2">
                        <CardHeader className="border-b bg-muted/20 pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle>Save Threaded Reply</CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setIsSaveCommentModalOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label>Template Name</Label>
                                <Input
                                    placeholder="e.g. My Viral Reply"
                                    value={newCommentName}
                                    onChange={e => setNewCommentName(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Folder / Category</Label>
                                <div className="space-y-1">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Type new or select..."
                                            value={newCommentFolder}
                                            onChange={e => setNewCommentFolder(e.target.value)}
                                            className="flex-1"
                                        />
                                        {availableCommentFolders.length > 0 && (
                                            <select
                                                className="w-[120px] rounded-md border text-sm bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                                                onChange={(e) => {
                                                    if (e.target.value) setNewCommentFolder(e.target.value);
                                                }}
                                                value=""
                                            >
                                                <option value="" disabled>Select...</option>
                                                {availableCommentFolders.map(f => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Type a new name to create a new folder.</p>
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsSaveCommentModalOpen(false)}>Cancel</Button>
                                <Button onClick={handleConfirmSaveComment} disabled={!newCommentName || !newCommentFolder || isSavingComment}>
                                    {isSavingComment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Save to Library
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

function LibraryModal({
    isOpen,
    onClose,
    initialTab = 'media',
    platform = 'linkedin',
    commentTemplates = [],
    onSelectMedia,
    onSelectComment
}: {
    isOpen: boolean | string,
    onClose: () => void,
    initialTab?: 'media' | 'comments',
    platform?: 'threads' | 'linkedin' | 'instagram',
    commentTemplates?: any[],
    onSelectMedia: (items: { url: string, type: string }[]) => void,
    onSelectComment: (text: string) => void
}) {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMedia, setSelectedMedia] = useState<any[]>([]);
    const { user } = useAuthStore();

    // Reset tab when opening
    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Fetch Media
    useEffect(() => {
        if (isOpen && user && activeTab === 'media') {
            setLoading(true);
            storageService.getMediaLibrary(user.id).then(data => {
                setItems(data || []);
            }).catch(console.error).finally(() => setLoading(false));
        }
    }, [isOpen, user, activeTab]);

    const handleMediaSubmit = () => {
        const formatted = selectedMedia.map(item => {
            const isR2 = item.metadata?.provider === 'r2' || item.storage_bucket === 'queued-social';
            const url = isR2
                ? `r2://${item.storage_bucket}/${item.file_path}`
                : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${item.storage_bucket}/${item.file_path}`;
            return { url, type: item.mime_type || 'image/jpeg' };
        });
        onSelectMedia(formatted);
        setSelectedMedia([]);
    };

    const toggleMediaItem = (item: any) => {
        setSelectedMedia(prev =>
            prev.find(p => p.id === item.id)
                ? prev.filter(p => p.id !== item.id)
                : [...prev, item]
        );
    };

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <Card className="w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-muted/40 rounded-t-xl">
                    <h2 className="text-xl font-bold">Library</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col">
                    <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col">
                        <div className="px-4 pt-4">
                            <TabsList className="w-full justify-start">
                                <TabsTrigger value="media" className="flex-1">Media Library</TabsTrigger>
                                <TabsTrigger value="comments" className="flex-1">
                                    {platform === 'threads' ? 'Threaded Replies' : 'Comment Templates'}
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="media" className="flex-1 overflow-y-auto p-4 min-h-0">
                            {loading ? (
                                <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                            ) : items.length === 0 ? (
                                <div className="text-center p-8 text-muted-foreground">
                                    No media found. Upload media to see it here.
                                    <br /><span className="text-xs opacity-70">(Note: Only files uploaded via this app appear here)</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                    {items.map(item => {
                                        const isSelected = !!selectedMedia.find(s => s.id === item.id);
                                        const isR2 = item.metadata?.provider === 'r2' || item.storage_bucket === 'queued-social';
                                        const src = isR2
                                            ? `r2://${item.storage_bucket}/${item.file_path}`
                                            : `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/${item.storage_bucket}/${item.file_path}`;

                                        return (
                                            <div
                                                key={item.id}
                                                className={`relative aspect-square rounded-lg border cursor-pointer overflow-hidden group ${isSelected ? 'ring-2 ring-primary' : ''}`}
                                                onClick={() => toggleMediaItem(item)}
                                            >
                                                <PostThumbnail src={src} className="w-full h-full object-cover" />
                                                <div className={`absolute inset-0 bg-black/20 flex items-center justify-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                                    {isSelected && <div className="bg-primary text-white rounded-full p-1"><X className="h-4 w-4 rotate-45" /></div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </TabsContent>

                        <TabsContent value="comments" className="flex-1 overflow-y-auto p-4 min-h-0">
                            {commentTemplates && commentTemplates.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {commentTemplates.map(t => (
                                        <div key={t.id} className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => onSelectComment(t.content?.text || '')}>
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="font-semibold">{t.name}</span>
                                                <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">{t.category || 'General'}</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground line-clamp-3">{t.content?.text}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center p-8 text-muted-foreground">No comment templates found. Save some comments to see them here!</div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>

                {activeTab === 'media' && (
                    <div className="p-4 border-t bg-muted/10 flex justify-end gap-2">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button onClick={handleMediaSubmit} disabled={selectedMedia.length === 0}>
                            Insert Media ({selectedMedia.length})
                        </Button>
                    </div>
                )}
            </Card>
        </div>
    );
}
