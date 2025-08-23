import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../middleware/auth';
import { credentialManager } from '../../../../services/credentialManager';
import { Platform } from '../../../../types';

// GET /api/auth/platforms - Get user's connected platforms
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await withAuth(request);
    if (error) {
      return error;
    }

    const credentials = await credentialManager.getAllCredentials(user!.id);
    
    const platforms = credentials.map(cred => ({
      platform: cred.platform,
      isActive: cred.isActive,
      expiresAt: cred.expiresAt,
      createdAt: cred.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: platforms
    });

  } catch (error) {
    console.error('Error getting platforms:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get platforms'
        }
      },
      { status: 500 }
    );
  }
}

// POST /api/auth/platforms - Connect a new platform
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await withAuth(request);
    if (error) {
      return error;
    }

    const body = await request.json();
    const { platform, action } = body;

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

    if (action === 'connect') {
      // Generate OAuth URL
      const state = `${user!.id}:${Date.now()}`;
      const authUrl = credentialManager.generateAuthUrl(platform as Platform, state);
      
      return NextResponse.json({
        success: true,
        data: {
          authUrl,
          state
        }
      });
    }

    if (action === 'disconnect') {
      await credentialManager.removeCredentials(user!.id, platform as Platform);
      
      return NextResponse.json({
        success: true,
        message: `Disconnected from ${platform}`
      });
    }

    if (action === 'validate') {
      const validation = await credentialManager.validateCredentials(user!.id, platform as Platform);
      
      return NextResponse.json({
        success: true,
        data: validation
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR',
          message: 'Invalid action specified'
        }
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error managing platform connection:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to manage platform connection'
        }
      },
      { status: 500 }
    );
  }
}