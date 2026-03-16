// SSO Authentication for JIRA (LDAP-backed)

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from '../logging/app-logger';

export interface AuthSession {
  token: string;
  cookies?: string[];
  expiresAt: number;
  username: string;
}

export class SSOAuthenticator {
  private cachePath: string;
  private session: AuthSession | null = null;

  constructor(cachePath: string) {
    this.cachePath = cachePath;
    this.loadSession();
  }

  private ensureCacheDir(): void {
    const dir = dirname(this.cachePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
  }

  private loadSession(): void {
    try {
      if (existsSync(this.cachePath)) {
        const data = readFileSync(this.cachePath, 'utf-8');
        const session = JSON.parse(data) as AuthSession;
        
        // Check if session is still valid
        if (session.expiresAt > Date.now()) {
          this.session = session;
          logger.debug('Loaded cached SSO session', { username: session.username });
        } else {
          logger.debug('Cached session expired');
        }
      }
    } catch (error) {
      logger.warn('Failed to load cached session', { error });
    }
  }

  private saveSession(session: AuthSession): void {
    try {
      this.ensureCacheDir();
      writeFileSync(this.cachePath, JSON.stringify(session, null, 2), 'utf-8');
      logger.debug('Saved SSO session to cache');
    } catch (error) {
      logger.error('Failed to save session', { error });
    }
  }

  async authenticate(username?: string, password?: string): Promise<AuthSession> {
    // If we have a valid cached session, return it
    if (this.session && this.session.expiresAt > Date.now()) {
      return this.session;
    }

    // Try to load from CLI cache if available
    try {
      this.loadSession();
      if (this.session && this.session.expiresAt > Date.now()) {
        return this.session;
      }
    } catch {
      // Ignore cache load errors
    }

    // In a real implementation, this would:
    // 1. Make SSO login request with LDAP credentials
    // 2. Handle SSO redirect flow
    // 3. Extract session tokens/cookies
    // 4. Cache the session
    
    logger.info('Initiating SSO authentication...');

    // Check environment variables or parameters
    const user = username || process.env.JIRA_USERNAME;
    const pass = password || process.env.JIRA_PASSWORD || process.env.JIRA_TOKEN || process.env.JIRA_API_TOKEN;

    if (!user || !pass) {
      throw new Error(
        'Authentication required. Use CLI with --username and --password/--token, ' +
        'or set JIRA_USERNAME and JIRA_PASSWORD/JIRA_TOKEN environment variables, ' +
        'or run with --interactive flag.'
      );
    }

    // Simulate SSO token acquisition
    // In production, this would make actual SSO/LDAP authentication requests
    const session: AuthSession = {
      token: Buffer.from(`${user}:${pass}`).toString('base64'),
      cookies: [],
      expiresAt: Date.now() + 3600000, // 1 hour
      username: user,
    };

    this.session = session;
    this.saveSession(session);

    logger.info('SSO authentication successful', { username: user });
    return session;
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    // Priority 1: Check for OAuth access token (CLI with OAuth)
    const oauthToken = process.env.OAUTH_ACCESS_TOKEN;
    if (oauthToken) {
      return {
        'Authorization': `Bearer ${oauthToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
    }

    // Priority 2: Check for PAT (Personal Access Token) - JIRA Data Center format
    // Use UAT_PAT for UAT environment, PAT for production
    const jiraUrl = process.env.JIRA_BASE_URL || '';
    const isUat = jiraUrl.toLowerCase().includes('uat');
    const pat = isUat 
      ? (process.env.UAT_PAT || process.env.PAT || process.env.JIRA_PAT)
      : (process.env.PAT || process.env.JIRA_PAT);
    
    // Check auth method: 'basic' uses username:PAT format, 'bearer' uses Bearer token
    const authMethod = process.env.JIRA_AUTH_METHOD?.toLowerCase() || 'bearer';
    
    if (pat) {
      if (authMethod === 'basic') {
        // Some JIRA servers require Basic auth with username:PAT
        const username = process.env.JIRA_USERNAME || '';
        const basicToken = Buffer.from(`${username}:${pat}`).toString('base64');
        logger.debug(`Using PAT with Basic auth (${isUat ? 'UAT' : 'Production'})`);
        return {
          'Authorization': `Basic ${basicToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };
      } else {
        // Default: Bearer token auth
        logger.debug(`Using PAT with Bearer auth (${isUat ? 'UAT' : 'Production'})`);
        return {
          'Authorization': `Bearer ${pat}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        };
      }
    }

    // Priority 3: Check environment variables for CLI Basic auth
    const username = process.env.JIRA_USERNAME;
    const password = process.env.JIRA_PASSWORD || process.env.JIRA_TOKEN;

    if (username && password) {
      const token = Buffer.from(`${username}:${password}`).toString('base64');
      return {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      };
    }

    // Priority 4: Use cached session
    if (!this.session || this.session.expiresAt <= Date.now()) {
      await this.authenticate();
    }

    if (!this.session) {
      throw new Error('Authentication required');
    }

    return {
      'Authorization': `Basic ${this.session.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  clearSession(): void {
    this.session = null;
    try {
      if (existsSync(this.cachePath)) {
        writeFileSync(this.cachePath, '', 'utf-8');
      }
    } catch (error) {
      logger.error('Failed to clear session cache', { error });
    }
  }
}

