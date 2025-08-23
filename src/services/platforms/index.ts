// ============================================================================
// PLATFORM PLUGINS INITIALIZATION
// ============================================================================

import { platformManager } from '../platformManager'
import { ThreadsPlugin } from './threadsPlugin'

/**
 * Initialize and register all available platform plugins
 */
export function initializePlatformPlugins(): void {
  // Register Threads plugin
  const threadsPlugin = new ThreadsPlugin()
  platformManager.registerPlugin(threadsPlugin)
  
  // Future plugins can be registered here
  // const twitterPlugin = new TwitterPlugin()
  // platformManager.registerPlugin(twitterPlugin)
  
  console.log('Platform plugins initialized:', platformManager.getRegisteredPlatforms())
}

/**
 * Get the platform manager instance
 */
export { platformManager } from '../platformManager'

/**
 * Export individual plugins for direct use if needed
 */
export { ThreadsPlugin } from './threadsPlugin'

/**
 * Export platform manager classes for extension
 */
export { PlatformManager, BasePlatformPlugin } from '../platformManager'