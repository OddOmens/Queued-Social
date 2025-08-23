import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/services/supabase'
import { authMiddleware } from '@/middleware/auth'

export async function GET(request: NextRequest) {
  try {
    const authResult = await authMiddleware(request)
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: 401 })
    }

    const supabase = createClient()
    const userId = authResult.user.id

    // Get total posts count
    const { count: totalPosts } = await supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    // Get posts scheduled for today
    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    const { count: scheduledToday } = await supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'scheduled')
      .gte('scheduled_time', startOfDay.toISOString())
      .lt('scheduled_time', endOfDay.toISOString())

    // Get posts published this week
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const { count: publishedThisWeek } = await supabase
      .from('scheduled_posts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'published')
      .gte('published_at', startOfWeek.toISOString())

    // Get connected platforms count
    const { count: connectedPlatforms } = await supabase
      .from('platform_credentials')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_active', true)

    return NextResponse.json({
      totalPosts: totalPosts || 0,
      scheduledToday: scheduledToday || 0,
      publishedThisWeek: publishedThisWeek || 0,
      connectedPlatforms: connectedPlatforms || 0,
    })
  } catch (error) {
    console.error('Dashboard stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    )
  }
}