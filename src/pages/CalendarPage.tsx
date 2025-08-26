import CalendarContainer from '@/components/calendar/CalendarContainer'
import { useState } from 'react'
import { ScheduledPost, TimeSlotConfig, Platform, CreatePostRequest } from '@/types'
import { useTimeSlots } from '@/hooks/useTimeSlots'
import { useAuthStore } from '@/stores/auth'
import { PostEditor } from '@/components/posts/PostEditor'
import { useToast } from '@/components/Toast'

export function CalendarPage() {
  const [posts] = useState<ScheduledPost[]>([]) // TODO: Load posts from API
  const { user } = useAuthStore()
  const { timeSlots, loading: timeSlotsLoading } = useTimeSlots(user?.id || '')
  const { showSuccess, showError } = useToast()
  
  // Post creation modal state
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('threads')
  
  const handlePostSelect = (post: ScheduledPost) => {
    // TODO: Handle post selection
    console.log('Selected post:', post)
  }
  
  const handleDateSelect = (date: Date) => {
    console.log('Selected date:', date)
    setSelectedDate(date)
    setShowCreatePost(true)
  }
  
  const handleCreatePost = async (postData: CreatePostRequest) => {
    try {
      // TODO: Implement post creation API call
      console.log('Creating post:', postData)
      showSuccess('Post scheduled successfully!')
      setShowCreatePost(false)
      setSelectedDate(null)
      // Refresh posts list here
    } catch (error) {
      console.error('Failed to create post:', error)
      showError('Failed to schedule post. Please try again.')
    }
  }
  
  const handleCancelCreate = () => {
    setShowCreatePost(false)
    setSelectedDate(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Content Calendar</h1>
        <p className="mt-2 text-gray-400">
          View and manage your scheduled posts across all platforms.
        </p>
      </div>

      <CalendarContainer 
        posts={posts}
        timeSlots={timeSlots}
        onPostSelect={handlePostSelect}
        onDateSelect={handleDateSelect}
        loading={timeSlotsLoading}
      />

      {/* Create Post Modal */}
      {showCreatePost && selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  Schedule Post for {selectedDate.toLocaleDateString()}
                </h2>
                <button
                  onClick={handleCancelCreate}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <PostEditor
                platform={selectedPlatform}
                onSave={handleCreatePost}
                onCancel={handleCancelCreate}
                initialScheduledTime={selectedDate}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}