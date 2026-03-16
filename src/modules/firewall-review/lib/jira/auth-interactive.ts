// Interactive authentication for CLI

import * as readline from 'readline';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { logger } from '../logging/app-logger';

export interface CliAuthSession {
  token: string;
  type: 'basic' | 'pat';
  username?: string;
  expiresAt: number;
}

export class InteractiveAuthenticator {
  private cachePath: string;
  private session: CliAuthSession | null = null;

  constructor(cachePath: string) {
    this.cachePath = cachePath;
    this.loadSession();
  }

  private loadSession(): void {
    try {
      if (existsSync(this.cachePath)) {
        const data = readFileSync(this.cachePath, 'utf-8');
        const session = JSON.parse(data) as CliAuthSession;
        
        if (session.expiresAt > Date.now()) {
          this.session = session;
          logger.debug('Loaded cached credentials');
        }
      }
    } catch (error) {
      logger.warn('Failed to load cached credentials', { error });
    }
  }

  private saveSession(session: CliAuthSession): void {
    try {
      const dir = dirname(this.cachePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.cachePath, JSON.stringify(session, null, 2), 'utf-8');
      logger.debug('Saved credentials to cache');
    } catch (error) {
      logger.error('Failed to save credentials', { error });
    }
  }

  /**
   * Prompt user for credentials interactively
   */
  async promptCredentials(): Promise<{ username: string; password: string }> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve, reject) => {
      rl.question('JIRA Username: ', (username) => {
        rl.question('JIRA Password: ', (password) => {
          rl.close();
          
          if (!username || !password) {
            reject(new Error('Username and password are required'));
            return;
          }

          resolve({
            username: username.trim(),
            password: password.trim(),
          });
        });

        // Hide password input (note: this doesn't work perfectly in all terminals)
        if (process.stdin.isTTY && 'setRawMode' in process.stdin) {
          const stdin = process.stdin as NodeJS.ReadStream & { setRawMode: (mode: boolean) => void };
          stdin.setRawMode(true);
        }
      });
    });
  }

  /**
   * Prompt for Personal Access Token (recommended)
   */
  async promptPAT(): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve, reject) => {
      console.log('\n?? Personal Access Token (PAT) is the recommended method for CLI authentication.');
      console.log('   Generate one at: https://your-jira.com/secure/ViewProfile.jspa ??Security ??API Token\n');
      
      rl.question('API Token / PAT: ', (token) => {
        rl.close();
        
        if (!token) {
          reject(new Error('API token is required'));
          return;
        }

        resolve(token.trim());
      });
    });
  }

  /**
   * Authenticate with username/password (Basic Auth)
   */
  async authenticateBasic(username?: string, password?: string): Promise<CliAuthSession> {
    let user = username;
    let pass = password;

    // If not provided, prompt interactively
    if (!user || !pass) {
      const credentials = await this.promptCredentials();
      user = credentials.username;
      pass = credentials.password;
    }

    const session: CliAuthSession = {
      token: Buffer.from(`${user}:${pass}`).toString('base64'),
      type: 'basic',
      username: user,
      expiresAt: Date.now() + (24 * 3600000), // 24 hours
    };

    this.session = session;
    this.saveSession(session);

    logger.info('Basic authentication configured', { username: user });
    return session;
  }

  /**
   * Authenticate with Personal Access Token
   */
  async authenticatePAT(username?: string, token?: string): Promise<CliAuthSession> {
    let user = username;
    let pat = token;

    // If token not provided, prompt for it
    if (!pat) {
      pat = await this.promptPAT();
    }

    // If username not provided, prompt for it
    if (!user) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      user = await new Promise((resolve) => {
        rl.question('JIRA Email/Username: ', (input) => {
          rl.close();
          resolve(input.trim());
        });
      });
    }

    const session: CliAuthSession = {
      token: Buffer.from(`${user}:${pat}`).toString('base64'),
      type: 'pat',
      username: user,
      expiresAt: Date.now() + (30 * 24 * 3600000), // 30 days
    };

    this.session = session;
    this.saveSession(session);

    logger.info('PAT authentication configured', { username: user });
    return session;
  }

  /**
   * Get auth headers for API calls
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    if (!this.session || this.session.expiresAt <= Date.now()) {
      throw new Error('Authentication required. Run with --username and --password, or use interactive mode.');
    }

    return {
      'Authorization': `Basic ${this.session.token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  /**
   * Check if authenticated
   */
  isAuthenticated(): boolean {
    return this.session !== null && this.session.expiresAt > Date.now();
  }

  /**
   * Clear session
   */
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

  /**
   * Get current username
   */
  getUsername(): string | undefined {
    return this.session?.username;
  }

  /**
   * Get current session
   */
  getSession(): CliAuthSession | null {
    return this.session;
  }
}

