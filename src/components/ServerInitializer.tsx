'use client';

import { useEffect } from 'react';

/**
 * Client-side component to trigger server initialization
 * This will call the API to start services when the app loads
 */
export function ServerInitializer() {
  useEffect(() => {
    // Only run on client side and only once
    if (typeof window !== 'undefined') {
      initializeServerServices();
    }
  }, []);

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