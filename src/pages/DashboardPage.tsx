import { useAuthStore } from '@/stores/auth'
import { useDashboardStats } from '@/hooks/useStats'
import { Link } from 'react-router-dom'
import { SchedulerDebug } from '@/components/debug/SchedulerDebug'

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
      <div>
        <h1 className="text-3xl font-bold text-white">
          Welcome back, {user?.user_metadata?.full_name || user?.email}!
        </h1>
        <p className="mt-2 text-gray-400">
          Here's what's happening with your social media scheduling.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v16a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-400 truncate">
                    Scheduled Posts
                  </dt>
                  <dd className="text-2xl font-bold text-white">
                    {isLoading ? '...' : stats?.scheduledPosts || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-400 truncate">
                    Published Today
                  </dt>
                  <dd className="text-2xl font-bold text-white">
                    {isLoading ? '...' : stats?.publishedToday || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-400 truncate">
                    Connected Platforms
                  </dt>
                  <dd className="text-2xl font-bold text-white">
                    {isLoading ? '...' : stats?.connectedPlatforms || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="px-6 py-6 sm:p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl leading-6 font-semibold text-white">
              Recent Activity
            </h3>
            <Link 
              to="/posts" 
              className="text-sm text-blue-400 hover:text-blue-300 font-medium"
            >
              View all posts
            </Link>
          </div>
          <div className="mt-5">
            {isLoading ? (
              <div className="text-sm text-gray-400">Loading recent activity...</div>
            ) : stats?.recentPosts && stats.recentPosts.length > 0 ? (
              <div className="space-y-4">
                {stats.recentPosts.map((post) => (
                  <div key={post.id} className="flex items-center justify-between py-3 border-b border-gray-800 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {post.content.text || 'Media post'}
                      </p>
                      <p className="text-xs text-gray-400">
                        {post.platform} • {new Date(post.scheduledTime).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <div className="text-sm text-gray-400 mb-4">
                  No recent activity to show. Start by creating your first post!
                </div>
                <Link 
                  to="/posts" 
                  className="btn-primary"
                >
                  Create Post
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Debug Section - Remove in production */}
      <SchedulerDebug />
    </div>
  )
}