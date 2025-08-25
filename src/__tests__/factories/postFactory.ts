import { ScheduledPost, PostContent } from '../../types'

export interface PostFactoryOptions {
  id?: string
  userId?: string
  platform?: string
  content?: Partial<PostContent>
  scheduledTime?: Date
  status?: 'scheduled' | 'published' | 'failed' | 'cancelled'
  publishedAt?: Date
  errorMessage?: string
}

export const createMockPostContent = (type: 'single' | 'thread' | 'media' = 'single'): PostContent => {
  const baseContent = {
    type,
    text: 'This is a test post content',
    metadata: {},
  }

  switch (type) {
    case 'thread':
      return {
        ...baseContent,
        threadPosts: [
          'First post in thread',
          'Second post in thread',
          'Third post in thread',
        ],
      }
    case 'media':
      return {
        ...baseContent,
        mediaUrls: [
          'https://example.com/image1.jpg',
          'https://example.com/image2.jpg',
        ],
      }
    default:
      return baseContent
  }
}

export const createMockScheduledPost = (options: PostFactoryOptions = {}): ScheduledPost => {
  const defaultPost: ScheduledPost = {
    id: 'post-123',
    userId: 'user-123',
    platform: 'threads',
    content: createMockPostContent(),
    scheduledTime: new Date('2024-01-15T10:00:00Z'),
    status: 'scheduled',
  }

  return {
    ...defaultPost,
    ...options,
    content: options.content ? { ...createMockPostContent(), ...options.content } : defaultPost.content,
  }
}

export const createMockScheduledPosts = (
  count: number,
  baseOptions: PostFactoryOptions = {}
): ScheduledPost[] => {
  return Array.from({ length: count }, (_, index) => {
    const scheduledTime = new Date('2024-01-15T10:00:00Z')
    scheduledTime.setHours(scheduledTime.getHours() + index)

    return createMockScheduledPost({
      ...baseOptions,
      id: `post-${index + 1}`,
      scheduledTime,
      content: {
        ...createMockPostContent(),
        text: `Test post content ${index + 1}`,
      },
    })
  })
}

export const createMockThreadPost = (options: PostFactoryOptions = {}): ScheduledPost => {
  return createMockScheduledPost({
    ...options,
    content: createMockPostContent('thread'),
  })
}

export const createMockMediaPost = (options: PostFactoryOptions = {}): ScheduledPost => {
  return createMockScheduledPost({
    ...options,
    content: createMockPostContent('media'),
  })
}

export const createMockPublishedPost = (options: PostFactoryOptions = {}): ScheduledPost => {
  return createMockScheduledPost({
    ...options,
    status: 'published',
    publishedAt: new Date('2024-01-15T10:00:00Z'),
  })
}

export const createMockFailedPost = (options: PostFactoryOptions = {}): ScheduledPost => {
  return createMockScheduledPost({
    ...options,
    status: 'failed',
    errorMessage: 'Failed to publish: API rate limit exceeded',
  })
}

export const createMockPostsForCalendar = (month: number, year: number): ScheduledPost[] => {
  const posts: ScheduledPost[] = []
  const daysInMonth = new Date(year, month, 0).getDate()

  for (let day = 1; day <= daysInMonth; day++) {
    // Create 1-3 posts per day randomly
    const postsPerDay = Math.floor(Math.random() * 3) + 1

    for (let i = 0; i < postsPerDay; i++) {
      const scheduledTime = new Date(year, month - 1, day, 9 + i * 4, 0, 0)
      
      posts.push(createMockScheduledPost({
        id: `post-${year}-${month}-${day}-${i}`,
        scheduledTime,
        content: {
          type: 'single',
          text: `Post for ${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
          metadata: {},
        },
      }))
    }
  }

  return posts
}