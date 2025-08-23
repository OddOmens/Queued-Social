import { NextRequest, NextResponse } from 'next/server';
import { jobScheduler } from '../../../services/jobScheduler';
import { withAuth } from '../../../middleware/auth';

// GET /api/jobs - Get job queue status
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await withAuth(request);
    if (error) {
      return error;
    }

    const queueStatus = jobScheduler.getQueueStatus();
    
    return NextResponse.json({
      success: true,
      data: {
        isRunning: true, // TODO: Add method to check if scheduler is running
        queueLength: queueStatus.length,
        jobs: queueStatus
      }
    });

  } catch (error) {
    console.error('Error getting job status:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get job status'
        }
      },
      { status: 500 }
    );
  }
}

// POST /api/jobs/start - Start the job scheduler
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await withAuth(request);
    if (error) {
      return error;
    }

    const body = await request.json();
    const { action, postId } = body;

    if (action === 'start') {
      jobScheduler.start();
      return NextResponse.json({
        success: true,
        message: 'Job scheduler started'
      });
    }

    if (action === 'stop') {
      jobScheduler.stop();
      return NextResponse.json({
        success: true,
        message: 'Job scheduler stopped'
      });
    }

    if (action === 'cleanup') {
      jobScheduler.cleanupQueue();
      return NextResponse.json({
        success: true,
        message: 'Job queue cleaned up'
      });
    }

    if (action === 'process' && postId) {
      const result = await jobScheduler.processPostManually(postId);
      return NextResponse.json({
        success: result.success,
        message: result.success ? 'Post processed successfully' : result.error,
        data: result
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'VALIDATION_ERROR',
          message: 'Invalid action or missing parameters'
        }
      },
      { status: 400 }
    );

  } catch (error) {
    console.error('Error managing job scheduler:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: { 
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to manage job scheduler'
        }
      },
      { status: 500 }
    );
  }
}