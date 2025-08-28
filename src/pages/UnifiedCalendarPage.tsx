import { useState, useMemo, useRef } from 'react'
import { usePosts, useCreatePost, useDeletePost } from '@/hooks/usePosts'
import { useTimeSlots } from '@/hooks/useTimeSlots'
import { useAuthStore } from '@/stores/auth'
import { PostEditor } from '@/components/posts/PostEditor'
import CalendarContainer from '@/components/calendar/CalendarContainer'
import { PostTooltip } from '@/components/calendar/PostTooltip'
import { Platform, CreatePostRequest, ScheduledPost, PostContent } from '@/types'

type ViewMode = 'calendar' | 'list'
type CalendarView = 'month' | 'week' | 'day'

export function UnifiedCalendarPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('calendar')
  const [calendarView, setCalendarView] = useState<CalendarView>('month')
  const [showEditor, setShowEditor] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('threads')
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'published' | 'failed'>('all')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedPost, setSelectedPost] = useState<ScheduledPost | null>(null)
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null)
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null)
  const [showBulkUpload, setShowBulkUpload] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const { user } = useAuthStore()
  const { data: posts, isLoading, error } = usePosts({
    status: filter === 'all' ? undefined : filter,
    limit: 100
  })
  const { timeSlots, loading: timeSlotsLoading } = useTimeSlots(user?.id || '')
  
  const createPostMutation = useCreatePost()
  const deletePostMutation = useDeletePost()

  // Calculate stats for the header
  const stats = useMemo(() => {
    if (!posts) return { scheduled: 0, published: 0, failed: 0, publishing: 0, cancelled: 0, total: 0 }
    
    return posts.reduce((acc, post) => {
      acc.total++
      if (post.status in acc) {
        (acc as any)[post.status]++
      }
      return acc
    }, { scheduled: 0, published: 0, failed: 0, publishing: 0, cancelled: 0, total: 0 })
  }, [posts])

  // Group posts by date for list view
  const groupedPosts = useMemo(() => {
    try {
      if (!posts || posts.length === 0) return []
      
      const groups = new Map<string, ScheduledPost[]>()
      
      posts.forEach(post => {
        const date = new Date(post.scheduledTime)
        const dateKey = date.toDateString()
        
        if (!groups.has(dateKey)) {
          groups.set(dateKey, [])
        }
        groups.get(dateKey)!.push(post)
      })
      
      const entries = Array.from(groups.entries())
          const sortedEntries = entries.sort((entryA, entryB) => {
      const dateA = entryA[0]
      const dateB = entryB[0]
      return new Date(dateA).getTime() - new Date(dateB).getTime()
    })
      
      return sortedEntries.map((entry) => {
        const dateStr = entry[0]
        const postsArray = entry[1]
        const sortedPosts = postsArray.sort((postA, postB) => {
          return new Date(postA.scheduledTime).getTime() - new Date(postB.scheduledTime).getTime()
        })
        
        return {
          date: new Date(dateStr),
          dateKey: dateStr,
          posts: sortedPosts
        }
      })
    } catch (error) {
      console.error('Error in groupedPosts useMemo:', error)
      return []
    }
  }, [posts])

  const formatDateHeader = (date: Date) => {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    
    const isToday = date.toDateString() === today.toDateString()
    const isTomorrow = date.toDateString() === tomorrow.toDateString()
    
    if (isToday) return 'Today'
    if (isTomorrow) return 'Tomorrow'
    
    const isThisYear = date.getFullYear() === today.getFullYear()
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: isThisYear ? undefined : 'numeric'
    })
  }

  const handleCreatePost = async (request: CreatePostRequest) => {
    try {
      await createPostMutation.mutateAsync(request)
      setShowEditor(false)
      setSelectedDate(null)
    } catch (error) {
      console.error('Failed to create post:', error)
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (confirm('Are you sure you want to delete this post?')) {
      try {
        await deletePostMutation.mutateAsync(postId)
      } catch (error) {
        console.error('Failed to delete post:', error)
      }
    }
  }

  const handlePostSelect = (post: ScheduledPost, event?: MouseEvent | React.MouseEvent) => {
    if (event) {
      setTooltipPosition({ x: event.clientX, y: event.clientY })
      setSelectedPost(post)
    }
  }

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date)
    setEditingPost(null)
    setShowEditor(true)
  }

  const handleEditPost = (post: ScheduledPost) => {
    setEditingPost(post)
    setSelectedPost(null)
    setTooltipPosition(null)
    setShowEditor(true)
  }

  const handleCloseTooltip = () => {
    setSelectedPost(null)
    setTooltipPosition(null)
  }

  const handleDeleteFromTooltip = async (post: ScheduledPost) => {
    if (confirm('Are you sure you want to delete this post?')) {
      try {
        await deletePostMutation.mutateAsync(post.id)
        handleCloseTooltip()
      } catch (error) {
        console.error('Failed to delete post:', error)
      }
    }
  }

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n').filter(line => line.trim())
    return lines.map(line => {
      const result = []
      let current = ''
      let inQuotes = false
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    })
  }

  const handleBulkUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const rows = parseCSV(text)
    
    if (rows.length < 2) {
      alert('CSV file must have at least a header row and one data row')
      return
    }

    const headers = rows[0].map(h => h.toLowerCase())
    const contentIndex = headers.indexOf('content')
    const scheduledTimeIndex = headers.indexOf('scheduled_time')
    const platformIndex = headers.indexOf('platform')

    if (contentIndex === -1 || scheduledTimeIndex === -1) {
      alert('CSV must have "content" and "scheduled_time" columns')
      return
    }

    let successCount = 0
    let errorCount = 0

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      try {
        const content = row[contentIndex]
        const scheduledTime = row[scheduledTimeIndex]
        const platform = (platformIndex !== -1 ? row[platformIndex] : 'threads') as Platform

        if (!content || !scheduledTime) continue

        const postContent: PostContent = {
          type: 'single',
          text: content,
          metadata: {
            replySettings: 'everyone',
            allowReplies: true
          }
        }

        const request: CreatePostRequest = {
          content: postContent,
          platform,
          schedulingType: 'custom',
          customTime: new Date(scheduledTime)
        }

        await createPostMutation.mutateAsync(request)
        successCount++
      } catch (error) {
        console.error('Failed to create post from CSV row:', error)
        errorCount++
      }
    }

    alert(`Bulk upload complete: ${successCount} posts created, ${errorCount} errors`)
    setShowBulkUpload(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const downloadTemplate = () => {
    const template = 'content,scheduled_time,platform\n"Your post content here","2024-01-01 12:00:00","threads"\n"Another post","2024-01-02 15:30:00","threads"'
    const blob = new Blob([template], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bulk_upload_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (showEditor) {
    return (
      <PostEditor
        platform={selectedPlatform}
        onSave={handleCreatePost}
        onCancel={() => {
          setShowEditor(false)
          setSelectedDate(null)
          setEditingPost(null)
        }}
        initialContent={editingPost?.content}
        initialScheduledTime={selectedDate || (editingPost ? new Date(editingPost.scheduledTime) : undefined)}
        loading={createPostMutation.isPending}
        isEditing={!!editingPost}
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Publish</h1>
          <p className="mt-2 text-gray-400">
            View, schedule, and manage your social media content across all platforms.
          </p>
          {stats.total > 0 && (
            <div className="flex items-center space-x-4 mt-3">
              <div className="text-sm">
                <span className="text-gray-400">Total: </span>
                <span className="font-semibold text-white">{stats.total}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">Scheduled: </span>
                <span className="font-semibold text-blue-400">{stats.scheduled}</span>
              </div>
              <div className="text-sm">
                <span className="text-gray-400">Published: </span>
                <span className="font-semibold text-green-400">{stats.published}</span>
              </div>
              {stats.failed > 0 && (
                <div className="text-sm">
                  <span className="text-gray-400">Failed: </span>
                  <span className="font-semibold text-red-400">{stats.failed}</span>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center px-3 py-2 border border-gray-700 rounded-lg text-sm bg-gray-800">
            <span className="text-gray-300">🧵 Threads</span>
          </div>
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => setShowEditor(true)}
              className="btn-primary flex items-center space-x-2 px-3 py-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>New Content</span>
            </button>
            <button 
              onClick={() => setShowBulkUpload(true)}
              className="btn-secondary flex items-center space-x-2 px-3 py-2 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <span>Bulk Upload</span>
            </button>
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="border-b border-gray-800">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setViewMode('calendar')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              viewMode === 'calendar'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            Calendar View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              viewMode === 'list'
                ? 'border-blue-400 text-blue-400'
                : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
            }`}
          >
            List View
          </button>
        </nav>
      </div>

      {/* Calendar View Controls */}
      {viewMode === 'calendar' && (
        <div className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg">
          <div className="flex items-center space-x-1 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setCalendarView('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                calendarView === 'month'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setCalendarView('week')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                calendarView === 'week'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }`}
            >
              Week
            </button>
          </div>
          
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
              <span>Scheduled</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-600 rounded-full"></div>
              <span>Published</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-600 rounded-full"></div>
              <span>Failed</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-emerald-600 rounded-full"></div>
              <span>Time Slots</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs for list view */}
      {viewMode === 'list' && (
        <div className="border-b border-gray-800">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'all', label: 'All Content' },
              { key: 'scheduled', label: 'Scheduled' },
              { key: 'published', label: 'Published' },
              { key: 'failed', label: 'Failed' }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as any)}
                className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                  filter === tab.key
                    ? 'border-green-400 text-green-400'
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      )}

      {/* Content Area */}
      <div className="card">
        {/* Calendar Views */}
        {viewMode === 'calendar' && (
          <CalendarContainer
            posts={posts || []}
            timeSlots={timeSlots}
            onPostSelect={handleEditPost}
            onPostRightClick={handlePostSelect}
            onDateSelect={handleDateSelect}
            loading={isLoading || timeSlotsLoading}
            initialView={calendarView}
          />
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className="px-6 py-6 sm:p-8">
            {error ? (
              <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg">
                Failed to load content. Please try refreshing the page.
              </div>
            ) : isLoading ? (
              <div className="text-center py-12">
                <div className="text-gray-400">Loading content...</div>
              </div>
            ) : groupedPosts.length > 0 ? (
              <div className="space-y-8">
                {groupedPosts.map((group) => {
                  const { date, dateKey, posts: groupPosts } = group
                  return (
                    <div key={dateKey}>
                      <div className="flex items-center mb-4">
                        <h2 className="text-lg font-semibold text-white">
                          {formatDateHeader(date)}
                        </h2>
                        <div className="ml-3 text-sm text-gray-400">
                          {groupPosts.length} post{groupPosts.length !== 1 ? 's' : ''}
                        </div>
                        <div className="flex-1 ml-4 border-t border-gray-800"></div>
                      </div>
                      
                      <div className="space-y-3">
                        {groupPosts.map((post) => (
                        <div key={post.id} className="border border-gray-800 rounded-lg p-4 bg-gray-800/50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-2">
                                <span className="text-xs text-gray-400">
                                  {new Date(post.scheduledTime).toLocaleTimeString(undefined, {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                                <span className="text-sm font-medium text-white capitalize">
                                  {post.platform}
                                </span>
                                <span className={`inline-flex px-3 py-1 text-xs font-medium rounded-full ${
                                  post.status === 'published' 
                                    ? 'bg-green-900/50 text-green-300'
                                    : post.status === 'scheduled'
                                    ? 'bg-blue-900/50 text-blue-300'
                                    : post.status === 'failed'
                                    ? 'bg-red-900/50 text-red-300'
                                    : 'bg-gray-800 text-gray-300'
                                }`}>
                                  {post.status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-200 mb-2">
                                {post.content.text || 'Media post'}
                              </p>
                              {post.publishedAt && (
                                <div className="text-xs text-gray-400">
                                  Published: {new Date(post.publishedAt).toLocaleString()}
                                </div>
                              )}
                              {post.errorMessage && (
                                <div className="text-xs text-red-400 mt-1">
                                  Error: {post.errorMessage}
                                </div>
                              )}
                            </div>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleDeletePost(post.id)}
                                disabled={deletePostMutation.isPending}
                                className="text-red-400 hover:text-red-300 text-sm font-medium"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v16a2 2 0 002 2z" />
                </svg>
                <h3 className="text-lg font-medium text-white mb-2">
                  {filter === 'all' ? 'No content scheduled' : `No ${filter} content`}
                </h3>
                <p className="text-gray-400 mb-4">
                  {filter === 'all' 
                    ? 'Get started by creating your first content.'
                    : `You don't have any ${filter} content.`
                  }
                </p>
                <button 
                  onClick={() => setShowEditor(true)}
                  className="btn-primary"
                >
                  Create Your First Content
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Post Tooltip */}
      {selectedPost && tooltipPosition && (
        <PostTooltip
          post={selectedPost}
          position={tooltipPosition}
          onEdit={() => handleEditPost(selectedPost)}
          onDelete={() => handleDeleteFromTooltip(selectedPost)}
          onClose={handleCloseTooltip}
        />
      )}

      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold text-white mb-4">Bulk Upload Posts</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-gray-300 text-sm mb-3">
                  Upload a CSV file with your posts. Required columns: <code className="bg-gray-800 px-1 rounded text-xs">content</code>, <code className="bg-gray-800 px-1 rounded text-xs">scheduled_time</code>. Optional: <code className="bg-gray-800 px-1 rounded text-xs">platform</code>
                </p>
                
                <button
                  onClick={downloadTemplate}
                  className="text-blue-400 hover:text-blue-300 text-sm underline mb-3 block"
                >
                  Download CSV Template
                </button>
              </div>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleBulkUpload}
                  className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 file:cursor-pointer cursor-pointer"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => setShowBulkUpload(false)}
                  className="px-4 py-2 text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}