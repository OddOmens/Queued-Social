import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { createDbService } from '@/services/database'
import type { ScheduledPost, CreatePostRequest, Platform } from '@/types'

export function usePosts(filters?: {
  status?: ScheduledPost['status']
  startDate?: Date
  endDate?: Date
  platform?: Platform
  limit?: number
  offset?: number
}) {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['posts', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const db = createDbService()
      return await db.getScheduledPosts(user.id, filters)
    },
    enabled: !!user?.id,
  })
}

export function usePostsCount(filters?: {
  status?: ScheduledPost['status']
  startDate?: Date
  endDate?: Date
  platform?: Platform
}) {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['posts-count', user?.id, filters],
    queryFn: async () => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const db = createDbService()
      return await db.getScheduledPostsCount(user.id, filters)
    },
    enabled: !!user?.id,
  })
}

export function useCreatePost() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (request: CreatePostRequest) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const db = createDbService()
      
      // Determine scheduled time
      let scheduledTime: Date
      if (request.schedulingType === 'custom' && request.customTime) {
        scheduledTime = request.customTime
      } else {
        // TODO: Implement next available time slot logic
        // For now, schedule for 1 hour from now
        scheduledTime = new Date(Date.now() + 60 * 60 * 1000)
      }
      
      return await db.createScheduledPost({
        userId: user.id,
        platform: request.platform,
        content: request.content,
        scheduledTime,
        status: 'scheduled'
      })
    },
    onSuccess: () => {
      // Invalidate and refetch posts
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['posts-count'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useUpdatePost() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async ({ id, updates }: { 
      id: string
      updates: Partial<Omit<ScheduledPost, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
    }) => {
      const db = createDbService()
      return await db.updateScheduledPost(id, updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['posts-count'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}

export function useDeletePost() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      const db = createDbService()
      return await db.deleteScheduledPost(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] })
      queryClient.invalidateQueries({ queryKey: ['posts-count'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    },
  })
}