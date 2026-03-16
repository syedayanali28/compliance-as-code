/**
 * Jira Native OAuth 2.0 Authentication
 * Uses Jira's built-in OAuth 2.0 endpoints (not ADFS)
 * 
 * Based on Jira REST API OAuth 2.0:
 * - Authorization: {JIRA_BASE_URL}/rest/oauth2/latest/authorize
 * - Token exchange: {JIRA_BASE_URL}/rest/oauth2/latest/token
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { Agent } from 'https';
import { logger } from '../logging/app-logger';

export interface JiraOAuthConfig {
  jiraBaseUrl: string;           // e.g., https://uatjira.intra.hkma.gov.hk
  clientId: string;              // Jira OAuth App Client ID
  clientSecret: string;          // Jira OAuth App Client Secret
  redirectUri: string;           // Callback URL
  scope?: string;                // OAuth scope (default: READ)
  tokenCachePath?: string;       // Path to cache tokens
}

export interface JiraOAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  expires_at: number;
  scope?: string;
  user_info?: {
    username: string;
    displayName: string;
    emailAddress: string;
  };
}

// Create an HTTPS agent that ignores SSL certificate errors (for self-signed certs)
const httpsAgent = new Agent({
  rejectUnauthorized: false
});

/**
 * Custom fetch that ignores SSL certificate errors
 * Required for internal corporate networks with self-signed certificates
 */
async function fetchWithSSL(url: string, options: RequestInit = {}): Promise<Response> {
  // For Node.js, we need to use the https agent
  const fetchOptions = {
    ...options,
    agent: httpsAgent,
  } as RequestInit & { agent: Agent };

  return fetch(url, fetchOptions as RequestInit);
}

export class JiraOAuthAuthenticator {
  private config: JiraOAuthConfig;
  private tokens: Map<string, JiraOAuthTokens> = new Map();
  private tokenCachePath: string;

  constructor(config: JiraOAuthConfig) {
    this.config = config;
    this.tokenCachePath = config.tokenCachePath || './data/jira-oauth-tokens.json';
    this.loadTokensFromCache();
  }

  /**
   * Get authorization URL to redirect user to Jira login
   * Matches Python: /rest/oauth2/latest/authorize
   */
  getAuthorizationUrl(state?: string): string {
    const scope = this.config.scope || 'READ';
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: scope,
    });

    if (state) {
      params.set('state', state);
    }

    // Jira OAuth 2.0 authorization endpoint
    return `${this.config.jiraBaseUrl}/rest/oauth2/latest/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   * Matches Python: POST /rest/oauth2/latest/token
   */
  async exchangeCodeForToken(code: string): Promise<JiraOAuthTokens> {
    logger.info('Exchanging authorization code for Jira access token');

    const tokenEndpoint = `${this.config.jiraBaseUrl}/rest/oauth2/latest/token`;

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
    });

    try {
      const response = await fetchWithSSL(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Token exchange failed', { status: response.status, error: errorText });
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        token_type: string;
        expires_in: number;
        scope?: string;
      };

      const tokens: JiraOAuthTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in,
        expires_at: Date.now() + (data.expires_in * 1000),
        scope: data.scope,
      };

      // Fetch user profile from Jira
      const userInfo = await this.fetchCurrentUser(tokens.access_token);
      if (userInfo) {
        tokens.user_info = userInfo;
      }

      // Cache tokens
      if (tokens.user_info?.username) {
        this.tokens.set(tokens.user_info.username, tokens);
        this.saveTokensToCache();
      }

      logger.info('Successfully obtained Jira access token', {
        user: tokens.user_info?.username,
        expires_in: tokens.expires_in,
      });

      return tokens;
    } catch (error) {
      logger.error('Failed to exchange authorization code', { error });
      throw error;
    }
  }

  /**
   * Fetch current user profile from Jira
   * Uses: GET /rest/api/2/myself
   */
  async fetchCurrentUser(accessToken: string): Promise<JiraOAuthTokens['user_info'] | null> {
    try {
      const response = await fetchWithSSL(`${this.config.jiraBaseUrl}/rest/api/2/myself`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        logger.warn('Failed to fetch user profile', { status: response.status });
        return null;
      }

      const data = await response.json() as {
        name: string;
        displayName: string;
        emailAddress: string;
      };

      return {
        username: data.name,
        displayName: data.displayName,
        emailAddress: data.emailAddress,
      };
    } catch (error) {
      logger.warn('Error fetching user profile', { error });
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(userId: string): Promise<JiraOAuthTokens> {
    const currentTokens = this.tokens.get(userId);

    if (!currentTokens?.refresh_token) {
      throw new Error('No refresh token available');
    }

    logger.info('Refreshing Jira access token', { user: userId });

    const tokenEndpoint = `${this.config.jiraBaseUrl}/rest/oauth2/latest/token`;

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: currentTokens.refresh_token,
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    try {
      const response = await fetchWithSSL(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json() as {
        access_token: string;
        refresh_token?: string;
        token_type: string;
        expires_in: number;
      };

      const tokens: JiraOAuthTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || currentTokens.refresh_token,
        token_type: data.token_type || 'Bearer',
        expires_in: data.expires_in,
        expires_at: Date.now() + (data.expires_in * 1000),
        user_info: currentTokens.user_info,
      };

      this.tokens.set(userId, tokens);
      this.saveTokensToCache();

      logger.info('Successfully refreshed Jira access token', { user: userId });
      return tokens;
    } catch (error) {
      logger.error('Failed to refresh token', { error, user: userId });
      this.tokens.delete(userId);
      this.saveTokensToCache();
      throw error;
    }
  }

  /**
   * Get valid access token for user
   */
  async getAccessToken(userId: string): Promise<string> {
    const tokens = this.tokens.get(userId);

    if (!tokens) {
      throw new Error(`No tokens found for user: ${userId}`);
    }

    // Check if token is still valid (with 5 min buffer)
    if (tokens.expires_at > Date.now() + 300000) {
      return tokens.access_token;
    }

    // Try to refresh
    if (tokens.refresh_token) {
      const refreshed = await this.refreshToken(userId);
      return refreshed.access_token;
    }

    throw new Error('Token expired and no refresh token available');
  }

  /**
   * Get authorization headers for API requests
   */
  async getAuthHeaders(userId: string): Promise<Record<string, string>> {
    const accessToken = await this.getAccessToken(userId);
    return {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    };
  }

  /**
   * Store tokens for a user (used after callback)
   */
  setTokens(userId: string, tokens: JiraOAuthTokens): void {
    this.tokens.set(userId, tokens);
    this.saveTokensToCache();
  }

  /**
   * Get stored tokens for a user
   */
  getTokens(userId: string): JiraOAuthTokens | undefined {
    return this.tokens.get(userId);
  }

  /**
   * Check if user has valid tokens
   */
  hasValidTokens(userId: string): boolean {
    const tokens = this.tokens.get(userId);
    if (!tokens) return false;
    return tokens.expires_at > Date.now() + 60000; // 1 min buffer
  }

  /**
   * Remove tokens for user (logout)
   */
  removeTokens(userId: string): void {
    this.tokens.delete(userId);
    this.saveTokensToCache();
  }

  /**
   * Generate random state for CSRF protection
   */
  generateState(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Load tokens from cache file
   */
  private loadTokensFromCache(): void {
    try {
      if (!existsSync(this.tokenCachePath)) {
        return;
      }

      const data = readFileSync(this.tokenCachePath, 'utf-8');
      const cached = JSON.parse(data) as Record<string, JiraOAuthTokens>;

      for (const [userId, tokens] of Object.entries(cached)) {
        // Only load non-expired tokens
        if (tokens.expires_at > Date.now()) {
          this.tokens.set(userId, tokens);
        }
      }

      if (this.tokens.size > 0) {
        logger.debug(`Loaded ${this.tokens.size} cached token(s)`);
      }
    } catch (error) {
      logger.warn('Failed to load token cache', { error });
    }
  }

  /**
   * Save tokens to cache file
   */
  private saveTokensToCache(): void {
    try {
      const dir = dirname(this.tokenCachePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const data: Record<string, JiraOAuthTokens> = {};
      for (const [userId, tokens] of this.tokens.entries()) {
        data[userId] = tokens;
      }

      writeFileSync(this.tokenCachePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      logger.error('Failed to save token cache', { error });
    }
  }
}

/**
 * Get Jira OAuth configuration from environment variables
 * Supports both JIRA_ and OAUTH_ prefixes for backwards compatibility
 */
export function getJiraOAuthConfig(): JiraOAuthConfig {
  const jiraBaseUrl = process.env.JIRA_BASE_URL;
  const clientId = process.env.JIRA_CLIENT_ID || process.env.OAUTH_CLIENT_ID;
  const clientSecret = process.env.JIRA_CLIENT_SECRET || process.env.OAUTH_CLIENT_SECRET;
  const redirectUri = process.env.JIRA_REDIRECT_URI || process.env.OAUTH_REDIRECT_URI;

  const missing = [];
  if (!jiraBaseUrl) missing.push('JIRA_BASE_URL');
  if (!clientId) missing.push('JIRA_CLIENT_ID (or OAUTH_CLIENT_ID)');
  if (!clientSecret) missing.push('JIRA_CLIENT_SECRET (or OAUTH_CLIENT_SECRET)');
  if (!redirectUri) missing.push('JIRA_REDIRECT_URI (or OAUTH_REDIRECT_URI)');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    jiraBaseUrl: jiraBaseUrl!,
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
    scope: process.env.JIRA_OAUTH_SCOPE || 'READ',
    tokenCachePath: process.env.JIRA_TOKEN_CACHE_PATH || './data/jira-oauth-tokens.json',
  };
}

