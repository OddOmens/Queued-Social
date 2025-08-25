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
          <h1 className="text-3xl font-bold text-gray-900">Posts</h1>
          <p className="mt-2 text-gray-600">
            Create, edit, and manage your social media posts.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value as Platform)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="threads">Threads</option>
            <option value="twitter">Twitter</option>
            <option value="instagram">Instagram</option>
          </select>
          <button 
            onClick={() => setShowEditor(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
          >
            Create Post
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="border-b border-gray-200">
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
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                filter === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Posts list */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              Failed to load posts. Please try refreshing the page.
            </div>
          ) : isLoading ? (
            <div className="text-center py-12">
              <div className="text-gray-500">Loading posts...</div>
            </div>
          ) : posts && posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <div key={post.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {post.platform}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          post.status === 'published' 
                            ? 'bg-green-100 text-green-800'
                            : post.status === 'scheduled'
                            ? 'bg-blue-100 text-blue-800'
                            : post.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {post.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-900 mb-2">
                        {post.content.text || 'Media post'}
                      </p>
                      <div className="text-xs text-gray-500">
                        Scheduled for: {new Date(post.scheduledTime).toLocaleString()}
                        {post.publishedAt && (
                          <span className="ml-4">
                            Published: {new Date(post.publishedAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {post.errorMessage && (
                        <div className="text-xs text-red-600 mt-1">
                          Error: {post.errorMessage}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        disabled={deletePostMutation.isPending}
                        className="text-red-600 hover:text-red-800 text-sm"
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
              <div className="text-gray-400 text-6xl mb-4">📝</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {filter === 'all' ? 'No posts yet' : `No ${filter} posts`}
              </h3>
              <p className="text-gray-500 mb-4">
                {filter === 'all' 
                  ? 'Get started by creating your first post.'
                  : `You don't have any ${filter} posts.`
                }
              </p>
              <button 
                onClick={() => setShowEditor(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
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