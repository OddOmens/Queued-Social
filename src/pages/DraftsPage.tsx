import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getPosts, deletePost, updatePost } from '@/services/posts';
import { Post } from '@/types/data';
import { Loader2, Trash2, Send, Calendar } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DraftsPage() {
    const [drafts, setDrafts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchDrafts = async () => {
        setLoading(true);
        try {
            const data = await getPosts('draft');
            setDrafts(data);
        } catch (error) {
            console.error('Failed to fetch drafts', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDrafts();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this draft?')) return;
        try {
            await deletePost(id);
            setDrafts(drafts.filter(d => d.id !== id));
        } catch (error) {
            alert('Failed to delete draft');
        }
    };

    // const handleEdit = (draft: Post) => {
    //   // TODO: Navigate to PublishPage with state? 
    //   // Or update PublishPage to accept an ID param.
    //   // For simplicity, we just console log for now or implement a basic quick publish.
    //   console.log('Edit draft', draft);
    // };

    return (
        <div className="h-full flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Drafts</h1>
                <p className="text-muted-foreground mt-2">Manage your unfinished posts.</p>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : drafts.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-lg bg-muted/20 p-12 text-center">
                    <h3 className="text-xl font-semibold">No drafts yet</h3>
                    <p className="text-muted-foreground mt-2 mb-6">Create a draft from the Publish page to save your work for later.</p>
                    <Button onClick={() => navigate('/publish')}>Create New Post</Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {drafts.map(draft => (
                        <Card key={draft.id}>
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold px-2 py-1 bg-secondary rounded uppercase">{draft.platform}</span>
                                        <span className="text-xs text-muted-foreground">{draft.updatedAt.toLocaleDateString()}</span>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(draft.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <p className="line-clamp-3 text-sm mb-4">
                                    {draft.content?.text || <span className="italic text-muted-foreground">No text content</span>}
                                </p>
                                <div className="flex gap-2 mt-auto">
                                    <Button variant="outline" className="w-full text-xs" onClick={() => navigate(`/publish?draft=${draft.id}`)}>
                                        Edit & Publish
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
