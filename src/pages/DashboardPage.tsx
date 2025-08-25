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
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          Failed to load dashboard data. Please try refreshing the page.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">
          Welcome back, {user?.user_metadata?.full_name || user?.email}!
        </h1>
        <p className="mt-2 text-gray-600">
          Here's what's happening with your social media scheduling.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📅</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Scheduled Posts
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {isLoading ? '...' : stats?.scheduledPosts || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">✅</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Published Today
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {isLoading ? '...' : stats?.publishedToday || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-500 rounded-md flex items-center justify-center">
                  <span className="text-white text-sm font-medium">📊</span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Connected Platforms
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {isLoading ? '...' : stats?.connectedPlatforms || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Recent Activity
            </h3>
            <Link 
              to="/posts" 
              className="text-sm text-blue-600 hover:text-blue-500"
            >
              View all posts
            </Link>
          </div>
          <div className="mt-5">
            {isLoading ? (
              <div className="text-sm text-gray-500">Loading recent activity...</div>
            ) : stats?.recentPosts && stats.recentPosts.length > 0 ? (
              <div className="space-y-3">
                {stats.recentPosts.map((post) => (
                  <div key={post.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {post.content.text || 'Media post'}
                      </p>
                      <p className="text-xs text-gray-500">
                        {post.platform} • {new Date(post.scheduledTime).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
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
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-2">📝</div>
                <div className="text-sm text-gray-500 mb-4">
                  No recent activity to show. Start by creating your first post!
                </div>
                <Link 
                  to="/posts" 
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
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