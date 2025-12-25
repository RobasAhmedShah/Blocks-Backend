import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OneLinkTokenResponse } from './dto/generate-qr.dto';

@Injectable()
export class OneLinkOAuthService {
  private readonly logger = new Logger(OneLinkOAuthService.name);
  
  // Token cache
  private cachedToken: string | null = null;
  private tokenExpiresAt: number = 0;
  
  // Buffer before token expiry to refresh (60 seconds)
  private readonly TOKEN_REFRESH_BUFFER_MS = 60 * 1000;
  
  constructor(private readonly configService: ConfigService) {}
  
  /**
   * Get a valid OAuth2 access token, using cache if available
   */
  async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.isTokenValid()) {
      this.logger.debug('Using cached 1LINK OAuth token');
      return this.cachedToken!;
    }
    
    // Fetch new token
    this.logger.log('Fetching new 1LINK OAuth token...');
    return this.fetchNewToken();
  }
  
  /**
   * Check if the cached token is still valid
   */
  private isTokenValid(): boolean {
    if (!this.cachedToken) {
      return false;
    }
    
    const now = Date.now();
    const expiresWithBuffer = this.tokenExpiresAt - this.TOKEN_REFRESH_BUFFER_MS;
    
    return now < expiresWithBuffer;
  }
  
  /**
   * Fetch a new OAuth2 token from 1LINK
   */
  private async fetchNewToken(): Promise<string> {
    const clientId = this.configService.get<string>('ONELINK_CLIENT_ID');
    const clientSecret = this.configService.get<string>('ONELINK_CLIENT_SECRET');
    const tokenUrl = this.configService.get<string>('ONELINK_OAUTH_URL');
    
    if (!clientId || !clientSecret || !tokenUrl) {
      throw new Error('1LINK OAuth credentials not configured');
    }
    
    // Create Basic auth header
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: 'grant_type=client_credentials&scope=1LinkApi',
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`1LINK OAuth error: ${response.status} - ${errorText}`);
        throw new Error(`OAuth authentication failed: ${response.status}`);
      }
      
      const tokenData: OneLinkTokenResponse = await response.json();
      
      // Cache the token
      this.cachedToken = tokenData.access_token;
      // Calculate expiry time in milliseconds
      this.tokenExpiresAt = Date.now() + (tokenData.expires_in * 1000);
      
      this.logger.log(`1LINK OAuth token obtained, expires in ${tokenData.expires_in} seconds`);
      
      return this.cachedToken;
    } catch (error) {
      this.logger.error('Failed to fetch 1LINK OAuth token', error);
      throw error;
    }
  }
  
  /**
   * Invalidate the cached token (for testing or error recovery)
   */
  invalidateToken(): void {
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
    this.logger.log('1LINK OAuth token invalidated');
  }
}

