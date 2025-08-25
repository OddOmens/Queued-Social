/**
 * Platform Plugin Registry
 * Initializes and registers all platform plugins
 */

import { platformManager } from '../platformManager'
import { MockPlatformPlugin } from './mockPlugin'

/**
 * Initialize all platform plugins
 * This should be called once at app startup
 */
export function initializePlatformPlugins(): void {
  // Register mock plugins for all supported platforms
  // In production, these would be replaced with real platform plugins
  
  const platforms = [
    { name: 'threads' as const, displayName: 'Threads' }
  ]

  platforms.forEach(({ name, displayName }) => {
    const plugin = new MockPlatformPlugin(name, displayName)
    platformManager.registerPlugin(plugin)
    console.log(`Registered mock plugin for ${displayName}`)
  })

  console.log(`Initialized ${platforms.length} platform plugins`)
}

/**
 * Get the status of all registered plugins
 */
export function getPluginStatus() {
  return platformManager.getPluginStatus()
}