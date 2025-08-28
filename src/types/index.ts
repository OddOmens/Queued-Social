// ============================================================================
// CORE APPLICATION TYPES
// ============================================================================

export interface User {
  id: string
  email: string
  timezone: string
  createdAt: Date
}

export interface UserProfile {
  id: string
  createdAt: Date
  updatedAt: Date
  timezone: string
}

// ============================================================================
// POST CONTENT TYPES
// ============================================================================

export type PostContentType = 'single' | 'thread' | 'media'
export type PostStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled'
export type Platform = 'threads'

// Base interface for all post content
export interface BasePostContent {
  type: PostContentType
  text: string
  metadata: Record<string, any>
}

// Single post content (text only or text with media)
export interface SinglePostContent extends BasePostContent {
  type: 'single'
  text: string
  mediaUrls?: string[]
  metadata: {
    replySettings?: 'everyone' | 'accounts_you_follow' | 'mentioned_only'
    allowReplies?: boolean
    [key: string]: any
  }
}

// Thread post content (multiple connected posts)
export interface ThreadPostContent extends BasePostContent {
  type: 'thread'
  text: string // Main thread starter text
  threadPosts: string[] // Array of thread post texts
  mediaUrls?: string[] // Media for the main post
  metadata: {
    replySettings?: 'everyone' | 'accounts_you_follow' | 'mentioned_only'
    allowReplies?: boolean
    threadMediaUrls?: string[][] // Media for each thread post
    [key: string]: any
  }
}

// Media-focused post content (primarily media with optional text)
export interface MediaPostContent extends BasePostContent {
  type: 'media'
  text: string // Caption/description
  mediaUrls: string[] // Required for media posts
  metadata: {
    altText?: string[]
    mediaTypes?: ('image' | 'video')[]
    replySettings?: 'everyone' | 'accounts_you_follow' | 'mentioned_only'
    allowReplies?: boolean
    [key: string]: any
  }
}

// Discriminated union for type-safe post content
export type PostContent = SinglePostContent | ThreadPostContent | MediaPostContent

// Type guards for post content discrimination
export const isSinglePostContent = (content: PostContent): content is SinglePostContent => {
  return content.type === 'single'
}

export const isThreadPostContent = (content: PostContent): content is ThreadPostContent => {
  return content.type === 'thread'
}

export const isMediaPostContent = (content: PostContent): content is MediaPostContent => {
  return content.type === 'media'
}

export interface ScheduledPost {
  id: string
  userId: string
  platform: Platform
  content: PostContent
  scheduledTime: Date
  status: PostStatus
  publishedAt?: Date
  errorMessage?: string
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// TEMPLATE TYPES
// ============================================================================

export interface Template {
  id: string
  userId: string
  name: string
  content: PostContent
  platform: Platform
  category: string
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// TIME SLOT TYPES
// ============================================================================

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6 // Sunday = 0

export interface TimeSlot {
  id: string
  time: string // HH:MM format
  timezone: string
  isActive: boolean
  dayOfWeek?: DayOfWeek // Optional for backward compatibility
  hour?: number // Optional for calendar display
  minute?: number // Optional for calendar display
}

export interface TimeSlotConfig {
  id: string
  userId: string
  dayOfWeek: DayOfWeek
  time: string // HH:MM format
  timezone: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// ============================================================================
// PLATFORM PLUGIN TYPES
// ============================================================================

export interface ContentLimits {
  maxTextLength: number
  maxMediaFiles: number
  supportedMediaTypes: string[]
  maxThreadLength?: number
  maxMediaSize?: number
}

export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings?: string[]
}

export interface PublishResult {
  success: boolean
  postId?: string
  error?: string
  platformResponse?: any
  updatedCredentials?: PlatformCredentials
}

export interface PlatformCredentials {
  id: string
  userId: string
  platform: Platform
  credentials: Record<string, any> // Encrypted OAuth tokens
  isActive: boolean
  expiresAt?: Date
  createdAt: Date
  updatedAt: Date
}

export interface PlatformPlugin {
  name: Platform
  displayName: string
  validateContent(content: PostContent): ValidationResult
  publishPost(content: PostContent, credentials: PlatformCredentials): Promise<PublishResult>
  getContentLimits(): ContentLimits
  getSupportedContentTypes(): PostContentType[]
}

// Threads-specific plugin interface
export interface ThreadsPlugin extends PlatformPlugin {
  publishThread(posts: string[], credentials: PlatformCredentials): Promise<PublishResult>
  uploadMedia(file: File, credentials: PlatformCredentials): Promise<string>
}

// ============================================================================
// CONTENT VALIDATION TYPES
// ============================================================================

export interface ContentValidationRule {
  field: keyof PostContent
  validator: (value: any) => ValidationResult
  required?: boolean
}

export interface PlatformValidationRules {
  platform: Platform
  rules: ContentValidationRule[]
  contentLimits: ContentLimits
}

export interface MediaValidation {
  maxFileSize: number // in bytes
  allowedFormats: string[]
  maxDimensions?: {
    width: number
    height: number
  }
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

export enum ErrorCode {
  // Authentication errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  
  // Content validation errors
  INVALID_CONTENT = 'INVALID_CONTENT',
  CONTENT_TOO_LONG = 'CONTENT_TOO_LONG',
  CONTENT_TOO_SHORT = 'CONTENT_TOO_SHORT',
  INVALID_MEDIA_FORMAT = 'INVALID_MEDIA_FORMAT',
  MEDIA_TOO_LARGE = 'MEDIA_TOO_LARGE',
  TOO_MANY_MEDIA_FILES = 'TOO_MANY_MEDIA_FILES',
  EMPTY_THREAD = 'EMPTY_THREAD',
  THREAD_TOO_LONG = 'THREAD_TOO_LONG',
  THREAD_POST_TOO_LONG = 'THREAD_POST_TOO_LONG',
  INVALID_DAY_OF_WEEK = 'INVALID_DAY_OF_WEEK',
  INVALID_TIME_FORMAT = 'INVALID_TIME_FORMAT',
  INVALID_TIMEZONE = 'INVALID_TIMEZONE',
  REQUIRED_FIELD_MISSING = 'REQUIRED_FIELD_MISSING',
  
  // Platform errors
  PLATFORM_AUTH_FAILED = 'PLATFORM_AUTH_FAILED',
  PLATFORM_API_ERROR = 'PLATFORM_API_ERROR',
  PLATFORM_RATE_LIMITED = 'PLATFORM_RATE_LIMITED',
  
  // Scheduling errors
  SCHEDULING_CONFLICT = 'SCHEDULING_CONFLICT',
  INVALID_TIME_SLOT = 'INVALID_TIME_SLOT',
  NO_AVAILABLE_SLOTS = 'NO_AVAILABLE_SLOTS',
  TIME_SLOT_CONFLICT = 'TIME_SLOT_CONFLICT',
  DUPLICATE_TIME_SLOT = 'DUPLICATE_TIME_SLOT',
  
  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  DUPLICATE_RECORD = 'DUPLICATE_RECORD',
  
  // General errors
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export interface AppError {
  code: ErrorCode
  message: string
  details?: Record<string, any>
  statusCode?: number
  timestamp: Date
}

export class SchedulingError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public statusCode: number = 500,
    public details?: Record<string, any>
  ) {
    super(message)
    this.name = 'SchedulingError'
  }
}

export interface ValidationError {
  field: string
  message: string
  code: ErrorCode
  value?: any
}

export class ValidationErrorClass extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any,
    public code: ErrorCode = ErrorCode.VALIDATION_ERROR
  ) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class PlatformError extends Error {
  constructor(
    message: string,
    public platform: Platform,
    public code: ErrorCode,
    public platformResponse?: any
  ) {
    super(message)
    this.name = 'PlatformError'
  }
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: AppError
  message?: string
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

export interface ApiErrorResponse {
  success: false
  error: AppError
  message: string
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  message?: string
}

// ============================================================================
// REQUEST/RESPONSE PAYLOAD TYPES
// ============================================================================

export interface CreatePostRequest {
  content: PostContent
  platform: Platform
  schedulingType: 'now' | 'next-slot' | 'custom'
  customTime?: Date
}

export interface UpdatePostRequest {
  content?: Partial<PostContent>
  scheduledTime?: Date
  status?: PostStatus
}

export interface TimeSlotRequest {
  dayOfWeek: DayOfWeek
  time: string
  timezone: string
  isActive?: boolean
}

export interface ScheduleNextSlotRequest {
  content: PostContent
  platform: Platform
}

export interface ScheduleNextSlotRequest {
  content: PostContent
  platform: Platform
  startDate?: string // ISO date string
  excludeDates?: string[] // Array of ISO date strings
}

export interface ScheduleCustomTimeRequest {
  content: PostContent
  platform: Platform
  scheduledTime: string // ISO date string
  allowConflicts?: boolean
}

export interface CreateTemplateRequest {
  name: string
  content: PostContent
  platform: Platform
  category?: string
}

export interface UpdateTemplateRequest {
  name?: string
  content?: PostContent
  platform?: Platform
  category?: string
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

// Make all properties optional for partial updates
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Extract only the fields needed for creation (without id, timestamps)
export type CreateInput<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>

// Extract only the fields that can be updated
export type UpdateInput<T> = Partial<Omit<T, 'id' | 'createdAt' | 'userId'>>

// Database model conversion utilities
export type DbModel<T> = {
  [K in keyof T]: T[K] extends Date ? string : T[K]
}

// Convert snake_case database fields to camelCase
export type CamelCase<S extends string> = S extends `${infer P1}_${infer P2}${infer P3}`
  ? `${P1}${Capitalize<CamelCase<`${P2}${P3}`>>}`
  : S

// ============================================================================
// DATABASE MODEL TYPES (matching Supabase schema)
// ============================================================================

export interface DbUserProfile {
  id: string
  created_at: string
  updated_at: string
  timezone: string
}

export interface DbTimeSlot {
  id: string
  user_id: string
  day_of_week: number
  time: string
  timezone: string
  is_active: boolean
  created_at: string
}

export interface DbScheduledPost {
  id: string
  user_id: string
  platform: string
  content: any // JSONB
  scheduled_time: string
  status: PostStatus
  published_at?: string
  error_message?: string
  created_at: string
  updated_at: string
}

export interface DbPlatformCredentials {
  id: string
  user_id: string
  platform: string
  credentials: any // JSONB - encrypted
  is_active: boolean
  expires_at?: string
  created_at: string
}

export interface DbTemplate {
  id: string
  user_id: string
  name: string
  content: any // JSONB
  platform: string
  category: string
  created_at: string
  updated_at: string
}

// ============================================================================
// COMPONENT PROP TYPES
// ============================================================================

export interface CalendarViewProps {
  posts: ScheduledPost[]
  onPostSelect: (post: ScheduledPost) => void
  onDateSelect: (date: Date) => void
  view: 'month' | 'week' | 'day'
  loading?: boolean
}

export interface PostEditorProps {
  platform: Platform
  onSave: (post: CreatePostRequest) => void
  onCancel: () => void
  initialContent?: PostContent
  loading?: boolean
}

export interface TimeSlotManagerProps {
  timeSlots: TimeSlotConfig[]
  onSave: (slots: TimeSlotRequest[]) => void
  loading?: boolean
}

// ============================================================================
// HOOK RETURN TYPES
// ============================================================================

export interface UseScheduledPostsReturn {
  posts: ScheduledPost[]
  loading: boolean
  error: AppError | null
  createPost: (request: CreatePostRequest) => Promise<ScheduledPost>
  updatePost: (id: string, request: UpdatePostRequest) => Promise<ScheduledPost>
  deletePost: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

export interface UseTimeSlotReturn {
  timeSlots: TimeSlotConfig[]
  loading: boolean
  error: AppError | null
  updateTimeSlots: (slots: TimeSlotRequest[]) => Promise<void>
  getNextAvailableSlot: () => Date | null
  getTimeSlotsForDay: (day: DayOfWeek) => TimeSlotConfig[]
  getAvailableSlots: (startDate: Date, endDate: Date) => Promise<{ date: Date; available: boolean; }[]>
  createTimeSlot: (slot: TimeSlotRequest) => Promise<TimeSlotConfig | undefined>
  updateTimeSlot: (id: string, updates: Partial<TimeSlotRequest>) => Promise<TimeSlotConfig | undefined>
  deleteTimeSlot: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

export interface UsePlatformReturn {
  platforms: Platform[]
  credentials: PlatformCredentials[]
  loading: boolean
  error: AppError | null
  connectPlatform: (platform: Platform) => Promise<void>
  disconnectPlatform: (platform: Platform) => Promise<void>
  testConnection: (platform: Platform) => Promise<boolean>
}

// ============================================================================
// RE-EXPORTS FROM OTHER TYPE FILES
// ============================================================================

// Authentication types
export * from './auth'

// Platform-specific types
export * from './platform'

// Validation types
export * from './validation'

// API types
export * from './api'

