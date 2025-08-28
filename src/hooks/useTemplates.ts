import { useState, useEffect, useCallback } from 'react'
import { createDbService } from '@/services/database'
import { supabase } from '@/services/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Template, Platform, CreateTemplateRequest, UpdateTemplateRequest } from '@/types'

interface UseTemplatesOptions {
  category?: string
  platform?: Platform
}

interface UseTemplatesReturn {
  templates: Template[]
  loading: boolean
  error: string | null
  createTemplate: (request: CreateTemplateRequest) => Promise<Template>
  updateTemplate: (id: string, request: UpdateTemplateRequest) => Promise<Template>
  deleteTemplate: (id: string) => Promise<void>
  refetch: () => Promise<void>
}

export function useTemplates(options: UseTemplatesOptions = {}): UseTemplatesReturn {
  const { user } = useAuth()
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const dbService = createDbService()

  const fetchTemplates = useCallback(async () => {
    if (!user) {
      setTemplates([])
      setLoading(false)
      return
    }

    try {
      setError(null)
      const data = await dbService.getTemplates(user.id, {
        category: options.category,
        platform: options.platform
      })
      setTemplates(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch templates')
      console.error('Failed to fetch templates:', err)
    } finally {
      setLoading(false)
    }
  }, [user, options.category, options.platform, dbService])

  const createTemplate = useCallback(async (request: CreateTemplateRequest): Promise<Template> => {
    if (!user) throw new Error('User not authenticated')

    try {
      setError(null)
      const template = await dbService.createTemplate({
        userId: user.id,
        name: request.name,
        content: request.content,
        platform: request.platform,
        category: request.category || 'General'
      })
      
      setTemplates(prev => [...prev, template])
      return template
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create template'
      setError(message)
      throw new Error(message)
    }
  }, [user, dbService])

  const updateTemplate = useCallback(async (id: string, request: UpdateTemplateRequest): Promise<Template> => {
    if (!user) throw new Error('User not authenticated')

    try {
      setError(null)
      const template = await dbService.updateTemplate(id, request)
      
      setTemplates(prev => prev.map(t => t.id === id ? template : t))
      return template
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update template'
      setError(message)
      throw new Error(message)
    }
  }, [user, dbService])

  const deleteTemplate = useCallback(async (id: string): Promise<void> => {
    if (!user) throw new Error('User not authenticated')

    try {
      setError(null)
      await dbService.deleteTemplate(id)
      
      setTemplates(prev => prev.filter(t => t.id !== id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete template'
      setError(message)
      throw new Error(message)
    }
  }, [user, dbService])

  const refetch = useCallback(async () => {
    setLoading(true)
    await fetchTemplates()
  }, [fetchTemplates])

  // Initial fetch
  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  // Set up real-time subscription
  useEffect(() => {
    if (!user) return

    const subscription = supabase
      .channel('templates_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'templates',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Templates change detected:', payload)
          fetchTemplates()
        }
      )
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [user, fetchTemplates])

  return {
    templates,
    loading,
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    refetch
  }
}