import { useState } from 'react'

interface NotificationPreferences {
  postPublished: boolean
  postFailed: boolean
  weeklyReport: boolean
  platformUpdates: boolean
  emailNotifications: boolean
  pushNotifications: boolean
}

export function NotificationSettings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    postPublished: true,
    postFailed: true,
    weeklyReport: false,
    platformUpdates: false,
    emailNotifications: true,
    pushNotifications: false
  })
  
  const [isSaving, setIsSaving] = useState(false)

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // TODO: Implement save logic
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      alert('Notification preferences saved!')
    } catch (error) {
      console.error('Failed to save preferences:', error)
      alert('Failed to save preferences. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const NotificationToggle = ({ 
    label, 
    description, 
    checked, 
    onChange 
  }: { 
    label: string
    description: string
    checked: boolean
    onChange: () => void 
  }) => (
    <div className="flex items-start justify-between py-4">
      <div className="flex-1">
        <h4 className="text-sm font-medium text-gray-900">{label}</h4>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          checked ? 'bg-blue-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Notification Settings</h2>
        <p className="mt-2 text-gray-600">
          Choose how you want to be notified about your posts and account activity.
        </p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Post Notifications</h3>
        </div>
        <div className="px-6 divide-y divide-gray-200">
          <NotificationToggle
            label="Post Published"
            description="Get notified when your scheduled posts are successfully published"
            checked={preferences.postPublished}
            onChange={() => handleToggle('postPublished')}
          />
          <NotificationToggle
            label="Post Failed"
            description="Get notified when a scheduled post fails to publish"
            checked={preferences.postFailed}
            onChange={() => handleToggle('postFailed')}
          />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Reports & Updates</h3>
        </div>
        <div className="px-6 divide-y divide-gray-200">
          <NotificationToggle
            label="Weekly Report"
            description="Receive a weekly summary of your posting activity"
            checked={preferences.weeklyReport}
            onChange={() => handleToggle('weeklyReport')}
          />
          <NotificationToggle
            label="Platform Updates"
            description="Get notified about new features and platform changes"
            checked={preferences.platformUpdates}
            onChange={() => handleToggle('platformUpdates')}
          />
        </div>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Delivery Methods</h3>
        </div>
        <div className="px-6 divide-y divide-gray-200">
          <NotificationToggle
            label="Email Notifications"
            description="Receive notifications via email"
            checked={preferences.emailNotifications}
            onChange={() => handleToggle('emailNotifications')}
          />
          <NotificationToggle
            label="Push Notifications"
            description="Receive push notifications in your browser"
            checked={preferences.pushNotifications}
            onChange={() => handleToggle('pushNotifications')}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save Preferences'}
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-yellow-800">
              Browser Permissions Required
            </h3>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                To receive push notifications, you'll need to allow notifications in your browser settings.
                Click the notification icon in your browser's address bar to manage permissions.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}