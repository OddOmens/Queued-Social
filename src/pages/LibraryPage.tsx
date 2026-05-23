import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { getTemplates, deleteTemplate, updateTemplate, getFirstThreads, deleteFirstThread, updateFirstThread, createTemplate, createFirstThread } from '@/services/posts';
import { getMediaLibrary, uploadMedia, deleteMedia, getSignedUrl, syncWithR2 } from '@/services/storage';
import { Template, FirstThread } from '@/types/data';
import { useAuthStore } from '@/stores/auth';
import {
    Loader2, Copy, Trash2, Edit, Lightbulb, FileText, BookOpen, Hammer,
    MessageCircleQuestion, MessageSquareQuote, ListTodo, Clapperboard,
    MessageCircle, Plus, X, FolderOpen, Image as ImageIcon, Upload, RefreshCw,
    Clock, Zap, LayoutTemplate
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface MediaFile {
    id: string;
    user_id: string;
    filename: string;
    original_filename: string;
    file_path: string;
    file_size: number;
    mime_type: string;
    storage_bucket: string;
    metadata: any;
    created_at: string;
}

export default function LibraryPage() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('templates');

    // Data State
    const [templates, setTemplates] = useState<Template[]>([]);
    const [threads, setThreads] = useState<FirstThread[]>([]);
    const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
    const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

    // UI State
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [uploading, setUploading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Creation Modal (Templates/Threads)
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [newItem, setNewItem] = useState({
        name: '',
        category: '',
        content: '', // Main text or Hook
        reply: '', // For Threads only
        platform: 'linkedin' // For Templates
    });
    const [isCreating, setIsCreating] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Bulk Import Modal
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [bulkContent, setBulkContent] = useState('');
    const [bulkCategory, setBulkCategory] = useState('General');

    // Load Data based on Tab
    useEffect(() => {
        loadData();
    }, [user, activeTab]);

    const loadData = async () => {
        if (!user) return;
        setLoading(true);
        try {
            if (activeTab === 'templates') {
                const data = await getTemplates();
                setTemplates(data || []);
            } else if (activeTab === 'threads') {
                const data = await getFirstThreads();
                setThreads(data || []);
            } else if (activeTab === 'media') {
                const files = await getMediaLibrary(user.id, 100);
                setMediaFiles(files || []);
                // Load previews
                const urls: Record<string, string> = {};
                for (const file of files || []) {
                    if (file.mime_type.startsWith('image/')) {
                        const url = await getSignedUrl(file.file_path);
                        if (url) urls[file.id] = url;
                    }
                }
                setPreviewUrls(urls);
            }
        } catch (e) {
            console.error('Error loading library data:', e);
        } finally {
            setLoading(false);
        }
    };

    // Derived Categories
    const currentItems = activeTab === 'templates' ? templates : threads;
    const availableCategories = Array.from(new Set(currentItems.map((i: any) => i.category || 'Uncategorized'))).sort();

    // Default Categories (Templates)
    const templateCategories = [
        { id: 'Tip', label: 'Tip', icon: <Lightbulb className="h-4 w-4" /> }, // corrected lightbulb case if needed, checking imports usually Lightbulb
        { id: 'Case Study', label: 'Case Study', icon: <FileText className="h-4 w-4" /> },
        { id: 'Story', label: 'Story', icon: <BookOpen className="h-4 w-4" /> },
        { id: 'How-to', label: 'How-to', icon: <Hammer className="h-4 w-4" /> },
        { id: 'Question', label: 'Question', icon: <MessageCircleQuestion className="h-4 w-4" /> },
        { id: 'Opinion', label: 'Opinion', icon: <MessageSquareQuote className="h-4 w-4" /> },
        { id: 'List', label: 'List', icon: <ListTodo className="h-4 w-4" /> },
        { id: 'Behind the Scenes', label: 'Behind the Scenes', icon: <Clapperboard className="h-4 w-4" /> },
    ];

    // Handlers
    const handleSave = async () => {
        // For templates, content is required. For threads, reply is required.
        if (activeTab === 'templates' && !newItem.name && !newItem.content) return;
        if (activeTab === 'threads' && !newItem.name && !newItem.reply) return;

        setIsCreating(true);
        try {
            if (activeTab === 'templates') {
                if (editingId) {
                    await updateTemplate(editingId, {
                        name: newItem.name,
                        category: newItem.category || 'General',
                        platform: newItem.platform as any || 'linkedin',
                        content: { text: newItem.content }
                    });
                } else {
                    await createTemplate({
                        name: newItem.name,
                        category: newItem.category || 'General',
                        platform: newItem.platform as any || 'linkedin',
                        content: { text: newItem.content }
                    });
                }
            } else {
                if (editingId) {
                    await updateFirstThread(editingId, {
                        name: newItem.name,
                        category: newItem.category || 'General',
                        hookText: newItem.content || '',
                        firstComment: newItem.reply
                    });
                } else {
                    await createFirstThread({
                        name: newItem.name || 'Untitled Thread',
                        category: newItem.category || 'General',
                        hookText: newItem.content || '', // Allow empty
                        firstComment: newItem.reply
                    });
                }
            }
            await loadData();
            handleCloseModal();
        } catch (e) {
            console.error(e);
            alert('Failed to save item');
        } finally {
            setIsCreating(false);
        }
    };

    const handleEdit = (item: any) => {
        setEditingId(item.id);
        if (activeTab === 'templates') {
            setNewItem({
                name: item.name,
                category: item.category,
                content: item.content?.text || '',
                reply: '',
                platform: item.platform || 'linkedin'
            });
        } else {
            setNewItem({
                name: item.name,
                category: item.category,
                content: item.hookText || '',
                reply: item.firstComment || '',
                platform: 'linkedin'
            });
        }
        setIsCreateOpen(true);
    };

    const handleCloseModal = () => {
        setIsCreateOpen(false);
        setEditingId(null);
        setNewItem({ name: '', category: '', content: '', reply: '', platform: 'linkedin' });
    };

    const handleBulkImport = async () => {
        if (!bulkContent.trim()) return;
        setIsCreating(true);
        try {
            const lines = bulkContent.split('\n').filter(line => line.trim());
            const threadsToCreate = lines.map(line => ({
                name: line.substring(0, 30) + (line.length > 30 ? '...' : ''), // Auto-generate name
                category: bulkCategory || 'General',
                hookText: '',
                firstComment: line.trim()
            }));

            // Import dynamically to avoid top-level dependency if possible, or just assume it's there
            // We need to add bulkCreateFirstThreads to imports
            const { bulkCreateFirstThreads } = await import('@/services/posts');
            await bulkCreateFirstThreads(threadsToCreate);

            await loadData();
            setIsBulkImportOpen(false);
            setBulkContent('');
        } catch (e) {
            console.error(e);
            alert('Failed to import threads');
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteItem = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this item?')) return;
        try {
            if (activeTab === 'templates') {
                await deleteTemplate(id);
                setTemplates(prev => prev.filter(p => p.id !== id));
            } else {
                await deleteFirstThread(id);
                setThreads(prev => prev.filter(p => p.id !== id));
            }
        } catch (e) { console.error(e); }
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0 || !user) return;
        setUploading(true);
        try {
            for (const file of Array.from(files)) await uploadMedia(file, user.id);
            await loadData(); // Reload media
        } catch (e) { console.error(e); } finally { setUploading(false); }
    };

    const handleDeleteMedia = async (fileId: string, filePath: string) => {
        if (!confirm('Delete this image?')) return;
        setDeleting(fileId);
        try {
            await deleteMedia(fileId, filePath);
            setMediaFiles(prev => prev.filter(f => f.id !== fileId));
        } catch (e) { console.error(e); } finally { setDeleting(null); }
    };

    const handleSync = async () => {
        if (!user) return;
        setSyncing(true);
        try {
            await syncWithR2(user.id);
            await loadData();
        } catch (e) { console.error(e); } finally { setSyncing(false); }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="h-full flex flex-col gap-6">
            <div className="flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Library</h1>
                    <p className="text-muted-foreground mt-2">Manage your reusable content, templates, and media.</p>
                </div>
                <div className="flex gap-2">
                    {activeTab === 'media' ? (
                        <div className="flex items-center gap-2">
                            <Button variant="outline" onClick={handleSync} disabled={syncing || loading}>
                                <RefreshCw className={cn("h-4 w-4 mr-2", syncing && "animate-spin")} /> Use Existing Cloud Media
                            </Button>
                            <label>
                                <Input type="file" className="hidden" accept="image/*,video/*" multiple onChange={handleMediaUpload} disabled={uploading} />
                                <Button className="cursor-pointer" asChild disabled={uploading}>
                                    <span>
                                        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                                        Upload Media
                                    </span>
                                </Button>
                            </label>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            {activeTab === 'threads' && (
                                <Button variant="outline" onClick={() => setIsBulkImportOpen(true)} className="gap-2">
                                    <ListTodo className="h-4 w-4" /> Bulk Import
                                </Button>
                            )}
                            <Button onClick={() => { setEditingId(null); setIsCreateOpen(true); }} className="gap-2">
                                <Plus className="h-4 w-4" /> New {activeTab === 'templates' ? 'Template' : 'Thread'}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
                <TabsList className="w-full max-w-md grid grid-cols-3 mb-6">
                    <TabsTrigger value="templates">Templates</TabsTrigger>
                    <TabsTrigger value="threads">First Threads</TabsTrigger>
                    <TabsTrigger value="media">Media Assets</TabsTrigger>
                </TabsList>

                <TabsContent value="templates" className="flex-1">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        <Button variant={selectedCategory === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory('all')} className="rounded-full">All</Button>
                        {availableCategories.map((cat: any) => (
                            <Button key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(cat)} className="rounded-full gap-2">
                                <FolderOpen className="h-3 w-3" /> {cat}
                            </Button>
                        ))}
                    </div>

                    {/* Content Grid */}
                    {loading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                    ) : templates.length === 0 ? (
                        <div className="text-center p-12 border-2 border-dashed rounded-lg bg-muted/10">
                            <h3 className="text-lg font-semibold">No templates yet</h3>
                            <Button variant="outline" className="mt-4" onClick={() => setIsCreateOpen(true)}>Create Template</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                            {templates.filter(t => selectedCategory === 'all' || t.category === selectedCategory).map(item => (
                                <Card key={item.id} className="cursor-pointer hover:border-primary transition-colors flex flex-col group relative overflow-hidden"
                                    onClick={() => navigate(`/publish?template=${item.id}`)}>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-orange-500/20" />
                                    <CardHeader className="pb-2 pl-6">
                                        <div className="flex justify-between items-start">
                                            <CardTitle className="text-lg truncate pr-2">{item.name}</CardTitle>
                                            {item.platform && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase shrink-0">{item.platform}</span>}
                                        </div>
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><FolderOpen className="h-3 w-3" />{item.category || 'General'}</span>
                                    </CardHeader>
                                    <CardContent className="flex-1 flex flex-col pl-6">
                                        <p className="line-clamp-3 text-sm text-muted-foreground flex-1">{item.content?.text}</p>
                                        <div className="mt-4 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => handleDeleteItem(item.id, e)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                            <Button variant="ghost" size="sm" className="h-8 gap-2"><Copy className="h-3 w-3" /> Use</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="threads" className="flex-1">
                    {/* Same layout as templates for now but iterating threads */}
                    <div className="flex flex-wrap gap-2 mb-6">
                        <Button variant={selectedCategory === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory('all')} className="rounded-full">All</Button>
                        {availableCategories.map((cat: any) => (
                            <Button key={cat} variant={selectedCategory === cat ? 'default' : 'outline'} size="sm" onClick={() => setSelectedCategory(cat)} className="rounded-full gap-2">
                                <FolderOpen className="h-3 w-3" /> {cat}
                            </Button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                    ) : threads.length === 0 ? (
                        <div className="text-center p-12 border-2 border-dashed rounded-lg bg-muted/10">
                            <h3 className="text-lg font-semibold">No first threads yet</h3>
                            <Button variant="outline" className="mt-4" onClick={() => setIsCreateOpen(true)}>Create Thread</Button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-10">
                            {threads.filter(t => selectedCategory === 'all' || t.category === selectedCategory).map(item => (
                                <Card key={item.id} className="cursor-pointer hover:border-primary transition-colors flex flex-col group relative overflow-hidden"
                                    onClick={() => navigate(`/publish?hook=${item.id}`)}>
                                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500/20" />
                                    <CardHeader className="pb-2 pl-6">
                                        <CardTitle className="text-lg truncate">{item.name}</CardTitle>
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><FolderOpen className="h-3 w-3" />{item.category || 'General'}</span>
                                    </CardHeader>
                                    <CardContent className="flex-1 flex flex-col pl-6">
                                        {item.hookText && <p className="line-clamp-3 text-sm text-muted-foreground flex-1 italic mb-2">"{item.hookText}"</p>}
                                        {item.firstComment && (
                                            <div className="flex items-start gap-2 flex-1">
                                                <MessageCircle className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
                                                <p className="line-clamp-4 text-sm font-medium">{item.firstComment}</p>
                                            </div>
                                        )}
                                        <div className="mt-4 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleEdit(item); }}>
                                                <Edit className="h-3 w-3" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => handleDeleteItem(item.id, e)}><Trash2 className="h-3 w-3 text-destructive" /></Button>
                                            <Button variant="ghost" size="sm" className="h-8 gap-2"><Copy className="h-3 w-3" /> Use</Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="media" className="flex-1">
                    {loading ? (
                        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
                    ) : mediaFiles.length === 0 ? (
                        <div className="text-center p-12 border-2 border-dashed rounded-lg bg-muted/10">
                            <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                            <h3 className="text-lg font-semibold">No media assets</h3>
                            <p className="text-sm text-muted-foreground">Upload images/videos to reuse them.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 pb-10">
                            {mediaFiles.map(file => (
                                <Card key={file.id} className="overflow-hidden group relative bg-muted/30">
                                    <div className="aspect-square relative flex items-center justify-center bg-black/5">
                                        {file.mime_type.startsWith('image/') && previewUrls[file.id] ? (
                                            <img src={previewUrls[file.id]} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="text-xs text-muted-foreground uppercase font-bold flex flex-col items-center"><ImageIcon className="h-8 w-8 mb-2 opacity-50" />{file.mime_type.split('/')[0]}</div>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Button variant="destructive" size="sm" onClick={() => handleDeleteMedia(file.id, file.file_path)} disabled={deleting === file.id}>
                                                {deleting === file.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="p-2 text-xs truncate text-muted-foreground flex justify-between">
                                        <span className="truncate flex-1" title={file.original_filename}>{file.original_filename}</span>
                                        <span>{formatFileSize(file.file_size)}</span>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* Combined Create Modal */}
            {isCreateOpen && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-lg shadow-2xl border-2">
                        <CardHeader className="border-b bg-muted/20 pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle>{editingId ? 'Edit' : 'Create New'} {activeTab === 'templates' ? 'Template' : 'Thread'}</CardTitle>
                                <Button variant="ghost" size="sm" onClick={handleCloseModal}><X className="h-4 w-4" /></Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label>Name</Label>
                                <Input placeholder="e.g. Weekly Update" value={newItem.name} onChange={e => setNewItem({ ...newItem, name: e.target.value })} />
                            </div>

                            <div className="space-y-2">
                                <Label>Folder / Category</Label>
                                <div className="space-y-1">
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Type new or select..."
                                            value={newItem.category}
                                            onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                                            className="flex-1"
                                        />
                                        {availableCategories.length > 0 && (
                                            <select
                                                className="w-[120px] rounded-md border text-sm bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                                                onChange={(e) => {
                                                    if (e.target.value) setNewItem({ ...newItem, category: e.target.value });
                                                }}
                                                value=""
                                            >
                                                <option value="" disabled>Select...</option>
                                                {availableCategories.map((c: any) => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">Select an existing folder or type a new name.</p>
                                </div>
                            </div>

                            {activeTab === 'templates' && (
                                <div className="space-y-2">
                                    <Label>Platform</Label>
                                    <select
                                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
                                        value={newItem.platform}
                                        onChange={e => setNewItem({ ...newItem, platform: e.target.value })}
                                    >
                                        <option value="linkedin">LinkedIn</option>
                                        <option value="threads">Threads</option>
                                        <option value="instagram">Instagram</option>
                                    </select>
                                </div>
                            )}

                            {activeTab === 'templates' && (
                                <div className="space-y-2">
                                    <Label>Content</Label>
                                    <Textarea
                                        placeholder="Write your main post content here..."
                                        className="min-h-[100px]"
                                        value={newItem.content}
                                        onChange={e => setNewItem({ ...newItem, content: e.target.value })}
                                    />
                                </div>
                            )}

                            {activeTab === 'threads' && (
                                <div className="space-y-2">
                                    <Label>Thread Reply / First Comment</Label>
                                    <Textarea
                                        placeholder="This will be posted as the first comment / threaded reply..."
                                        className="min-h-[120px]"
                                        value={newItem.reply}
                                        onChange={e => setNewItem({ ...newItem, reply: e.target.value })}
                                    />
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-2">
                                <Button variant="ghost" onClick={handleCloseModal}>Cancel</Button>
                                <Button onClick={handleSave} disabled={!newItem.name || (activeTab === 'templates' && !newItem.content) || (activeTab === 'threads' && !newItem.reply) || isCreating}>
                                    {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    {editingId ? 'Save Changes' : `Create ${activeTab === 'templates' ? 'Template' : 'Thread'}`}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            {/* Bulk Import Modal */}
            {isBulkImportOpen && (
                <div className="absolute inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <Card className="w-full max-w-lg shadow-2xl border-2">
                        <CardHeader className="border-b bg-muted/20 pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle>Bulk Import Threads</CardTitle>
                                <Button variant="ghost" size="sm" onClick={() => setIsBulkImportOpen(false)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <Label>Select Folder</Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Type new or select..."
                                        value={bulkCategory}
                                        onChange={e => setBulkCategory(e.target.value)}
                                        className="flex-1"
                                    />
                                    {availableCategories.length > 0 && (
                                        <select
                                            className="w-[120px] rounded-md border text-sm bg-background px-2 focus:outline-none focus:ring-2 focus:ring-ring"
                                            onChange={(e) => {
                                                if (e.target.value) setBulkCategory(e.target.value);
                                            }}
                                            value=""
                                        >
                                            <option value="" disabled>Select...</option>
                                            {availableCategories.map((c: any) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Replies (One per line)</Label>
                                <Textarea
                                    placeholder="Paste your list of replies here. Each new line will be a separate thread."
                                    className="min-h-[200px] font-mono text-sm"
                                    value={bulkContent}
                                    onChange={e => setBulkContent(e.target.value)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Total lines: {bulkContent.split('\n').filter(l => l.trim()).length}
                                </p>
                            </div>

                            <div className="pt-4 flex justify-end gap-2">
                                <Button variant="ghost" onClick={() => setIsBulkImportOpen(false)}>Cancel</Button>
                                <Button onClick={handleBulkImport} disabled={!bulkContent.trim() || isCreating}>
                                    {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Import Threads
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
