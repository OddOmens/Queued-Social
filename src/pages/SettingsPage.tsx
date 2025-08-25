import { Link } from 'react-router-dom'

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
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

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <span className="text-green-600 text-xl">🔗</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Connected Accounts</h3>
              <p className="text-sm text-gray-500">Manage your social media connections</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <span className="text-purple-600 text-xl">⏰</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Time Slots</h3>
              <p className="text-sm text-gray-500">Configure your posting schedule</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <span className="text-red-600 text-xl">🔔</span>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Notifications</h3>
              <p className="text-sm text-gray-500">Manage your notification preferences</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}