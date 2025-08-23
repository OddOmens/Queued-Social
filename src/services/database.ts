/**
 * Database service layer for Social Media Scheduler
 * Provides typed interfaces for database operations
 */

import { createClient } from './supabase'
import { createServerSupabaseClient } from './supabase-server'
import type {
  UserProfile,
  TimeSlotConfig,
  ScheduledPost,
  PlatformCredentials,
  DbUserProfile,
  DbTimeSlot,
  DbScheduledPost,
  DbPlatformCredentials,
  DayOfWeek,
  Platform
} from '../types'

// Type conversion utilities
export const convertDbUserProfile = (db: DbUserProfile): UserProfile => ({
  id: db.id,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.updated_at),
  timezone: db.timezone
})

export const convertDbTimeSlot = (db: DbTimeSlot): TimeSlotConfig => ({
  id: db.id,
  userId: db.user_id,
  dayOfWeek: db.day_of_week as DayOfWeek,
  time: db.time,
  timezone: db.timezone,
  isActive: db.is_active,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.created_at) // Note: DbTimeSlot doesn't have updated_at
})

export const convertDbScheduledPost = (db: DbScheduledPost): ScheduledPost => ({
  id: db.id,
  userId: db.user_id,
  platform: db.platform as Platform,
  content: db.content,
  scheduledTime: new Date(db.scheduled_time),
  status: db.status,
  publishedAt: db.published_at ? new Date(db.published_at) : undefined,
  errorMessage: db.error_message || undefined,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.updated_at)
})

export const convertDbPlatformCredentials = (db: DbPlatformCredentials): PlatformCredentials => ({
  id: db.id,
  userId: db.user_id,
  platform: db.platform as Platform,
  credentials: db.credentials,
  isActive: db.is_active,
  expiresAt: db.expires_at ? new Date(db.expires_at) : undefined,
  createdAt: new Date(db.created_at),
  updatedAt: new Date(db.created_at) // Note: DbPlatformCredentials doesn't have updated_at
})

// Database service class
export class DatabaseService {
  private client: ReturnType<typeof createServerSupabaseClient>

  constructor(useServiceRole = false) {
    this.client = useServiceRole ? createServerSupabaseClient() : createClient()
  }

  // User Profile operations
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    const { data, error } = await this.client
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Failed to get user profile: ${error.message}`)
    }

    return convertDbUserProfile(data)
  }

  async createUserProfile(profile: Omit<UserProfile, 'createdAt' | 'updatedAt'>): Promise<UserProfile> {
    const { data, error } = await this.client
      .from('user_profiles')
      .insert({
        id: profile.id,
        timezone: profile.timezone
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create user profile: ${error.message}`)
    }

    return convertDbUserProfile(data)
  }

  async updateUserProfile(userId: string, updates: Partial<Pick<UserProfile, 'timezone'>>): Promise<UserProfile> {
    const { data, error } = await this.client
      .from('user_profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update user profile: ${error.message}`)
    }

    return convertDbUserProfile(data)
  }

  // Time Slot operations
  async getTimeSlots(userId: string): Promise<TimeSlotConfig[]> {
    const { data, error } = await this.client
      .from('time_slots')
      .select('*')
      .eq('user_id', userId)
      .order('day_of_week', { ascending: true })
      .order('time', { ascending: true })

    if (error) {
      throw new Error(`Failed to get time slots: ${error.message}`)
    }

    return data.map(convertDbTimeSlot)
  }

  async createTimeSlot(timeSlot: Omit<TimeSlotConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<TimeSlotConfig> {
    const { data, error } = await this.client
      .from('time_slots')
      .insert({
        user_id: timeSlot.userId,
        day_of_week: timeSlot.dayOfWeek,
        time: timeSlot.time,
        timezone: timeSlot.timezone,
        is_active: timeSlot.isActive
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create time slot: ${error.message}`)
    }

    return convertDbTimeSlot(data)
  }

  async updateTimeSlot(id: string, updates: Partial<Omit<TimeSlotConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<TimeSlotConfig> {
    const updateData: any = {}
    if (updates.dayOfWeek !== undefined) updateData.day_of_week = updates.dayOfWeek
    if (updates.time !== undefined) updateData.time = updates.time
    if (updates.timezone !== undefined) updateData.timezone = updates.timezone
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive

    const { data, error } = await this.client
      .from('time_slots')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update time slot: ${error.message}`)
    }

    return convertDbTimeSlot(data)
  }

  async deleteTimeSlot(id: string): Promise<void> {
    const { error } = await this.client
      .from('time_slots')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete time slot: ${error.message}`)
    }
  }

  // Scheduled Post operations
  async getScheduledPosts(userId: string, filters?: {
    status?: ScheduledPost['status']
    startDate?: Date
    endDate?: Date
    platform?: Platform
    limit?: number
    offset?: number
  }): Promise<ScheduledPost[]> {
    let query = this.client
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', userId)

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.platform) {
      query = query.eq('platform', filters.platform)
    }

    if (filters?.startDate) {
      query = query.gte('scheduled_time', filters.startDate.toISOString())
    }

    if (filters?.endDate) {
      query = query.lte('scheduled_time', filters.endDate.toISOString())
    }

    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    if (filters?.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1)
    }

    query = query.order('scheduled_time', { ascending: true })

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get scheduled posts: ${error.message}`)
    }

    return data.map(convertDbScheduledPost)
  }

  async getScheduledPostsCount(userId: string, filters?: {
    status?: ScheduledPost['status']
    startDate?: Date
    endDate?: Date
    platform?: Platform
  }): Promise<number> {
    let query = this.client
      .from('scheduled_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (filters?.status) {
      query = query.eq('status', filters.status)
    }

    if (filters?.platform) {
      query = query.eq('platform', filters.platform)
    }

    if (filters?.startDate) {
      query = query.gte('scheduled_time', filters.startDate.toISOString())
    }

    if (filters?.endDate) {
      query = query.lte('scheduled_time', filters.endDate.toISOString())
    }

    const { count, error } = await query

    if (error) {
      throw new Error(`Failed to get scheduled posts count: ${error.message}`)
    }

    return count || 0
  }

  async getScheduledPostById(id: string, userId: string): Promise<ScheduledPost | null> {
    const { data, error } = await this.client
      .from('scheduled_posts')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') return null // Not found
      throw new Error(`Failed to get scheduled post: ${error.message}`)
    }

    return convertDbScheduledPost(data)
  }

  async getCalendarData(userId: string, startDate: Date, endDate: Date, platforms?: Platform[]): Promise<ScheduledPost[]> {
    let query = this.client
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_time', startDate.toISOString())
      .lte('scheduled_time', endDate.toISOString())

    if (platforms && platforms.length > 0) {
      query = query.in('platform', platforms)
    }

    query = query.order('scheduled_time', { ascending: true })

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get calendar data: ${error.message}`)
    }

    return data.map(convertDbScheduledPost)
  }

  async getPostsByTimeSlot(userId: string, scheduledTime: Date, toleranceMinutes: number = 0): Promise<ScheduledPost[]> {
    const startTime = new Date(scheduledTime.getTime() - toleranceMinutes * 60000)
    const endTime = new Date(scheduledTime.getTime() + toleranceMinutes * 60000)

    const { data, error } = await this.client
      .from('scheduled_posts')
      .select('*')
      .eq('user_id', userId)
      .gte('scheduled_time', startTime.toISOString())
      .lte('scheduled_time', endTime.toISOString())
      .order('scheduled_time', { ascending: true })

    if (error) {
      throw new Error(`Failed to get posts by time slot: ${error.message}`)
    }

    return data.map(convertDbScheduledPost)
  }

  async updatePostStatus(id: string, status: PostStatus, errorMessage?: string, publishedAt?: Date): Promise<ScheduledPost> {
    const updateData: any = { 
      status,
      updated_at: new Date().toISOString()
    }
    
    if (errorMessage !== undefined) {
      updateData.error_message = errorMessage
    }
    
    if (publishedAt) {
      updateData.published_at = publishedAt.toISOString()
    }

    const { data, error } = await this.client
      .from('scheduled_posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update post status: ${error.message}`)
    }

    return convertDbScheduledPost(data)
  }

  async getPostsForPublishing(beforeTime: Date, limit: number = 50): Promise<ScheduledPost[]> {
    const { data, error } = await this.client
      .from('scheduled_posts')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_time', beforeTime.toISOString())
      .order('scheduled_time', { ascending: true })
      .limit(limit)

    if (error) {
      throw new Error(`Failed to get posts for publishing: ${error.message}`)
    }

    return data.map(convertDbScheduledPost)
  }

  async bulkUpdatePostStatus(postIds: string[], status: PostStatus, errorMessage?: string): Promise<void> {
    const updateData: any = { 
      status,
      updated_at: new Date().toISOString()
    }
    
    if (errorMessage !== undefined) {
      updateData.error_message = errorMessage
    }

    const { error } = await this.client
      .from('scheduled_posts')
      .update(updateData)
      .in('id', postIds)

    if (error) {
      throw new Error(`Failed to bulk update post status: ${error.message}`)
    }
  }

  async createScheduledPost(post: Omit<ScheduledPost, 'id' | 'createdAt' | 'updatedAt'>): Promise<ScheduledPost> {
    const { data, error } = await this.client
      .from('scheduled_posts')
      .insert({
        user_id: post.userId,
        platform: post.platform,
        content: post.content,
        scheduled_time: post.scheduledTime.toISOString(),
        status: post.status,
        published_at: post.publishedAt?.toISOString(),
        error_message: post.errorMessage
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to create scheduled post: ${error.message}`)
    }

    return convertDbScheduledPost(data)
  }

  async updateScheduledPost(id: string, updates: Partial<Omit<ScheduledPost, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<ScheduledPost> {
    const updateData: any = {}
    if (updates.platform !== undefined) updateData.platform = updates.platform
    if (updates.content !== undefined) updateData.content = updates.content
    if (updates.scheduledTime !== undefined) updateData.scheduled_time = updates.scheduledTime.toISOString()
    if (updates.status !== undefined) updateData.status = updates.status
    if (updates.publishedAt !== undefined) updateData.published_at = updates.publishedAt?.toISOString()
    if (updates.errorMessage !== undefined) updateData.error_message = updates.errorMessage

    const { data, error } = await this.client
      .from('scheduled_posts')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to update scheduled post: ${error.message}`)
    }

    return convertDbScheduledPost(data)
  }

  async deleteScheduledPost(id: string): Promise<void> {
    const { error } = await this.client
      .from('scheduled_posts')
      .delete()
      .eq('id', id)

    if (error) {
      throw new Error(`Failed to delete scheduled post: ${error.message}`)
    }
  }

  // Platform Credentials operations
  async getPlatformCredentials(userId: string, platform?: string): Promise<PlatformCredentials[]> {
    let query = this.client
      .from('platform_credentials')
      .select('*')
      .eq('user_id', userId)

    if (platform) {
      query = query.eq('platform', platform)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to get platform credentials: ${error.message}`)
    }

    return data.map(convertDbPlatformCredentials)
  }

  async upsertPlatformCredentials(credentials: Omit<PlatformCredentials, 'id' | 'createdAt' | 'updatedAt'>): Promise<PlatformCredentials> {
    const { data, error } = await this.client
      .from('platform_credentials')
      .upsert({
        user_id: credentials.userId,
        platform: credentials.platform,
        credentials: credentials.credentials,
        is_active: credentials.isActive,
        expires_at: credentials.expiresAt?.toISOString()
      }, {
        onConflict: 'user_id,platform'
      })
      .select()
      .single()

    if (error) {
      throw new Error(`Failed to upsert platform credentials: ${error.message}`)
    }

    return convertDbPlatformCredentials(data)
  }

  async deletePlatformCredentials(userId: string, platform: string): Promise<void> {
    const { error } = await this.client
      .from('platform_credentials')
      .delete()
      .eq('user_id', userId)
      .eq('platform', platform)

    if (error) {
      throw new Error(`Failed to delete platform credentials: ${error.message}`)
    }
  }
}

// Export singleton instances
export const db = new DatabaseService()
export const adminDb = new DatabaseService(true)