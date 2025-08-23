import { createAdminSupabaseClient, createServerSupabaseClient } from './supabase-server';
import { PlatformCredentials, Platform } from '../types';
import crypto from 'crypto';

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  authUrl: string;
  tokenUrl: string;
}

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string;
}

export interface CredentialValidationResult {
  isValid: boolean;
  error?: string;
  expiresAt?: Date;
}

export class CredentialManager {
  private static instance: CredentialManager;
  private encryptionKey: string;

  private constructor() {
    this.encryptionKey = process.env.CREDENTIAL_ENCRYPTION_KEY || 'default-key-change-in-production';
    if (this.encryptionKey === 'default-key-change-in-production') {
      console.warn('Using default encryption key. Set CREDENTIAL_ENCRYPTION_KEY in production!');
    }
  }

  public static getInstance(): CredentialManager {
    if (!CredentialManager.instance) {
      CredentialManager.instance = new CredentialManager();
    }
    return CredentialManager.instance;
  }

  /**
   * Encrypt sensitive credential data
   */
  private encrypt(text: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(algorithm, this.encryptionKey);
      
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt credentials');
    }
  }

  /**
   * Decrypt sensitive credential data
   */
  private decrypt(encryptedText: string): string {
    try {
      const algorithm = 'aes-256-gcm';
      const parts = encryptedText.split(':');
      
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted data format');
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const encrypted = parts[2];
      
      const decipher = crypto.createDecipher(algorithm, this.encryptionKey);
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt credentials');
    }
  }

  /**
   * Store platform credentials for a user
   */
  async storeCredentials(
    userId: string,
    platform: Platform,
    tokens: OAuthTokens
  ): Promise<PlatformCredentials> {
    try {
      const supabase = createAdminSupabaseClient();
      
      // Encrypt the tokens
      const encryptedTokens = this.encrypt(JSON.stringify(tokens));
      
      const credentialData = {
        user_id: userId,
        platform,
        credentials: { encrypted: encryptedTokens },
        is_active: true,
        expires_at: tokens.expiresAt?.toISOString(),
      };

      // Upsert credentials (update if exists, insert if not)
      const { data, error } = await supabase
        .from('platform_credentials')
        .upsert(credentialData, {
          onConflict: 'user_id,platform'
        })
        .select()
        .single();

      if (error) {
        console.error('Error storing credentials:', error);
        throw new Error(`Failed to store credentials: ${error.message}`);
      }

      return {
        id: data.id,
        userId: data.user_id,
        platform: data.platform,
        credentials: tokens,
        isActive: data.is_active,
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at || data.created_at),
      };
    } catch (error) {
      console.error('Error in storeCredentials:', error);
      throw error;
    }
  }

  /**
   * Retrieve platform credentials for a user
   */
  async getCredentials(userId: string, platform: Platform): Promise<PlatformCredentials | null> {
    try {
      const supabase = createServerSupabaseClient();
      
      const { data, error } = await supabase
        .from('platform_credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('platform', platform)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      // Decrypt the tokens
      const decryptedTokens = JSON.parse(this.decrypt(data.credentials.encrypted));

      return {
        id: data.id,
        userId: data.user_id,
        platform: data.platform,
        credentials: decryptedTokens,
        isActive: data.is_active,
        expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at || data.created_at),
      };
    } catch (error) {
      console.error('Error retrieving credentials:', error);
      return null;
    }
  }

  /**
   * Get all platform credentials for a user
   */
  async getAllCredentials(userId: string): Promise<PlatformCredentials[]> {
    try {
      const supabase = createServerSupabaseClient();
      
      const { data, error } = await supabase
        .from('platform_credentials')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error || !data) {
        return [];
      }

      return data.map(item => {
        try {
          const decryptedTokens = JSON.parse(this.decrypt(item.credentials.encrypted));
          return {
            id: item.id,
            userId: item.user_id,
            platform: item.platform,
            credentials: decryptedTokens,
            isActive: item.is_active,
            expiresAt: item.expires_at ? new Date(item.expires_at) : undefined,
            createdAt: new Date(item.created_at),
            updatedAt: new Date(item.updated_at || item.created_at),
          };
        } catch (decryptError) {
          console.error(`Error decrypting credentials for ${item.platform}:`, decryptError);
          return null;
        }
      }).filter(Boolean) as PlatformCredentials[];
    } catch (error) {
      console.error('Error retrieving all credentials:', error);
      return [];
    }
  }

  /**
   * Remove platform credentials for a user
   */
  async removeCredentials(userId: string, platform: Platform): Promise<void> {
    try {
      const supabase = createAdminSupabaseClient();
      
      const { error } = await supabase
        .from('platform_credentials')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('platform', platform);

      if (error) {
        console.error('Error removing credentials:', error);
        throw new Error(`Failed to remove credentials: ${error.message}`);
      }
    } catch (error) {
      console.error('Error in removeCredentials:', error);
      throw error;
    }
  }

  /**
   * Validate platform credentials
   */
  async validateCredentials(userId: string, platform: Platform): Promise<CredentialValidationResult> {
    try {
      const credentials = await this.getCredentials(userId, platform);
      
      if (!credentials) {
        return {
          isValid: false,
          error: 'No credentials found'
        };
      }

      // Check if credentials are expired
      if (credentials.expiresAt && credentials.expiresAt < new Date()) {
        return {
          isValid: false,
          error: 'Credentials expired',
          expiresAt: credentials.expiresAt
        };
      }

      // Platform-specific validation
      switch (platform) {
        case 'threads':
          return await this.validateThreadsCredentials(credentials.credentials);
        default:
          return {
            isValid: true,
            expiresAt: credentials.expiresAt
          };
      }
    } catch (error) {
      console.error('Error validating credentials:', error);
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Validation failed'
      };
    }
  }

  /**
   * Validate Threads credentials by making a test API call
   */
  private async validateThreadsCredentials(tokens: OAuthTokens): Promise<CredentialValidationResult> {
    try {
      // Make a test API call to Threads to validate the token
      const response = await fetch('https://graph.threads.net/v1.0/me', {
        headers: {
          'Authorization': `Bearer ${tokens.accessToken}`
        }
      });

      if (response.ok) {
        return {
          isValid: true,
          expiresAt: tokens.expiresAt
        };
      } else {
        const errorData = await response.json().catch(() => ({}));
        return {
          isValid: false,
          error: errorData.error?.message || 'Invalid credentials'
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  /**
   * Refresh expired tokens
   */
  async refreshTokens(userId: string, platform: Platform): Promise<PlatformCredentials | null> {
    try {
      const credentials = await this.getCredentials(userId, platform);
      
      if (!credentials || !credentials.credentials.refreshToken) {
        return null;
      }

      // Platform-specific token refresh
      switch (platform) {
        case 'threads':
          return await this.refreshThreadsTokens(userId, credentials);
        default:
          throw new Error(`Token refresh not implemented for platform: ${platform}`);
      }
    } catch (error) {
      console.error('Error refreshing tokens:', error);
      return null;
    }
  }

  /**
   * Refresh Threads tokens
   */
  private async refreshThreadsTokens(userId: string, credentials: PlatformCredentials): Promise<PlatformCredentials | null> {
    try {
      const config = this.getThreadsOAuthConfig();
      
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: credentials.credentials.refreshToken!,
          client_id: config.clientId,
          client_secret: config.clientSecret,
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const tokenData = await response.json();
      
      const newTokens: OAuthTokens = {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || credentials.credentials.refreshToken,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
        tokenType: tokenData.token_type || 'Bearer',
        scope: tokenData.scope,
      };

      return await this.storeCredentials(userId, 'threads', newTokens);
    } catch (error) {
      console.error('Error refreshing Threads tokens:', error);
      return null;
    }
  }

  /**
   * Get OAuth configuration for Threads
   */
  getThreadsOAuthConfig(): OAuthConfig {
    const clientId = process.env.THREADS_CLIENT_ID;
    const clientSecret = process.env.THREADS_CLIENT_SECRET;
    const redirectUri = process.env.THREADS_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/threads/callback`;

    if (!clientId || !clientSecret) {
      throw new Error('Threads OAuth configuration missing. Set THREADS_CLIENT_ID and THREADS_CLIENT_SECRET');
    }

    return {
      clientId,
      clientSecret,
      redirectUri,
      scopes: ['threads_basic', 'threads_content_publish'],
      authUrl: 'https://threads.net/oauth/authorize',
      tokenUrl: 'https://graph.threads.net/oauth/access_token',
    };
  }

  /**
   * Generate OAuth authorization URL
   */
  generateAuthUrl(platform: Platform, state?: string): string {
    switch (platform) {
      case 'threads':
        const config = this.getThreadsOAuthConfig();
        const params = new URLSearchParams({
          client_id: config.clientId,
          redirect_uri: config.redirectUri,
          scope: config.scopes.join(','),
          response_type: 'code',
          state: state || crypto.randomBytes(16).toString('hex'),
        });
        return `${config.authUrl}?${params.toString()}`;
      
      default:
        throw new Error(`OAuth not implemented for platform: ${platform}`);
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(platform: Platform, code: string, state?: string): Promise<OAuthTokens> {
    switch (platform) {
      case 'threads':
        return await this.exchangeThreadsCode(code);
      
      default:
        throw new Error(`OAuth code exchange not implemented for platform: ${platform}`);
    }
  }

  /**
   * Exchange Threads authorization code for tokens
   */
  private async exchangeThreadsCode(code: string): Promise<OAuthTokens> {
    try {
      const config = this.getThreadsOAuthConfig();
      
      const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          client_id: config.clientId,
          client_secret: config.clientSecret,
          redirect_uri: config.redirectUri,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || 'Token exchange failed');
      }

      const tokenData = await response.json();
      
      return {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expires_in ? new Date(Date.now() + tokenData.expires_in * 1000) : undefined,
        tokenType: tokenData.token_type || 'Bearer',
        scope: tokenData.scope,
      };
    } catch (error) {
      console.error('Error exchanging Threads code:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const credentialManager = CredentialManager.getInstance();