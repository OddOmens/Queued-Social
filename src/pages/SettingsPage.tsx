import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConnectedAccounts } from '@/components/settings/ConnectedAccounts'
import { TimeSlotManager } from '@/components/timeSlots/TimeSlotManager'
import { NotificationSettings } from '@/components/settings/NotificationSettings'
import { EnvDebug } from '@/components/debug/EnvDebug'
import { useAuth } from '@/hooks/useAuth'
import { useTimeSlots } from '@/hooks/useTimeSlots'

type SettingsTab = 'overview' | 'accounts' | 'timeslots' | 'notifications'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('overview')
  const { user } = useAuth()
  const { timeSlots, updateTimeSlots, loading: timeSlotsLoading, error: timeSlotsError } = useTimeSlots(user?.id || '')

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '⚙️' },
    { id: 'accounts', label: 'Connected Accounts', icon: '🔗' },
    { id: 'timeslots', label: 'Time Slots', icon: '⏰' },
    { id: 'notifications', label: 'Notifications', icon: '🔔' }
  ] as const

  const renderContent = () => {
    switch (activeTab) {
      case 'accounts':
        return <ConnectedAccounts />
      case 'timeslots':
        return (
          <div className="space-y-4">
            {timeSlotsError && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="text-sm text-red-700">
                  Failed to load time slots: {timeSlotsError.message}
                </div>
              </div>
            )}
            <TimeSlotManager 
              timeSlots={timeSlots}
              loading={timeSlotsLoading}
              onSave={updateTimeSlots}
            />
          </div>
        )
      case 'notifications':
        return <NotificationSettings />
      default:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Settings Overview</h2>
              <p className="mt-2 text-gray-600">
                Manage your account and application preferences.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link
                to="/settings/profile"
                className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <span className="text-blue-600 text-xl">👤</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Profile</h3>
                    <p className="text-sm text-gray-500">Update your personal information</p>
                  </div>
                </div>
              </Link>

              <button
                onClick={() => setActiveTab('accounts')}
                className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow text-left"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <span className="text-green-600 text-xl">🔗</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Connected Accounts</h3>
                    <p className="text-sm text-gray-500">Manage your social media connections</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('timeslots')}
                className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow text-left"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                    <span className="text-purple-600 text-xl">⏰</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Time Slots</h3>
                    <p className="text-sm text-gray-500">Configure your posting schedule</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className="bg-white p-6 rounded-lg shadow hover:shadow-md transition-shadow text-left"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                    <span className="text-red-600 text-xl">🔔</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
                    <p className="text-sm text-gray-500">Manage your notification preferences</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your account and application preferences.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {renderContent()}
      
      {/* Debug component for troubleshooting */}
      <EnvDebug />
    </div>
  )
}