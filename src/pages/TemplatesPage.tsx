import { useState, useMemo } from 'react'
import { PostEditor } from '@/components/posts/PostEditor'
import { Platform, CreatePostRequest, PostContent } from '@/types'

interface Template {
  id: string
  name: string
  content: PostContent
  platform: Platform
  category: string
  createdAt: string
  updatedAt: string
}

const defaultTemplates: Template[] = [
  {
    id: 'template-1',
    name: 'Daily Motivation',
    content: {
      type: 'single',
      text: '🌟 Today\'s motivation:\n\n[Your motivational quote here]\n\n#motivation #inspiration #dailyquote',
      metadata: {
        replySettings: 'everyone' as const,
        allowReplies: true
      }
    },
    platform: 'threads',
    category: 'Motivation',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'template-2',
    name: 'Product Announcement',
    content: {
      type: 'single',
      text: '🚀 Exciting news!\n\n[Describe your product/feature]\n\n✨ Key benefits:\n• [Benefit 1]\n• [Benefit 2]\n• [Benefit 3]\n\n#product #announcement #launch',
      metadata: {
        replySettings: 'everyone' as const,
        allowReplies: true
      }
    },
    platform: 'threads',
    category: 'Business',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'template-3',
    name: 'Behind the Scenes',
    content: {
      type: 'single',
      text: '👀 Behind the scenes:\n\n[Share what you\'re working on]\n\n[Add some personal touch or interesting detail]\n\n#behindthescenes #process #work',
      metadata: {
        replySettings: 'everyone' as const,
        allowReplies: true
      }
    },
    platform: 'threads',
    category: 'Personal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
]

export function TemplatesPage() {
  const [showEditor, setShowEditor] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [usingTemplate, setUsingTemplate] = useState<Template | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform>('threads')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [templateName, setTemplateName] = useState('')
  const [templateCategory, setTemplateCategory] = useState('General')

  // Load templates from localStorage with defaults
  const [templates, setTemplates] = useState<Template[]>(() => {
    const savedTemplates = localStorage.getItem('social-scheduler-templates')
    if (savedTemplates) {
      const parsed = JSON.parse(savedTemplates)
      // Merge with default templates if they don't exist
      const existingIds = parsed.map((t: Template) => t.id)
      const newDefaults = defaultTemplates.filter(t => !existingIds.includes(t.id))
      return [...parsed, ...newDefaults]
    }
    return defaultTemplates
  })

  // Save templates to localStorage
  const saveTemplates = (newTemplates: Template[]) => {
    setTemplates(newTemplates)
    localStorage.setItem('social-scheduler-templates', JSON.stringify(newTemplates))
  }

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set(templates.map(t => t.category))
    return Array.from(cats).sort()
  }, [templates])

  // Filter templates
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => 
      selectedCategory === 'all' || template.category === selectedCategory
    ).sort((a, b) => a.name.localeCompare(b.name))
  }, [templates, selectedCategory])

  const handleSaveTemplate = (request: CreatePostRequest) => {
    const now = new Date().toISOString()
    
    if (editingTemplate) {
      // Update existing template
      const updatedTemplates = templates.map(template => 
        template.id === editingTemplate.id 
          ? { 
              ...template, 
              name: templateName || editingTemplate.name,
              content: request.content, 
              platform: request.platform, 
              category: templateCategory,
              updatedAt: now 
            }
          : template
      )
      saveTemplates(updatedTemplates)
      setEditingTemplate(null)
    } else {
      // Create new template
      const newTemplate: Template = {
        id: Date.now().toString(),
        name: templateName || 'Untitled Template',
        content: request.content,
        platform: request.platform,
        category: templateCategory,
        createdAt: now,
        updatedAt: now
      }
      saveTemplates([...templates, newTemplate])
    }
    
    setShowEditor(false)
    setTemplateName('')
    setTemplateCategory('General')
  }

  const handleDeleteTemplate = (templateId: string) => {
    if (confirm('Are you sure you want to delete this template?')) {
      const updatedTemplates = templates.filter(template => template.id !== templateId)
      saveTemplates(updatedTemplates)
    }
  }

  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template)
    setTemplateName(template.name)
    setTemplateCategory(template.category)
    setSelectedPlatform(template.platform)
    setShowEditor(true)
  }

  const handleDraftTemplate = (template: Template) => {
    // Save template as a new draft
    const drafts = JSON.parse(localStorage.getItem('social-scheduler-drafts') || '[]')
    const newDraft = {
      id: Date.now().toString(),
      content: template.content,
      platform: template.platform,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    drafts.push(newDraft)
    localStorage.setItem('social-scheduler-drafts', JSON.stringify(drafts))
    
    alert(`Template "${template.name}" has been saved as a new draft! You can find it in the Drafts tab.`)
  }

  const handleUseTemplate = (template: Template) => {
    // Open template for immediate editing/posting
    setUsingTemplate(template)
    setSelectedPlatform(template.platform)
    setShowEditor(true)
  }

  const handleUseTemplateSave = (request: CreatePostRequest) => {
    setUsingTemplate(null)
    setShowEditor(false)
    
    // Here you would normally integrate with the posting/scheduling system
    alert(`Post ${request.schedulingType === 'now' ? 'published' : 'scheduled'} successfully using template!`)
  }

  if (showEditor) {
    // If using a template for posting, show the full post editor
    if (usingTemplate) {
      return (
        <PostEditor
          platform={usingTemplate.platform}
          initialContent={usingTemplate.content}
          onSave={handleUseTemplateSave}
          onCancel={() => {
            setShowEditor(false)
            setUsingTemplate(null)
          }}
          loading={false}
          isEditing={false}
        />
      )
    }

    // Otherwise, show the template editor
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="px-6 py-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Template Name
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="Enter template name..."
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Category
                </label>
                <input
                  type="text"
                  value={templateCategory}
                  onChange={(e) => setTemplateCategory(e.target.value)}
                  placeholder="Enter category..."
                  className="w-full px-3 py-2 border border-gray-700 rounded-lg bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>
        
        <PostEditor
          platform={selectedPlatform}
          initialContent={editingTemplate?.content}
          onSave={handleSaveTemplate}
          onCancel={() => {
            setShowEditor(false)
            setEditingTemplate(null)
            setTemplateName('')
            setTemplateCategory('General')
          }}
          loading={false}
          isTemplate={true}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Templates</h1>
          <p className="mt-2 text-gray-400">
            Create reusable post templates to save time and maintain consistency.
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-700 rounded-lg text-sm bg-gray-800 text-white"
          >
            <option value="all">All Categories</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
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
            New Template
          </button>
        </div>
      </div>

      {/* Templates grid */}
      <div className="card">
        <div className="px-6 py-6 sm:p-8">
          {filteredTemplates.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <div key={template.id} className="border border-gray-800 rounded-lg p-4 bg-gray-800/50 hover:bg-gray-800/70 transition-colors">
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-white mb-1">{template.name}</h3>
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-xs bg-blue-600 text-blue-100 px-2 py-1 rounded">
                            {template.category}
                          </span>
                          <span className="text-xs text-gray-400 capitalize">
                            {template.platform === 'threads' ? '🧵 Threads' : template.platform}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex-1 mb-4">
                      <p className="text-sm text-gray-200 line-clamp-4">
                        {template.content.text || 'Media template'}
                      </p>
                      {((template.content.type === 'single' || template.content.type === 'thread') && template.content.mediaUrls?.length) || (template.content.type === 'media' && template.content.mediaUrls?.length) ? (
                        <div className="mt-2 text-xs text-blue-400">
                          📎 {(template.content.type === 'single' || template.content.type === 'thread') ? template.content.mediaUrls?.length : template.content.mediaUrls?.length} media file{((template.content.type === 'single' || template.content.type === 'thread') ? template.content.mediaUrls?.length : template.content.mediaUrls?.length) !== 1 ? 's' : ''}
                        </div>
                      ) : null}
                    </div>
                    
                    <div className="space-y-3">
                      <div className="text-xs text-gray-400">
                        Updated: {new Date(template.updatedAt).toLocaleDateString()}
                      </div>
                      
                      <div className="flex items-center justify-between space-x-2">
                        <button
                          onClick={() => handleDraftTemplate(template)}
                          className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-2 py-2 rounded transition-colors font-medium"
                          title="Create draft from template"
                        >
                          Draft
                        </button>
                        <button
                          onClick={() => handleUseTemplate(template)}
                          className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-2 py-2 rounded transition-colors font-medium"
                          title="Use template to post now"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => handleEditTemplate(template)}
                          className="flex-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white px-2 py-2 rounded transition-colors"
                          title="Edit template"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="flex-1 text-xs bg-gray-800 hover:bg-red-900 text-gray-400 hover:text-red-300 px-2 py-2 rounded transition-colors"
                          title="Delete template"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-white mb-2">
                {selectedCategory === 'all' ? 'No templates yet' : `No templates in "${selectedCategory}"`}
              </h3>
              <p className="text-gray-400 mb-4">
                {selectedCategory === 'all' 
                  ? 'Create your first template to save time on future posts.'
                  : `Create templates in the "${selectedCategory}" category.`
                }
              </p>
              <button 
                onClick={() => setShowEditor(true)}
                className="btn-primary"
              >
                Create Your First Template
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}