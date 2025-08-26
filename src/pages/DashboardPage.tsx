import { useAuthStore } from '@/stores/auth'
import { useDashboardStats } from '@/hooks/useStats'
import { Link } from 'react-router-dom'

export function DashboardPage() {
  const { user } = useAuthStore()
  const { data: stats, isLoading, error } = useDashboardStats()

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg">
          Failed to load dashboard data. Please try refreshing the page.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center lg:text-left">
        <h1 className="text-4xl lg:text-5xl font-bold gradient-text mb-2">
          Welcome back, {user?.user_metadata?.full_name || user?.email?.split('@')[0]}!
        </h1>
        <p className="text-lg text-secondary max-w-2xl">
          Here's what's happening with your social media scheduling.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card-hover">
          <div className="p-8">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v16a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-6 flex-1">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      Scheduled Posts
                    </p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {isLoading ? <div className="loading-skeleton h-8 w-16"></div> : stats?.scheduledPosts || 0}
                    </p>
                  </div>
                  <span className="text-xs text-green-400 font-medium px-2 py-1 bg-green-900/30 rounded-full">
                    +12%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-hover">
          <div className="p-8">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="ml-6 flex-1">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      Published Today
                    </p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {isLoading ? <div className="loading-skeleton h-8 w-16"></div> : stats?.publishedToday || 0}
                    </p>
                  </div>
                  <span className="text-xs text-blue-400 font-medium px-2 py-1 bg-blue-900/30 rounded-full">
                    Today
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card-hover">
          <div className="p-8">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
              </div>
              <div className="ml-6 flex-1">
                <div className="flex items-baseline justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                      Connected Platforms
                    </p>
                    <p className="text-3xl font-bold text-white mt-1">
                      {isLoading ? <div className="loading-skeleton h-8 w-16"></div> : stats?.connectedPlatforms || 0}
                    </p>
                  </div>
                  <span className="text-xs text-purple-400 font-medium px-2 py-1 bg-purple-900/30 rounded-full">
                    Active
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-2xl font-bold text-white">
                Recent Activity
              </h3>
              <p className="text-gray-400 mt-1">Your latest social media posts</p>
            </div>
            <Link 
              to="/posts" 
              className="btn-ghost text-sm inline-flex items-center space-x-2"
            >
              <span>View all posts</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          <div className="space-y-1">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="loading-skeleton w-12 h-12 rounded-xl"></div>
                    <div className="flex-1 space-y-2">
                      <div className="loading-skeleton h-4 w-3/4"></div>
                      <div className="loading-skeleton h-3 w-1/2"></div>
                    </div>
                    <div className="loading-skeleton h-6 w-16 rounded-full"></div>
                  </div>
                ))}
              </div>
            ) : stats?.recentPosts && stats.recentPosts.length > 0 ? (
              <div className="space-y-1">
                {stats.recentPosts.map((post, index) => (
                  <div key={post.id} className="flex items-center space-x-4 p-4 rounded-xl hover:bg-gray-800/50 transition-colors group">
                    <div className="flex-shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-700 to-gray-800 rounded-xl flex items-center justify-center">
                        <span className="text-lg">
                          {post.platform === 'threads' ? '🧵' : post.platform === 'twitter' ? '🐦' : post.platform === 'instagram' ? '📷' : '📱'}
                        </span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate group-hover:text-blue-300 transition-colors">
                            {post.content.text || 'Media post'}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <p className="text-xs text-gray-400 capitalize">
                              {post.platform}
                            </p>
                            <span className="text-xs text-gray-500">•</span>
                            <p className="text-xs text-gray-400">
                              {new Date(post.scheduledTime).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <span className={`ml-4 inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${
                          post.status === 'published' 
                            ? 'bg-green-900/50 text-green-300 border border-green-800/50'
                            : post.status === 'scheduled'
                            ? 'bg-blue-900/50 text-blue-300 border border-blue-800/50'
                            : post.status === 'failed'
                            ? 'bg-red-900/50 text-red-300 border border-red-800/50'
                            : 'bg-gray-800 text-gray-300 border border-gray-700'
                        }`}>
                          {post.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
                  <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">No posts yet</h4>
                <p className="text-gray-400 mb-6 max-w-sm mx-auto">
                  Start by creating your first social media post to see your activity here.
                </p>
                <Link 
                  to="/posts" 
                  className="btn-primary inline-flex items-center space-x-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  <span>Create Your First Post</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}