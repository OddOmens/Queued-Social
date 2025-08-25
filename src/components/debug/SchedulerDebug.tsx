import { useState } from 'react'
import { appScheduler } from '@/services/appScheduler'
import { createClient } from '@/services/supabase'

export function SchedulerDebug() {
  const [status, setStatus] = useState<string>('Ready')
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 9)])
  }

  const handleTriggerProcessing = async () => {
    setStatus('Processing...')
    addLog('Manually triggering post processing...')
    
    try {
      await appScheduler.triggerProcessing()
      addLog('✓ Processing completed successfully')
      setStatus('Completed')
    } catch (error) {
      addLog(`✗ Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setStatus('Failed')
    }
  }

  const handleTestDatabaseFunction = async () => {
    setStatus('Testing database function...')
    addLog('Testing database trigger function...')
    
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('trigger_post_processing')
      
      if (error) {
        addLog(`✗ Database function failed: ${error.message}`)
        setStatus('Failed')
      } else {
        addLog(`✓ Database function result: ${JSON.stringify(data)}`)
        setStatus('Completed')
      }
    } catch (error) {
      addLog(`✗ Database function error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setStatus('Failed')
    }
  }

  const handleCheckScheduledPosts = async () => {
    setStatus('Checking posts...')
    addLog('Checking scheduled posts...')
    
    try {
      const supabase = createClient()
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      
      const { data: posts, error } = await supabase
        .from('scheduled_posts')
        .select('id, status, scheduled_time, platform')
        .gte('scheduled_time', oneHourAgo.toISOString())
        .order('scheduled_time', { ascending: false })
        .limit(10)
      
      if (error) {
        addLog(`✗ Query failed: ${error.message}`)
        setStatus('Failed')
      } else {
        addLog(`✓ Found ${posts?.length || 0} recent posts`)
        posts?.forEach(post => {
          const time = new Date(post.scheduled_time).toLocaleString()
          addLog(`  - ${post.id}: ${post.status} (${post.platform}) at ${time}`)
        })
        setStatus('Completed')
      }
    } catch (error) {
      addLog(`✗ Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setStatus('Failed')
    }
  }

  const schedulerStatus = appScheduler.getStatus()

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Scheduler Debug</h3>
      
      <div className="space-y-4">
        {/* Status */}
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">App Scheduler:</span>
          <span className={`px-2 py-1 text-xs rounded-full ${
            schedulerStatus.isRunning 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {schedulerStatus.isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-700">Current Status:</span>
          <span className="text-sm text-gray-600">{status}</span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleTriggerProcessing}
            className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Trigger Processing
          </button>
          
          <button
            onClick={handleTestDatabaseFunction}
            className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Test DB Function
          </button>
          
          <button
            onClick={handleCheckScheduledPosts}
            className="px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
          >
            Check Posts
          </button>
        </div>

        {/* Logs */}
        {logs.length > 0 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Activity:</h4>
            <div className="bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
              {logs.map((log, index) => (
                <div key={index} className="text-xs font-mono text-gray-600 mb-1">
                  {log}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}