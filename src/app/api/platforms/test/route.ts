import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../middleware/auth';
import { credentialManager } from '../../../../services/credentialManager';
import { PlatformManager } from '../../../../services/platformManager';
import { Platform } from '../../../../types';

// POST /api/platforms/test - Test platform connection
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await withAuth(request);
    if (error) {
      return error;
    }

    const body = await request.json();
    const { platform } = body;

    if (!platform || !['threads', 'twitter', 'instagram', 'linkedin'].includes(platform)) {
      return NextResponse.json(
        { 
          success: false, 
          error: { 
            code: 'VALIDATION_ERROR',
            message: 'Invalid platform specified'
          }
        },
        { status: 400 }
      );
    }

    // Validate credentials
    const validation = await credentialManager.validateCredentials(user!.id, platform as Platform);
    
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        data: {
          connected: false,
          error: validation.error,
          expiresAt: validation.expiresAt
        }
      });
    }

    // Get credentials and test with platform plugin
    const credentials = await credentialManager.getCredentials(user!.id, platform as Platform);
    
    if (!credentials) {
      return NextResponse.json({
        success: false,
        data: {
          connected: false,
          error: 'No credentials found'
        }
      });
    }

    // Test connection using platform plugin
    const platformManager = PlatformManager.getInstance();
    const plugin = platformManager.getPlugin(platform as Platform);
    
    if (!plugin) {
      return NextResponse.json({
        success: false,
        data: {
          connected: false,
          error: `No plugin available for ${platform}`
        }
      });
    }

    // Test with a simple validation call
    try {
      // For Threads, we can test by validating a simple text post
      const testContent = {
        type: 'single' as const,
        text: 'Test connection',
        metadata: {}
      };
      
      const contentValidation = plugin.validateContent(testContent);
      
      if (!contentValidation.isValid) {
        return NextResponse.json({
          success: false,
          data: {
            connected: false,
            error: 'Plugin validation failed'
          }
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          connected: true,
          platform,
          expiresAt: credentials.expiresAt,
          lastTested: new Date().toISOString()
        }
      });

    } catch (pluginError) {
      console.error('Plugin test error:', pluginError);
      return NextResponse.json({
        success: false,
        data: {
          connected: false,
          error: pluginError instanceof Error ? pluginError.message : 'Plugin test failed'
        }
      });
    }

  } catch (error) {
    console.error('Error testing platform connection:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to test platform connection'
        }
      },
      { status: 500 }
    );
  }
}