'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/layout/AppLayout'
import { CalendarContainer } from '@/components/calendar'
import { ScheduledPost } from '@/types'

interface DashboardStats {
  totalPosts: number
  scheduledToday: number
  publishedThisWeek: number
  connectedPlatforms: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalPosts: 0,
    scheduledToday: 0,
    publishedThisWeek: 0,
    connectedPlatforms: 0,
  })
  const [recentPosts, setRecentPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch dashboard statistics
        const statsResponse = await fetch('/api/dashboard/stats')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData)
        }

        // Fetch recent posts
        const postsResponse = await fetch('/api/posts?limit=5&sort=created_at')
        if (postsResponse.ok) {
          const postsData = await postsResponse.json()
          setRecentPosts(postsData.posts || [])
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboardData()
  }, [])

  const quickActions = [
    {
      name: 'Create Post',
      description: 'Schedule a new social media post',
      href: '/posts/new',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      color: 'bg-blue-500 hover:bg-blue-600',
    },
    {
      name: 'View Calendar',
      description: 'See all scheduled posts',
      href: '/calendar',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v16a2 2 0 002 2z" />
        </svg>
      ),
      color: 'bg-green-500 hover:bg-green-600',
    },
    {
      name: 'Time Slots',
      description: 'Configure posting schedule',
      href: '/settings/time-slots',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'bg-purple-500 hover:bg-purple-600',
    },
    {
      name: 'Connect Platform',
      description: 'Add social media accounts',
      href: '/settings/platforms',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
      color: 'bg-orange-500 hover:bg-orange-600',
    },
  ]

  const statCards = [
    {
      name: 'Total Posts',
      value: stats.totalPosts,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      name: 'Scheduled Today',
      value: stats.scheduledToday,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: 'Published This Week',
      value: stats.publishedThisWeek,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      name: 'Connected Platforms',
      value: stats.connectedPlatforms,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
      ),
    },
  ]

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome to your Dashboard
          </h1>
          <p className="text-gray-600">
            Manage your social media content and schedule posts across platforms.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <div key={stat.name} className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 rounded-md flex items-center justify-center">
                    <div className="text-blue-600">{stat.icon}</div>
                  </div>
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {loading ? '...' : stat.value}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <Link
                key={action.name}
                href={action.href}
                className={`${action.color} text-white rounded-lg p-4 transition-colors group`}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">{action.icon}</div>
                  <div>
                    <h3 className="font-medium">{action.name}</h3>
                    <p className="text-sm opacity-90">{action.description}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Calendar Preview */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Upcoming Posts</h2>
            <Link
              href="/calendar"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View Full Calendar →
            </Link>
          </div>
          <div className="h-64">
            <CalendarContainer className="h-full" />
          </div>
        </div>

        {/* Recent Posts */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Posts</h2>
            <Link
              href="/posts"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              View All Posts →
            </Link>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : recentPosts.length > 0 ? (
            <div className="space-y-4">
              {recentPosts.map((post) => (
                <div key={post.id} className="border-l-4 border-blue-500 pl-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {post.content.text.substring(0, 100)}
                        {post.content.text.length > 100 ? '...' : ''}
                      </p>
                      <p className="text-xs text-gray-500">
                        Scheduled for {new Date(post.scheduledTime).toLocaleDateString()} at{' '}
                        {new Date(post.scheduledTime).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {post.platform}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No posts scheduled yet.</p>
              <Link
                href="/posts/new"
                className="text-blue-600 hover:text-blue-700 text-sm font-medium"
              >
                Create your first post →
              </Link>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}