import { useState, useMemo } from 'react'
import { PostEditor } from '@/components/posts/PostEditor'
import { Platform, CreatePostRequest, PostContent } from '@/types'

interface Draft {
  id: string
  content: PostContent
  platform: Platform
  createdAt: string
  updatedAt: string
}

export function DraftsPage() {
  const [showEditor, setShowEditor] = useState(false)
  const [editingDraft, setEditingDraft] = useState<Draft | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('threads')

  // Load drafts from localStorage
  const [drafts, setDrafts] = useState<Draft[]>(() => {
    const savedDrafts = localStorage.getItem('social-scheduler-drafts')
    return savedDrafts ? JSON.parse(savedDrafts) : []
  })

  // Save drafts to localStorage
  const saveDrafts = (newDrafts: Draft[]) => {
    setDrafts(newDrafts)
    localStorage.setItem('social-scheduler-drafts', JSON.stringify(newDrafts))
  }

  // Group drafts by platform
  const groupedDrafts = useMemo(() => {
    const groups = new Map<Platform, Draft[]>()
    
    drafts.forEach(draft => {
      if (!groups.has(draft.platform)) {
        groups.set(draft.platform, [])
      }
      groups.get(draft.platform)!.push(draft)
    })
    
    // Sort drafts within groups by updated date (most recent first)
    groups.forEach((draftList) => {
      draftList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    })
    
    return groups
  }, [drafts])

  const handleSaveDraft = (request: CreatePostRequest) => {
    const now = new Date().toISOString()
    
    if (editingDraft) {
      // Update existing draft
      const updatedDrafts = drafts.map(draft => 
        draft.id === editingDraft.id 
          ? { ...draft, content: request.content, platform: request.platform, updatedAt: now }
          : draft
      )
      saveDrafts(updatedDrafts)
      setEditingDraft(null)
    } else {
      // Create new draft
      const newDraft: Draft = {
        id: Date.now().toString(),
        content: request.content,
        platform: request.platform,
        createdAt: now,
        updatedAt: now
      }
      saveDrafts([...drafts, newDraft])
    }
    
    setShowEditor(false)
  }

  const handleDeleteDraft = (draftId: string) => {
    if (confirm('Are you sure you want to delete this draft?')) {
      const updatedDrafts = drafts.filter(draft => draft.id !== draftId)
      saveDrafts(updatedDrafts)
    }
  }

  const handleEditDraft = (draft: Draft) => {
    setEditingDraft(draft)
    setSelectedPlatform(draft.platform)
    setShowEditor(true)
  }

  const handleScheduleDraft = (draft: Draft) => {
    // This would integrate with the existing scheduling system
    // For now, we'll just show an alert
    alert('Schedule functionality will be integrated with existing post scheduling system')
  }

  if (showEditor) {
    return (
      <PostEditor
        platform={selectedPlatform}
        initialContent={editingDraft?.content}
        onSave={handleSaveDraft}
        onCancel={() => {
          setShowEditor(false)
          setEditingDraft(null)
        }}
        loading={false}
        isDraft={true}
      />
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Drafts</h1>
          <p className="mt-2 text-gray-400">
            Create and edit posts without publishing. Save for later or schedule when ready.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value as Platform)}
            className="px-3 py-2 border border-gray-700 rounded-lg text-sm bg-gray-800 text-white"
          >
            <option value="threads">🧵 Threads</option>
          </select>
          <button 
            onClick={() => setShowEditor(true)}
            className="btn-primary"
          >
            New Draft
          </button>
        </div>
      </div>

      {/* Drafts list */}
      <div className="card">
        <div className="px-6 py-6 sm:p-8">
          {drafts.length > 0 ? (
            <div className="space-y-8">
              {Array.from(groupedDrafts.entries()).map(([platform, platformDrafts]) => (
                <div key={platform}>
                  <div className="flex items-center mb-4">
                    <h2 className="text-lg font-semibold text-white capitalize">
                      {platform === 'threads' ? '🧵 Threads' : platform}
                    </h2>
                    <div className="ml-3 text-sm text-gray-400">
                      {platformDrafts.length} draft{platformDrafts.length !== 1 ? 's' : ''}
                    </div>
                    <div className="flex-1 ml-4 border-t border-gray-800"></div>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {platformDrafts.map((draft) => (
                      <div key={draft.id} className="border border-gray-800 rounded-lg p-4 bg-gray-800/50 hover:bg-gray-800/70 transition-colors">
                        <div className="flex flex-col h-full">
                          <div className="flex-1 mb-4">
                            <p className="text-sm text-gray-200 line-clamp-3">
                              {draft.content.text || 'Media post'}
                            </p>
                            {((draft.content.type === 'single' || draft.content.type === 'thread') && draft.content.mediaUrls?.length) || (draft.content.type === 'media' && draft.content.mediaUrls?.length) ? (
                              <div className="mt-2 text-xs text-blue-400">
                                📎 {(draft.content.type === 'single' || draft.content.type === 'thread') ? draft.content.mediaUrls?.length : draft.content.mediaUrls?.length} media file{((draft.content.type === 'single' || draft.content.type === 'thread') ? draft.content.mediaUrls?.length : draft.content.mediaUrls?.length) !== 1 ? 's' : ''}
                              </div>
                            ) : null}
                          </div>
                          
                          <div className="space-y-3">
                            <div className="text-xs text-gray-400">
                              Updated: {new Date(draft.updatedAt).toLocaleString()}
                            </div>
                            
                            <div className="flex items-center justify-between space-x-2">
                              <button
                                onClick={() => handleEditDraft(draft)}
                                className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleScheduleDraft(draft)}
                                className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded transition-colors"
                              >
                                Schedule
                              </button>
                              <button
                                onClick={() => handleDeleteDraft(draft.id)}
                                className="text-xs text-red-400 hover:text-red-300 px-2 py-2"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-white mb-2">No drafts yet</h3>
              <p className="text-gray-400 mb-4">
                Create your first draft to save posts for later.
              </p>
              <button 
                onClick={() => setShowEditor(true)}
                className="btn-primary"
              >
                Create Your First Draft
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}