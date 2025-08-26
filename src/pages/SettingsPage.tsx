import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ConnectedAccounts } from '@/components/settings/ConnectedAccounts'
import { TimeSlotManager } from '@/components/timeSlots/TimeSlotManager'
import { NotificationSettings } from '@/components/settings/NotificationSettings'
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
              <div className="bg-red-900/50 border border-red-800 rounded-md p-4">
                <div className="text-sm text-red-200">
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
              <h2 className="text-2xl font-bold text-white">Settings Overview</h2>
              <p className="mt-2 text-gray-400">
                Manage your account and application preferences.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link
                to="/settings/profile"
                className="card-hover p-6"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center">
                    <span className="text-blue-400 text-xl">👤</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-white">Profile</h3>
                    <p className="text-sm text-gray-400">Update your personal information</p>
                  </div>
                </div>
              </Link>

              <button
                onClick={() => setActiveTab('accounts')}
                className="card p-6 text-left"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-green-900/50 rounded-lg flex items-center justify-center">
                    <span className="text-green-400 text-xl">🔗</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-white">Connected Accounts</h3>
                    <p className="text-sm text-gray-400">Manage your social media connections</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('timeslots')}
                className="card p-6 text-left"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-purple-900/50 rounded-lg flex items-center justify-center">
                    <span className="text-purple-400 text-xl">⏰</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-white">Time Slots</h3>
                    <p className="text-sm text-gray-400">Configure your posting schedule</p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('notifications')}
                className="card p-6 text-left"
              >
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-red-900/50 rounded-lg flex items-center justify-center">
                    <span className="text-red-400 text-xl">🔔</span>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-white">Notifications</h3>
                    <p className="text-sm text-gray-400">Manage your notification preferences</p>
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
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="mt-2 text-gray-400">
          Manage your account and application preferences.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-200 hover:border-gray-600'
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
    </div>
  )
}