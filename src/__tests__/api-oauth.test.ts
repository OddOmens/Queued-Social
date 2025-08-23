import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getPlatforms, POST as managePlatforms } from '../app/api/auth/platforms/route';
import { GET as threadsCallback } from '../app/api/auth/threads/callback/route';
import { POST as testPlatform } from '../app/api/platforms/test/route';

// Mock dependencies
vi.mock('../middleware/auth', () => ({
  withAuth: vi.fn(),
}));

vi.mock('../services/credentialManager', () => ({
  credentialManager: {
    getAllCredentials: vi.fn(),
    generateAuthUrl: vi.fn(),
    removeCredentials: vi.fn(),
    validateCredentials: vi.fn(),
    exchangeCodeForTokens: vi.fn(),
    storeCredentials: vi.fn(),
    getCredentials: vi.fn(),
  },
}));

vi.mock('../services/platformManager', () => ({
  PlatformManager: {
    getInstance: vi.fn(() => ({
      getPlugin: vi.fn(),
    })),
  },
}));

vi.mock('../services/supabase', () => ({
  createServerSupabaseClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
  })),
}));

describe('OAuth API Endpoints', () => {
  const mockUser = { id: 'user-1', email: 'test@example.com' };
  let mockWithAuth: any;
  let mockCredentialManager: any;
  let mockPlatformManager: any;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWithAuth = require('../middleware/auth').withAuth;
    mockCredentialManager = require('../services/credentialManager').credentialManager;
    mockPlatformManager = require('../services/platformManager').PlatformManager.getInstance();
    mockSupabase = require('../services/supabase').createServerSupabaseClient();
  });

  describe('GET /api/auth/platforms', () => {
    it('should return user platforms', async () => {
      mockWithAuth.mockResolvedValue({ user: mockUser, error: null });
      
      const mockCredentials = [
        {
          platform: 'threads',
          isActive: true,
          expiresAt: new Date(),
          createdAt: new Date(),
        },
      ];
      mockCredentialManager.getAllCredentials.mockResolvedValue(mockCredentials);

      const request = new NextRequest('http://localhost:3000/api/auth/platforms');
      const response = await getPlatforms(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockCredentials);
      expect(mockCredentialManager.getAllCredentials).toHaveBeenCalledWith('user-1');
    });

    it('should handle authentication errors', async () => {
      const mockError = new Response('Unauthorized', { status: 401 });
      mockWithAuth.mockResolvedValue({ user: null, error: mockError });

      const request = new NextRequest('http://localhost:3000/api/auth/platforms');
      const response = await getPlatforms(request);

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/platforms', () => {
    it('should generate OAuth URL for platform connection', async () => {
      mockWithAuth.mockResolvedValue({ user: mockUser, error: null });
      mockCredentialManager.generateAuthUrl.mockReturnValue('https://threads.net/oauth/authorize?...');

      const request = new NextRequest('http://localhost:3000/api/auth/platforms', {
        method: 'POST',
        body: JSON.stringify({ platform: 'threads', action: 'connect' }),
      });

      const response = await managePlatforms(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.authUrl).toBe('https://threads.net/oauth/authorize?...');
      expect(data.data.state).toContain('user-1:');
    });

    it('should disconnect platform', async () => {
      mockWithAuth.mockResolvedValue({ user: mockUser, error: null });
      mockCredentialManager.removeCredentials.mockResolvedValue(undefined);

      const request = new NextRequest('http://localhost:3000/api/auth/platforms', {
        method: 'POST',
        body: JSON.stringify({ platform: 'threads', action: 'disconnect' }),
      });

      const response = await managePlatforms(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Disconnected from threads');
      expect(mockCredentialManager.removeCredentials).toHaveBeenCalledWith('user-1', 'threads');
    });

    it('should validate platform credentials', async () => {
      mockWithAuth.mockResolvedValue({ user: mockUser, error: null });
      
      const mockValidation = {
        isValid: true,
        expiresAt: new Date(),
      };
      mockCredentialManager.validateCredentials.mockResolvedValue(mockValidation);

      const request = new NextRequest('http://localhost:3000/api/auth/platforms', {
        method: 'POST',
        body: JSON.stringify({ platform: 'threads', action: 'validate' }),
      });

      const response = await managePlatforms(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual(mockValidation);
    });

    it('should reject invalid platforms', async () => {
      mockWithAuth.mockResolvedValue({ user: mockUser, error: null });

      const request = new NextRequest('http://localhost:3000/api/auth/platforms', {
        method: 'POST',
        body: JSON.stringify({ platform: 'invalid', action: 'connect' }),
      });

      const response = await managePlatforms(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Invalid platform specified');
    });

    it('should reject invalid actions', async () => {
      mockWithAuth.mockResolvedValue({ user: mockUser, error: null });

      const request = new NextRequest('http://localhost:3000/api/auth/platforms', {
        method: 'POST',
        body: JSON.stringify({ platform: 'threads', action: 'invalid' }),
      });

      const response = await managePlatforms(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toBe('Invalid action specified');
    });
  });

  describe('GET /api/auth/threads/callback', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    });

    it('should handle successful OAuth callback', async () => {
      const mockTokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresAt: new Date(),
      };

      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
      
      mockCredentialManager.exchangeCodeForTokens.mockResolvedValue(mockTokens);
      mockCredentialManager.storeCredentials.mockResolvedValue({});

      const url = 'http://localhost:3000/api/auth/threads/callback?code=auth-code&state=user-1:1234567890';
      const request = new NextRequest(url);
      
      const response = await threadsCallback(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('success=platform_connected');
      expect(mockCredentialManager.exchangeCodeForTokens).toHaveBeenCalledWith('threads', 'auth-code', 'user-1:1234567890');
      expect(mockCredentialManager.storeCredentials).toHaveBeenCalledWith('user-1', 'threads', mockTokens);
    });

    it('should handle OAuth errors', async () => {
      const url = 'http://localhost:3000/api/auth/threads/callback?error=access_denied&error_description=User%20denied%20access';
      const request = new NextRequest(url);
      
      const response = await threadsCallback(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('error=oauth_failed');
      expect(response.headers.get('location')).toContain('message=User%20denied%20access');
    });

    it('should handle missing parameters', async () => {
      const url = 'http://localhost:3000/api/auth/threads/callback';
      const request = new NextRequest(url);
      
      const response = await threadsCallback(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('error=invalid_callback');
    });

    it('should handle invalid state', async () => {
      const url = 'http://localhost:3000/api/auth/threads/callback?code=auth-code&state=invalid-state';
      const request = new NextRequest(url);
      
      const response = await threadsCallback(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('error=invalid_state');
    });

    it('should handle expired state', async () => {
      const oldTimestamp = Date.now() - (11 * 60 * 1000); // 11 minutes ago
      const url = `http://localhost:3000/api/auth/threads/callback?code=auth-code&state=user-1:${oldTimestamp}`;
      const request = new NextRequest(url);
      
      const response = await threadsCallback(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('error=expired_state');
    });

    it('should handle authentication mismatch', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'different-user' } },
        error: null,
      });

      const url = 'http://localhost:3000/api/auth/threads/callback?code=auth-code&state=user-1:1234567890';
      const request = new NextRequest(url);
      
      const response = await threadsCallback(request);

      expect(response.status).toBe(307); // Redirect
      expect(response.headers.get('location')).toContain('error=authentication_required');
    });
  });

  describe('POST /api/platforms/test', () => {
    it('should test platform connection successfully', async () => {
      mockWithAuth.mockResolvedValue({ user: mockUser, error: null });
      
      const mockValidation = { isValid: true, expiresAt: new Date() };
      mockCredentialManager.validateCredentials.mockResolvedValue(mockValidation);
      
      const mockCredentials = {
        credentials: { accessToken: 'token' },
        expiresAt: new Date(),
      };
      mockCredentialManager.getCredentials.mockResolvedValue(mockCredentials);
      
      const mockPlugin = {
        validateContent: vi.fn(() => ({ isValid: true, errors: [] })),
      };
      mockPlatformManager.getPlugin.mockReturnValue(mockPlugin);

      const request = new NextRequest('http://localhost:3000/api/platforms/test', {
        method: 'POST',
        body: JSON.stringify({ platform: 'threads' }),
      });

      const response = await testPlatform(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.connected).toBe(true);
      expect(data.data.platform).toBe('threads');
    });

    it('should handle invalid credentials', async () => {
      mockWithAuth.mockResolvedValue({ user: mockUser, error: null });
      
      const mockValidation = { isValid: false, error: 'Token expired' };
      mockCredentialManager.validateCredentials.mockResolvedValue(mockValidation);

      const request = new NextRequest('http://localhost:3000/api/platforms/test', {
        method: 'POST',
        body: JSON.stringify({ platform: 'threads' }),
      });

      const response = await testPlatform(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.data.connected).toBe(false);
      expect(data.data.error).toBe('Token expired');
    });

    it('should handle missing plugin', async () => {
      mockWithAuth.mockResolvedValue({ user: mockUser, error: null });
      
      const mockValidation = { isValid: true };
      mockCredentialManager.validateCredentials.mockResolvedValue(mockValidation);
      mockCredentialManager.getCredentials.mockResolvedValue({ credentials: {} });
      mockPlatformManager.getPlugin.mockReturnValue(null);

      const request = new NextRequest('http://localhost:3000/api/platforms/test', {
        method: 'POST',
        body: JSON.stringify({ platform: 'threads' }),
      });

      const response = await testPlatform(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(false);
      expect(data.data.connected).toBe(false);
      expect(data.data.error).toBe('No plugin available for threads');
    });
  });
});