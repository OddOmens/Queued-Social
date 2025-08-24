'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/auth';

/**
 * Client-side component to trigger server initialization
 * This will call the API to start services when the user is authenticated
 */
export function ServerInitializer() {
  const { user, initialized } = useAuthStore();

  useEffect(() => {
    // Only run when user is authenticated and auth is initialized
    if (user && initialized && typeof window !== 'undefined') {
      initializeServerServices();
    }
  }, [user, initialized]);

  const initializeServerServices = async () => {
    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });

      if (response.ok) {
        console.log('Server services initialized successfully');
      } else {
        console.warn('Failed to initialize server services');
      }
    } catch (error) {
      console.warn('Error initializing server services:', error);
    }
  };

  return null; // This component doesn't render anything
}