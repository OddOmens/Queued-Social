import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth'
import { createDbService } from '@/services/database'
import { schedulingService } from '@/services/scheduling'
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
      
      // Determine scheduled time and status
      let scheduledTime: Date
      let status: ScheduledPost['status'] = 'scheduled'
      
      if (request.schedulingType === 'now') {
        // Post immediately
        scheduledTime = new Date()
        status = 'published' // Mark as published since we're posting now
      } else if (request.schedulingType === 'custom' && request.customTime) {
        scheduledTime = request.customTime
      } else {
        // Find next available time slot
        const nextSlot = await schedulingService.findNextAvailableSlot(user.id)
        
        if (nextSlot) {
          scheduledTime = nextSlot
        } else {
          // Fallback: schedule for 1 hour from now if no slots available
          scheduledTime = new Date(Date.now() + 60 * 60 * 1000)
        }
      }
      
      const post = await db.createScheduledPost({
        userId: user.id,
        platform: request.platform,
        content: request.content,
        scheduledTime,
        status,
        publishedAt: status === 'published' ? new Date() : undefined
      })

      // If posting now, we could trigger immediate publishing here
      // For now, we'll just mark it as published
      
      return post
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