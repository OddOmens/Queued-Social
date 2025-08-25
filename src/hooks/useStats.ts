import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { createDbService } from '@/services/database'

export function useDashboardStats() {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['dashboard-stats', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const db = createDbService()
      
      // Get current date boundaries
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)
      
      // Fetch all stats in parallel
      const [
        scheduledCount,
        publishedTodayCount,
        connectedPlatforms,
        recentPosts
      ] = await Promise.all([
        // Scheduled posts count
        db.getScheduledPostsCount(user.id, { status: 'scheduled' }),
        
        // Published today count
        db.getScheduledPostsCount(user.id, { 
          status: 'published',
          startDate: startOfToday,
          endDate: endOfToday
        }),
        
        // Connected platforms count
        db.getPlatformCredentials(user.id).then(creds => 
          creds.filter(c => c.isActive).length
        ),
        
        // Recent posts (last 5)
        db.getScheduledPosts(user.id, { 
          limit: 5,
          offset: 0
        })
      ])
      
      return {
        scheduledPosts: scheduledCount,
        publishedToday: publishedTodayCount,
        connectedPlatforms,
        recentPosts
      }
    },
    enabled: !!user?.id,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
  })
}

export function useConnectedPlatforms() {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['connected-platforms', user?.id],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const db = createDbService()
      return await db.getPlatformCredentials(user.id)
    },
    enabled: !!user?.id,
  })
}