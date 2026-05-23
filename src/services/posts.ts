import { supabase } from '@/lib/supabase';
import { Post, Template, FirstThread } from '@/types/data';

/**
 * Fetch all posts for the current user (optionally filtered by status)
 */
export async function getPosts(status?: string): Promise<Post[]> {
    let query = supabase
        .from('scheduled_posts')
        .select('*')
        .order('scheduled_time', { ascending: true })
        .order('created_at', { ascending: false });

    if (status) {
        if (status === 'draft') {
            // Assuming drafts are either status='draft' or scheduled_time is null? 
            // Legacy types didn't explicitly have 'draft' in PostStatus enum, but user asked for Drafts.
            // We'll assume we add 'draft' to the enum or query properly.
            // For now, let's query for status 'draft' or where scheduled_time is null if 'draft' isn't valid DB value yet.
            query = query.eq('status', 'draft');
        } else {
            query = query.eq('status', status);
        }
    }

    const { data, error } = await query;
    if (error) throw error;

    // Transform DB snake_case to camelCase
    return data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        platform: d.platform,
        content: d.content,
        scheduledTime: d.scheduled_time ? new Date(d.scheduled_time) : null,
        status: d.status,
        publishedAt: d.published_at ? new Date(d.published_at) : undefined,
        errorMessage: d.error_message,
        createdAt: new Date(d.created_at),
        updatedAt: new Date(d.updated_at),
        platformAccountId: d.platform_account_id,
        accountName: d.account_name,
        platformPostId: d.platform_post_id,
        analytics: d.analytics
    }));
}

/**
 * Create a new post or draft
 */
export async function createPost(post: Partial<Post>): Promise<Post> {
    // Convert camelCase to snake_case for DB
    const dbPayload = {
        user_id: post.userId,
        platform: post.platform,
        content: post.content,
        scheduled_time: post.scheduledTime?.toISOString(),
        status: post.status,
        platform_account_id: post.platformAccountId,
        account_name: post.accountName
    };

    const { data, error } = await supabase
        .from('scheduled_posts')
        .insert(dbPayload)
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        userId: data.user_id,
        platform: data.platform,
        content: data.content,
        scheduledTime: data.scheduled_time ? new Date(data.scheduled_time) : null,
        status: data.status,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
        platformAccountId: data.platform_account_id,
        accountName: data.account_name
    };
}

/**
 * Update an existing post
 */
export async function updatePost(id: string, updates: Partial<Post>): Promise<void> {
    const dbPayload: any = {};
    if (updates.content) dbPayload.content = updates.content;
    if (updates.scheduledTime) dbPayload.scheduled_time = updates.scheduledTime.toISOString();
    if (updates.status) dbPayload.status = updates.status;
    if (updates.platform) dbPayload.platform = updates.platform;

    const { error } = await supabase
        .from('scheduled_posts')
        .update(dbPayload)
        .eq('id', id);

    if (error) throw error;
}

/**
 * Delete a post
 */
export async function deletePost(id: string): Promise<void> {
    const { error } = await supabase.from('scheduled_posts').delete().eq('id', id);
    if (error) throw error;
}


const SYSTEM_TEMPLATES: Template[] = [
    // Tip
    {
        id: '123e4567-e89b-12d3-a456-426614174001',
        userId: 'system',
        name: 'Quick Tip Tuesday',
        category: 'Tip',
        platform: 'linkedin',
        content: { text: "💡 Quick Tip: {{tip_summary}}\n\nHere is a simple way to {{benefit}}:\n\n1. {{step_1}}\n2. {{step_2}}\n\nI’ve been using this to {{outcome}}. Have you tried it?" },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: '123e4567-e89b-12d3-a456-426614174002',
        userId: 'system',
        name: 'One-Minute Advice',
        category: 'Tip',
        platform: 'linkedin',
        content: { text: "If you only read one thing today, make it this:\n\n{{core_advice}}\n\nWhy? Because {{reason}}. It saves you from {{problem}}.\n\nType 'YES' if you needed to hear this." },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // Case Study
    {
        id: '123e4567-e89b-12d3-a456-426614174003',
        userId: 'system',
        name: 'Client Win Breakdown',
        category: 'Case Study',
        platform: 'linkedin',
        content: { text: "How we helped {{client_type}} achieve {{result}} in {{timeframe}}.\n\nHere’s the breakdown:\n\n🛑 The Problem: {{problem_description}}\n\n✅ The Solution: {{solution_steps}}\n\n📈 The Result: {{outcome_metrics}}\n\nWant results like this? DM me 'GROWTH'." },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: '123e4567-e89b-12d3-a456-426614174004',
        userId: 'system',
        name: 'Before & After',
        category: 'Case Study',
        platform: 'linkedin',
        content: { text: "Before: {{old_state}} 😫\nAfter: {{new_state}} 🤩\n\nThe secret? We changed just one thing: {{key_change}}.\n\nNow, {{client_name}} is enjoying {{benefit}}.\n\n#SuccessStory #Growth" },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // Story
    {
        id: '123e4567-e89b-12d3-a456-426614174005',
        userId: 'system',
        name: 'The Pivot Moment',
        category: 'Story',
        platform: 'linkedin',
        content: { text: "I thought success looked like {{expectation}}, but it actually started when I {{unexpected_action}}.\n\nThat’s when things really shifted for me.\n\nI realized that {{lesson}}.\n\nHas your definition of success changed recently?" },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: '123e4567-e89b-12d3-a456-426614174006',
        userId: 'system',
        name: 'Failure to Success',
        category: 'Story',
        platform: 'linkedin',
        content: { text: "I failed at {{attempt}}. Hard.\n\nHere is what happened: {{failure_story}}.\n\nBut then I decided to {{pivot_action}}.\n\nToday, I am {{current_success}}.\n\nDon't let one 'no' stop your 'yes'." },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // How-to
    {
        id: '123e4567-e89b-12d3-a456-426614174007',
        userId: 'system',
        name: '3-Step Guide',
        category: 'How-to',
        platform: 'linkedin',
        content: { text: "How to {{achieve_goal}} in 3 simple steps:\n\n1️⃣ {{step_1}}: {{detail_1}}\n2️⃣ {{step_2}}: {{detail_2}}\n3️⃣ {{step_3}}: {{detail_3}}\n\nSave this for next time you need to {{goal_action}}!" },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: '123e4567-e89b-12d3-a456-426614174008',
        userId: 'system',
        name: 'Ultimate Tutorial',
        category: 'How-to',
        platform: 'linkedin',
        content: { text: "Stop struggling with {{pain_point}}. Here is the ultimate guide to fixing it:\n\nFirst, {{action_1}}.\nNext, {{action_2}}.\nFinally, {{action_3}}.\n\nThe result? A seamless {{outcome}}. You're welcome! 😉" },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // Question
    {
        id: '123e4567-e89b-12d3-a456-426614174009',
        userId: 'system',
        name: 'Community Poll',
        category: 'Question',
        platform: 'linkedin',
        content: { text: "I’m curious: Do you prefer {{option_A}} or {{option_B}}?\n\nOption A: {{benefit_A}}\nOption B: {{benefit_B}}\n\nLet me know in the comments below! 👇" },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: '123e4567-e89b-12d3-a456-426614174010',
        userId: 'system',
        name: 'Big Question',
        category: 'Question',
        platform: 'linkedin',
        content: { text: "If you could change one thing about {{industry/topic}}, what would it be?\n\nI personally would change {{my_opinion}}.\n\nWhat about you?" },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // Opinion
    {
        id: '123e4567-e89b-12d3-a456-426614174011',
        userId: 'system',
        name: 'Unpopular Opinion',
        category: 'Opinion',
        platform: 'linkedin',
        content: { text: "Unpopular opinion: {{controversial_statement}}.\n\nMost people think {{common_belief}}, but in my experience, {{counter_evidence}}.\n\nHere is why I double down on this: {{reason}}.\n\nThoughts?" },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: '123e4567-e89b-12d3-a456-426614174012',
        userId: 'system',
        name: 'Hot Take',
        category: 'Opinion',
        platform: 'linkedin',
        content: { text: "Hot take: {{statement}} is overrated.\n\nHere is what you should focus on instead: {{alternative}}.\n\nAgree or disagree?" },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // List
    {
        id: '123e4567-e89b-12d3-a456-426614174013',
        userId: 'system',
        name: 'Tool Roundup',
        category: 'List',
        platform: 'linkedin',
        content: { text: "5 Tools I can't live without:\n\n1. {{tool_1}}: For {{use_case_1}}\n2. {{tool_2}}: For {{use_case_2}}\n3. {{tool_3}}: For {{use_case_3}}\n4. {{tool_4}}: For {{use_case_4}}\n5. {{tool_5}}: For {{use_case_5}}\n\nWhich one is your favorite?" },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: '123e4567-e89b-12d3-a456-426614174014',
        userId: 'system',
        name: 'Checklist',
        category: 'List',
        platform: 'linkedin',
        content: { text: "The Ultimate {{Topc}} Checklist:\n\n✅ {{Item_1}}\n✅ {{Item_2}}\n✅ {{Item_3}}\n✅ {{Item_4}}\n\nMissed anything? Add yours below!" },
        createdAt: new Date(),
        updatedAt: new Date()
    },

    // Behind the Scenes
    {
        id: '123e4567-e89b-12d3-a456-426614174015',
        userId: 'system',
        name: 'Real Life vs Social Media',
        category: 'Behind the Scenes',
        platform: 'linkedin',
        content: { text: "What you see: {{public_success}} ✨\nWhat you don't see: {{private_struggle}} 😅\n\nJust a reminder that behind every 'overnight success' is years of hard work." },
        createdAt: new Date(),
        updatedAt: new Date()
    },
    {
        id: '123e4567-e89b-12d3-a456-426614174016',
        userId: 'system',
        name: 'Workspace Tour',
        category: 'Behind the Scenes',
        platform: 'linkedin',
        content: { text: "Sneak peek of where the magic happens! 🪄\n\nMy current setup includes:\n- {{equipment_1}}\n- {{equipment_2}}\n- And of course, lots of coffee ☕\n\nShow me your workspace!" },
        createdAt: new Date(),
        updatedAt: new Date()
    }
];

/**
 * Fetch Templates
 */
export async function getTemplates(): Promise<Template[]> {
    const { data, error } = await supabase
        .from('post_templates')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) throw error;

    const userTemplates = data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        name: d.name,
        content: d.content,
        platform: d.platform,
        category: d.category,
        createdAt: new Date(d.created_at),
        updatedAt: new Date(d.updated_at)
    }));

    return [...SYSTEM_TEMPLATES, ...userTemplates];
}

export async function createTemplate(template: Omit<Template, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<Template> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const dbPayload = {
        user_id: user.id,
        name: template.name,
        content: template.content,
        platform: template.platform,
        category: template.category || 'general'
    };

    const { data, error } = await supabase
        .from('post_templates')
        .insert(dbPayload)
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        content: data.content,
        platform: data.platform,
        category: data.category,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
    };
}

export async function deleteTemplate(id: string): Promise<void> {
    const { error } = await supabase.from('post_templates').delete().eq('id', id);
    if (error) throw error;
}

export async function updateTemplate(id: string, updates: Partial<Omit<Template, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const dbPayload: any = {};
    if (updates.name) dbPayload.name = updates.name;
    if (updates.content) dbPayload.content = updates.content;
    if (updates.platform) dbPayload.platform = updates.platform;
    if (updates.category) dbPayload.category = updates.category;

    const { error } = await supabase
        .from('post_templates')
        .update(dbPayload)
        .eq('id', id);

    if (error) throw error;
}

/**
 * First Threads (Hooks) Service
 */

export async function getFirstThreads(): Promise<FirstThread[]> {
    const { data, error } = await supabase
        .from('first_threads')
        .select('*')
        .order('is_favorite', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) throw error;

    return data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        name: d.name,
        hookText: d.hook_text,
        firstComment: d.first_comment,
        mediaUrls: d.media_urls,
        category: d.category,
        isFavorite: d.is_favorite,
        createdAt: new Date(d.created_at),
        updatedAt: new Date(d.updated_at)
    }));
}

export async function createFirstThread(thread: Omit<FirstThread, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isFavorite'>): Promise<FirstThread> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const dbPayload = {
        user_id: user.id,
        name: thread.name,
        hook_text: thread.hookText,
        first_comment: thread.firstComment,
        media_urls: thread.mediaUrls || [],
        category: thread.category || 'General'
    };

    const { data, error } = await supabase
        .from('first_threads')
        .insert(dbPayload)
        .select()
        .single();

    if (error) throw error;

    return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        hookText: data.hook_text,
        firstComment: data.first_comment,
        mediaUrls: data.media_urls,
        category: data.category,
        isFavorite: data.is_favorite,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at)
    };
}

export async function updateFirstThread(id: string, updates: Partial<FirstThread>): Promise<void> {
    const dbPayload: any = {};
    if (updates.name) dbPayload.name = updates.name;
    if (updates.hookText) dbPayload.hook_text = updates.hookText;
    if (updates.firstComment !== undefined) dbPayload.first_comment = updates.firstComment;
    if (updates.mediaUrls) dbPayload.media_urls = updates.mediaUrls;
    if (updates.category) dbPayload.category = updates.category;
    if (updates.isFavorite !== undefined) dbPayload.is_favorite = updates.isFavorite;

    const { error } = await supabase
        .from('first_threads')
        .update(dbPayload)
        .eq('id', id);

    if (error) throw error;
}

// Bulk create threads
export async function bulkCreateFirstThreads(threads: Omit<FirstThread, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isFavorite'>[]): Promise<FirstThread[]> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const dbPayloads = threads.map(thread => ({
        user_id: user.id,
        name: thread.name,
        hook_text: thread.hookText,
        first_comment: thread.firstComment,
        media_urls: thread.mediaUrls || [],
        category: thread.category || 'General'
    }));

    const { data, error } = await supabase
        .from('first_threads')
        .insert(dbPayloads)
        .select();

    if (error) throw error;

    return data.map((d: any) => ({
        id: d.id,
        userId: d.user_id,
        name: d.name,
        hookText: d.hook_text,
        firstComment: d.first_comment,
        mediaUrls: d.media_urls,
        category: d.category,
        isFavorite: d.is_favorite,
        createdAt: new Date(d.created_at),
        updatedAt: new Date(d.updated_at)
    }));
}

export async function deleteFirstThread(id: string): Promise<void> {
    const { error } = await supabase.from('first_threads').delete().eq('id', id);
    if (error) throw error;
}
