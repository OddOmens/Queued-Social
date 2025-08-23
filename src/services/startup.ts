import { jobScheduler } from './jobScheduler';

/**
 * Initialize all background services when the application starts
 */
export function initializeServices(): void {
  console.log('Initializing background services...');
  
  // Start the job scheduler
  jobScheduler.start();
  
  // Set up graceful shutdown
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully...');
    jobScheduler.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully...');
    jobScheduler.stop();
    process.exit(0);
  });

  console.log('Background services initialized successfully');
}

/**
 * Cleanup services on shutdown
 */
export function shutdownServices(): void {
  console.log('Shutting down background services...');
  jobScheduler.stop();
  console.log('Background services shut down successfully');
}