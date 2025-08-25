import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CredentialManager, OAuthTokens } from '../services/credentialManager';
import { createClient } from '../services/supabase';
import { Platform } from '../types';
import crypto from 'crypto';

// Mock dependencies
vi.mock('../services/supabase', () => ({
  createClient: vi.fn(),
}));

vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => Buffer.from('mock-random-bytes')),
    createCipher: vi.fn(),
    createDecipher: vi.fn(),
  },
}));

// Mock fetch for OAuth calls
global.fetch = vi.fn();

describe('CredentialManager', () => {
  let credentialManager: CredentialManager;
  let mockSupabase: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset singleton instance
    (CredentialManager as any).instance = undefined;
    credentialManager = CredentialManager.getInstance();
    
    mockSupabase = {
      from: vi.fn(() => ({
        upsert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(),
          })),
        })),
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(),
              })),
            })),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(),
          })),
        })),
      })),
    };
    
    (createClient as any).mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CredentialManager.getInstance();
      const instance2 = CredentialManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Credential Storage', () => {
    const mockTokens: OAuthTokens = {
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      tokenType: 'Bearer',
      scope: 'threads_basic,threads_content_publish',
    };

    it('should store credentials successfully', async () => {
      // Mock encryption
      const mockCipher = {
        update: vi.fn(() => 'encrypted-part1'),
        final: vi.fn(() => 'encrypted-part2'),
        getAuthTag: vi.fn(() => Buffer.from('auth-tag')),
      };
      (crypto.createCipher as any).mockReturnValue(mockCipher);

      // Mock database response
      const mockDbResponse = {
        id: 'cred-1',
        user_id: 'user-1',
        platform: 'threads',
        credentials: { encrypted: 'mock-encrypted-data' },
        is_active: true,
        expires_at: mockTokens.expiresAt!.toISOString(),
        created_at: new Date().toISOString(),
      };

      mockSupabase.from().upsert().select().single.mockResolvedValue({
        data: mockDbResponse,
        error: null,
      });

      const result = await credentialManager.storeCredentials('user-1', 'threads', mockTokens);

      expect(result).toEqual({
        id: 'cred-1',
        userId: 'user-1',
        platform: 'threads',
        credentials: mockTokens,
        isActive: true,
        expiresAt: mockTokens.expiresAt,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('platform_credentials');
      expect(mockSupabase.from().upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          platform: 'threads',
          is_active: true,
        }),
        { onConflict: 'user_id,platform' }
      );
    });

    it('should handle storage errors', async () => {
      mockSupabase.from().upsert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(
        credentialManager.storeCredentials('user-1', 'threads', mockTokens)
      ).rejects.toThrow('Failed to store credentials: Database error');
    });
  });

  describe('Credential Retrieval', () => {
    it('should retrieve credentials successfully', async () => {
      // Mock decryption
      const mockDecipher = {
        setAuthTag: vi.fn(),
        update: vi.fn(() => 'decrypted-part1'),
        final: vi.fn(() => 'decrypted-part2'),
      };
      (crypto.createDecipher as any).mockReturnValue(mockDecipher);

      const mockTokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
      };

      // Mock database response
      const mockDbResponse = {
        id: 'cred-1',
        user_id: 'user-1',
        platform: 'threads',
        credentials: { encrypted: 'mock-encrypted-data' },
        is_active: true,
        expires_at: null,
        created_at: new Date().toISOString(),
      };

      mockSupabase.from().select().eq().eq().eq().single.mockResolvedValue({
        data: mockDbResponse,
        error: null,
      });

      // Mock JSON.parse to return our mock tokens
      const originalParse = JSON.parse;
      vi.spyOn(JSON, 'parse').mockReturnValue(mockTokens);

      const result = await credentialManager.getCredentials('user-1', 'threads');

      expect(result).toEqual({
        id: 'cred-1',
        userId: 'user-1',
        platform: 'threads',
        credentials: mockTokens,
        isActive: true,
        expiresAt: undefined,
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });

      // Restore JSON.parse
      JSON.parse = originalParse;
    });

    it('should return null when credentials not found', async () => {
      mockSupabase.from().select().eq().eq().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const result = await credentialManager.getCredentials('user-1', 'threads');
      expect(result).toBeNull();
    });
  });

  describe('Credential Validation', () => {
    it('should validate active credentials', async () => {
      const mockCredentials = {
        id: 'cred-1',
        userId: 'user-1',
        platform: 'threads' as Platform,
        credentials: { accessToken: 'valid-token' },
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock getCredentials
      vi.spyOn(credentialManager as any, 'getCredentials').mockResolvedValue(mockCredentials);

      // Mock Threads API validation
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'user-id', username: 'testuser' }),
      });

      const result = await credentialManager.validateCredentials('user-1', 'threads');

      expect(result.isValid).toBe(true);
      expect(result.expiresAt).toEqual(mockCredentials.expiresAt);
    });

    it('should detect expired credentials', async () => {
      const mockCredentials = {
        id: 'cred-1',
        userId: 'user-1',
        platform: 'threads' as Platform,
        credentials: { accessToken: 'expired-token' },
        isActive: true,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(credentialManager as any, 'getCredentials').mockResolvedValue(mockCredentials);

      const result = await credentialManager.validateCredentials('user-1', 'threads');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Credentials expired');
    });

    it('should handle invalid API tokens', async () => {
      const mockCredentials = {
        id: 'cred-1',
        userId: 'user-1',
        platform: 'threads' as Platform,
        credentials: { accessToken: 'invalid-token' },
        isActive: true,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(credentialManager as any, 'getCredentials').mockResolvedValue(mockCredentials);

      // Mock failed API response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: { message: 'Invalid access token' }
        }),
      });

      const result = await credentialManager.validateCredentials('user-1', 'threads');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid access token');
    });
  });

  describe('OAuth Flow', () => {
    beforeEach(() => {
      // Mock environment variables
      process.env.THREADS_CLIENT_ID = 'test-client-id';
      process.env.THREADS_CLIENT_SECRET = 'test-client-secret';
      process.env.THREADS_REDIRECT_URI = 'http://localhost:3000/api/auth/threads/callback';
    });

    it('should generate OAuth authorization URL', () => {
      const authUrl = credentialManager.generateAuthUrl('threads', 'test-state');
      
      expect(authUrl).toContain('https://threads.net/oauth/authorize');
      expect(authUrl).toContain('client_id=test-client-id');
      expect(authUrl).toContain('state=test-state');
      expect(authUrl).toContain('scope=threads_basic%2Cthreads_content_publish');
    });

    it('should exchange authorization code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'threads_basic,threads_content_publish',
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      });

      const tokens = await credentialManager.exchangeCodeForTokens('threads', 'auth-code');

      expect(tokens).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresAt: expect.any(Date),
        tokenType: 'Bearer',
        scope: 'threads_basic,threads_content_publish',
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'https://graph.threads.net/oauth/access_token',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        })
      );
    });

    it('should handle OAuth errors', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: 'invalid_grant',
          error_description: 'Authorization code expired',
        }),
      });

      await expect(
        credentialManager.exchangeCodeForTokens('threads', 'invalid-code')
      ).rejects.toThrow('Authorization code expired');
    });
  });

  describe('Token Refresh', () => {
    it('should refresh expired tokens', async () => {
      const mockCredentials = {
        id: 'cred-1',
        userId: 'user-1',
        platform: 'threads' as Platform,
        credentials: {
          accessToken: 'old-token',
          refreshToken: 'refresh-token',
        },
        isActive: true,
        expiresAt: new Date(Date.now() - 1000), // Expired
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(credentialManager as any, 'getCredentials').mockResolvedValue(mockCredentials);

      const mockRefreshResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      };

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockRefreshResponse),
      });

      // Mock storeCredentials
      const mockStoredCredentials = {
        ...mockCredentials,
        credentials: {
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        },
      };
      vi.spyOn(credentialManager, 'storeCredentials').mockResolvedValue(mockStoredCredentials);

      const result = await credentialManager.refreshTokens('user-1', 'threads');

      expect(result).toEqual(mockStoredCredentials);
      expect(credentialManager.storeCredentials).toHaveBeenCalledWith(
        'user-1',
        'threads',
        expect.objectContaining({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        })
      );
    });

    it('should handle refresh failures', async () => {
      const mockCredentials = {
        id: 'cred-1',
        userId: 'user-1',
        platform: 'threads' as Platform,
        credentials: {
          accessToken: 'old-token',
          refreshToken: 'invalid-refresh-token',
        },
        isActive: true,
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      vi.spyOn(credentialManager as any, 'getCredentials').mockResolvedValue(mockCredentials);

      (global.fetch as any).mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({
          error: 'invalid_grant',
        }),
      });

      const result = await credentialManager.refreshTokens('user-1', 'threads');
      expect(result).toBeNull();
    });
  });

  describe('Credential Removal', () => {
    it('should remove credentials successfully', async () => {
      mockSupabase.from().update().eq().eq.mockResolvedValue({
        error: null,
      });

      await credentialManager.removeCredentials('user-1', 'threads');

      expect(mockSupabase.from).toHaveBeenCalledWith('platform_credentials');
      expect(mockSupabase.from().update).toHaveBeenCalledWith({ is_active: false });
    });

    it('should handle removal errors', async () => {
      mockSupabase.from().update().eq().eq.mockResolvedValue({
        error: { message: 'Database error' },
      });

      await expect(
        credentialManager.removeCredentials('user-1', 'threads')
      ).rejects.toThrow('Failed to remove credentials: Database error');
    });
  });
});