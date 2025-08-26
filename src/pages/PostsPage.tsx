import { useState } from 'react'
import { usePosts, useCreatePost, useDeletePost } from '@/hooks/usePosts'
import { PostEditor } from '@/components/posts/PostEditor'
import { Platform, CreatePostRequest } from '@/types'

export function PostsPage() {
  const [showEditor, setShowEditor] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('threads')
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'published' | 'failed'>('all')
  
  const { data: posts, isLoading, error } = usePosts({
    status: filter === 'all' ? undefined : filter,
    limit: 50
  })
  
  const createPostMutation = useCreatePost()
  const deletePostMutation = useDeletePost()

  const handleCreatePost = async (request: CreatePostRequest) => {
    try {
      await createPostMutation.mutateAsync(request)
      setShowEditor(false)
    } catch (error) {
      console.error('Failed to create post:', error)
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      try {
        await deletePostMutation.mutateAsync(postId)
      } catch (error) {
        console.error('Failed to delete post:', error)
      }
    }
  }

  if (showEditor) {
    return (
      <PostEditor
        platform={selectedPlatform}
        onSave={handleCreatePost}
        onCancel={() => setShowEditor(false)}
        loading={createPostMutation.isPending}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Posts</h1>
          <p className="mt-2 text-gray-400">
            Create, edit, and manage your social media posts.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center px-3 py-2 border border-gray-700 rounded-lg text-sm bg-gray-800">
            <span className="text-gray-300">🧵 Threads</span>
          </div>
          <button 
            onClick={() => setShowEditor(true)}
            className="btn-primary"
          >
            Create Post
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'all', label: 'All Posts' },
            { key: 'scheduled', label: 'Scheduled' },
            { key: 'published', label: 'Published' },
            { key: 'failed', label: 'Failed' }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                filter === tab.key
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Posts list */}
      <div className="card">
        <div className="px-6 py-6 sm:p-8">
          {error ? (
            <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg">
              Failed to load posts. Please try refreshing the page.
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-400">Loading posts...</div>
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border border-gray-800 rounded-lg p-4 bg-gray-800/50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-white capitalize">
                          {post.platform}
                        </span>
                        <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                          post.status === 'published' 
                            ? 'bg-green-900/50 text-green-300'
                            : post.status === 'scheduled'
                            ? 'bg-blue-900/50 text-blue-300'
                            : post.status === 'failed'
                            ? 'bg-red-900/50 text-red-300'
                            : 'bg-gray-800 text-gray-300'
                        }`}>
                          {post.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-200 mb-2">
                        {post.content.text || 'Media post'}
                      </p>
                      <div className="text-xs text-gray-400">
                        Scheduled for: {new Date(post.scheduledTime).toLocaleString()}
                        {post.publishedAt && (
                          <span className="ml-4">
                            Published: {new Date(post.publishedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {post.errorMessage && (
                        <div className="text-xs text-red-400 mt-1">
                          Error: {post.errorMessage}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletePostMutation.isPending}
                        className="text-red-400 hover:text-red-300 text-sm font-medium"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <h3 className="text-lg font-medium text-white mb-2">
                {filter === 'all' ? 'No posts yet' : `No ${filter} posts`}
              </h3>
              <p className="text-gray-400 mb-4">
                {filter === 'all' 
                  ? 'Get started by creating your first post.'
                  : `You don't have any ${filter} posts.`
                }
              </p>
              <button 
                onClick={() => setShowEditor(true)}
                className="btn-primary"
              >
                Create Your First Post
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}