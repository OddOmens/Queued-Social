// ============================================================================
// API TYPES AND INTERFACES
// ============================================================================

import { 
  ScheduledPost, 
  PostContent, 
  Platform, 
  PostStatus, 
  TimeSlotConfig, 
  DayOfWeek, 
  PlatformCredentials,
  AppError 
} from './index'

// ============================================================================
// BASE API TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: AppError
  message?: string
  timestamp: string
}

export interface ApiErrorResponse {
  success: false
  error: AppError
  message: string
  timestamp: string
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  message?: string
  timestamp: string
}

export interface PaginationParams {
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// ============================================================================
// POST MANAGEMENT API TYPES
// ============================================================================

export interface CreatePostRequest {
  content: PostContent
  platform: Platform
  schedulingType: 'next-slot' | 'custom'
  customTime?: Date
}

export interface CreatePostResponse extends ApiSuccessResponse<ScheduledPost> {}

export interface UpdatePostRequest {
  content?: Partial<PostContent>
  scheduledTime?: string // ISO string
  status?: PostStatus
}

export interface UpdatePostResponse extends ApiSuccessResponse<ScheduledPost> {}

export interface GetPostsQuery extends PaginationParams {
  platform?: Platform
  status?: PostStatus
  startDate?: string // ISO string
  endDate?: string // ISO string
  search?: string
}

export interface GetPostsResponse extends PaginatedResponse<ScheduledPost> {}

export interface DeletePostResponse extends ApiSuccessResponse<{ id: string }> {}

// ============================================================================
// TIME SLOT API TYPES
// ============================================================================

export interface TimeSlotRequest {
  dayOfWeek: DayOfWeek
  time: string // HH:MM format
  timezone: string
  isActive?: boolean
}

export interface UpdateTimeSlotsRequest {
  timeSlots: TimeSlotRequest[]
}

export interface GetTimeSlotsResponse extends ApiSuccessResponse<TimeSlotConfig[]> {}

export interface UpdateTimeSlotsResponse extends ApiSuccessResponse<TimeSlotConfig[]> {}

// ============================================================================
// SCHEDULING API TYPES
// ============================================================================

export interface ScheduleNextSlotRequest {
  content: PostContent
  platform: Platform
}

export interface ScheduleNextSlotResponse extends ApiSuccessResponse<{
  post: ScheduledPost
  nextAvailableSlot: string // ISO string
}> {}

export interface ScheduleCustomTimeRequest {
  content: PostContent
  platform: Platform
  scheduledTime: string // ISO string
}

export interface ScheduleCustomTimeResponse extends ApiSuccessResponse<ScheduledPost> {}

export interface GetNextAvailableSlotQuery {
  platform?: Platform
  afterDate?: string // ISO string
}

export interface GetNextAvailableSlotResponse extends ApiSuccessResponse<{
  nextSlot: string // ISO string
  availableSlots: string[] // Array of ISO strings
}> {}

// ============================================================================
// PLATFORM API TYPES
// ============================================================================

export interface GetPlatformsResponse extends ApiSuccessResponse<Platform[]> {}

export interface ConnectPlatformRequest {
  platform: Platform
  authCode?: string
  redirectUri?: string
}

export interface ConnectPlatformResponse extends ApiSuccessResponse<{
  platform: Platform
  connected: boolean
  authUrl?: string
}> {}

export interface DisconnectPlatformRequest {
  platform: Platform
}

export interface DisconnectPlatformResponse extends ApiSuccessResponse<{
  platform: Platform
  disconnected: boolean
}> {}

export interface TestPlatformConnectionRequest {
  platform: Platform
}

export interface TestPlatformConnectionResponse extends ApiSuccessResponse<{
  platform: Platform
  connected: boolean
  lastTested: string // ISO string
  error?: string
}> {}

export interface GetPlatformCredentialsResponse extends ApiSuccessResponse<PlatformCredentials[]> {}

// ============================================================================
// MEDIA UPLOAD API TYPES
// ============================================================================

export interface UploadMediaRequest {
  file: File
  platform: Platform
}

export interface UploadMediaResponse extends ApiSuccessResponse<{
  url: string
  filename: string
  size: number
  mimeType: string
  platform: Platform
}> {}

export interface DeleteMediaRequest {
  url: string
  platform: Platform
}

export interface DeleteMediaResponse extends ApiSuccessResponse<{
  deleted: boolean
  url: string
}> {}

// ============================================================================
// CALENDAR API TYPES
// ============================================================================

export interface GetCalendarDataQuery {
  startDate: string // ISO string
  endDate: string // ISO string
  platforms?: Platform[]
  view?: 'month' | 'week' | 'day'
}

export interface CalendarEvent {
  id: string
  title: string
  start: string // ISO string
  end: string // ISO string
  platform: Platform
  status: PostStatus
  content: PostContent
}

export interface GetCalendarDataResponse extends ApiSuccessResponse<CalendarEvent[]> {}

// ============================================================================
// ANALYTICS API TYPES (for future use)
// ============================================================================

export interface GetAnalyticsQuery {
  startDate: string // ISO string
  endDate: string // ISO string
  platforms?: Platform[]
  metrics?: string[]
}

export interface AnalyticsData {
  totalPosts: number
  publishedPosts: number
  failedPosts: number
  platformBreakdown: Record<Platform, number>
  dailyStats: Array<{
    date: string
    posts: number
    published: number
    failed: number
  }>
}

export interface GetAnalyticsResponse extends ApiSuccessResponse<AnalyticsData> {}

// ============================================================================
// WEBHOOK API TYPES (for platform notifications)
// ============================================================================

export interface WebhookPayload {
  platform: Platform
  event: string
  data: any
  timestamp: string
  signature?: string
}

export interface ProcessWebhookRequest extends WebhookPayload {}

export interface ProcessWebhookResponse extends ApiSuccessResponse<{
  processed: boolean
  event: string
  platform: Platform
}> {}

// ============================================================================
// BATCH OPERATIONS API TYPES
// ============================================================================

export interface BatchCreatePostsRequest {
  posts: CreatePostRequest[]
}

export interface BatchCreatePostsResponse extends ApiSuccessResponse<{
  created: ScheduledPost[]
  failed: Array<{
    request: CreatePostRequest
    error: AppError
  }>
}> {}

export interface BatchUpdatePostsRequest {
  updates: Array<{
    id: string
    data: UpdatePostRequest
  }>
}

export interface BatchUpdatePostsResponse extends ApiSuccessResponse<{
  updated: ScheduledPost[]
  failed: Array<{
    id: string
    error: AppError
  }>
}> {}

export interface BatchDeletePostsRequest {
  ids: string[]
}

export interface BatchDeletePostsResponse extends ApiSuccessResponse<{
  deleted: string[]
  failed: Array<{
    id: string
    error: AppError
  }>
}> {}