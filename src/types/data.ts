
export interface PlatformCredentials {
    id: string
    userId: string
    platform: 'threads' | 'linkedin' | 'instagram'
    platformAccountId: string // Unique identifier on the platform (e.g., Instagram user ID)
    accountName?: string // User-friendly name for the account
    accountUsername?: string // Platform username/handle
    credentials: Record<string, any> // Encrypted OAuth tokens
    isActive: boolean
    expiresAt?: Date
    createdAt: Date
    updatedAt: Date
}

export type PostStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled' | 'draft';

export interface Post {
    id: string
    userId: string
    platform: 'threads' | 'linkedin' | 'instagram'
    content: any // JSON Content
    scheduledTime: Date | null
    status: PostStatus
    publishedAt?: Date
    errorMessage?: string
    createdAt: Date
    updatedAt: Date
    platformAccountId?: string
    accountName?: string
    platformPostId?: string
    analytics?: any
}

export interface Template {
    id: string
    userId: string
    name: string
    content: any
    platform: 'threads' | 'linkedin' | 'instagram'
    category: string
    createdAt: Date
    updatedAt: Date
}

export interface FirstThread {
    id: string
    userId: string
    name: string
    hookText: string
    firstComment?: string
    mediaUrls?: string[]
    category: string
    isFavorite: boolean
    createdAt: Date
    updatedAt: Date
}

export interface CommunityInteraction {
    id: string; // Platform's interaction ID
    platform: 'threads' | 'linkedin' | 'instagram';
    platformAccountId: string;
    authorUsername: string;
    authorName?: string;
    authorAvatarUrl?: string;
    text: string;
    timestamp: Date;
    mediaUrl?: string;
    mediaType?: 'IMAGE' | 'VIDEO' | 'CAROUSEL';
    parentId?: string;
    replies?: CommunityInteraction[];
    platformPostId: string;
    permalink?: string;
    likeCount?: number;
    replyCount?: number;
    isOwn?: boolean;
}

export interface ThreadConversation {
    rootPost: CommunityInteraction;
    interactions: CommunityInteraction[];
}
