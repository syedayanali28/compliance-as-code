/**
 * JIRA API Client with Jira Native OAuth 2.0 Authentication
 * Uses access tokens from Jira OAuth flow
 */

import { Agent } from 'https';
import { JiraOAuthAuthenticator } from './auth-jira-oauth';
import { logger } from '../logging/app-logger';
import type { JiraTicket, JiraAttachment } from '../types';

// Create an HTTPS agent that ignores SSL certificate errors
const httpsAgent = new Agent({
  rejectUnauthorized: false
});

/**
 * Custom fetch that ignores SSL certificate errors
 */
async function fetchWithSSL(url: string, options: RequestInit = {}): Promise<Response> {
  const fetchOptions = {
    ...options,
    agent: httpsAgent,
  } as RequestInit & { agent: Agent };

  return fetch(url, fetchOptions as RequestInit);
}

export class JiraOAuthClient {
  private baseUrl: string;
  private authenticator: JiraOAuthAuthenticator;

  constructor(baseUrl: string, authenticator: JiraOAuthAuthenticator) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.authenticator = authenticator;
  }

  /**
   * Create a client from an access token directly (useful for CLI)
   */
  static withAccessToken(baseUrl: string, accessToken: string): JiraOAuthClientWithToken {
    return new JiraOAuthClientWithToken(baseUrl, accessToken);
  }

  async fetchIssue(issueKey: string, userId: string): Promise<JiraTicket> {
    logger.info(`Fetching JIRA issue: ${issueKey}`, { user: userId });

    const headers = await this.authenticator.getAuthHeaders(userId);
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}?expand=renderedFields`;

    try {
      const response = await fetchWithSSL(url, { headers });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch JIRA issue: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      const comments = await this.fetchComments(issueKey, userId);

      const ticket: JiraTicket = {
        key: data.key,
        fields: data.fields,
        comments,
      };

      logger.info(`Successfully fetched issue ${issueKey}`, { user: userId });
      return ticket;
    } catch (error) {
      logger.error(`Failed to fetch issue ${issueKey}`, { error, user: userId });
      throw error;
    }
  }

  async fetchComments(issueKey: string, userId: string): Promise<JiraTicket['comments']> {
    const headers = await this.authenticator.getAuthHeaders(userId);
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/comment`;

    try {
      const response = await fetchWithSSL(url, { headers });

      if (!response.ok) {
        logger.warn(`Failed to fetch comments for ${issueKey}`);
        return [];
      }

      const data = await response.json() as {
        comments: Array<{
          body: string;
          author: { displayName: string };
          created: string;
        }>;
      };

      return data.comments.map((c) => ({
        body: c.body,
        author: {
          displayName: c.author.displayName,
        },
        created: c.created,
      }));
    } catch (error) {
      logger.warn(`Error fetching comments for ${issueKey}`, { error });
      return [];
    }
  }

  async fetchAttachments(issueKey: string, userId: string): Promise<JiraAttachment[]> {
    logger.info(`Fetching attachments for ${issueKey}`, { user: userId });

    const headers = await this.authenticator.getAuthHeaders(userId);
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}`;

    try {
      const response = await fetchWithSSL(url, { headers });

      if (!response.ok) {
        throw new Error(`Failed to fetch issue: ${response.status}`);
      }

      const data = await response.json();
      const attachments = data.fields.attachment || [];

      const results: JiraAttachment[] = [];

      for (const att of attachments) {
        logger.debug(`Downloading attachment: ${att.filename}`, { user: userId });

        try {
          const contentResponse = await fetchWithSSL(att.content, { headers });

          if (!contentResponse.ok) {
            logger.warn(`Failed to download attachment: ${att.filename}`);
            continue;
          }

          const buffer = await contentResponse.arrayBuffer();
          const content = Buffer.from(buffer).toString('base64');

          results.push({
            id: att.id,
            filename: att.filename,
            mimeType: att.mimeType,
            content,
            size: att.size,
          });
        } catch (error) {
          logger.warn(`Error downloading attachment: ${att.filename}`, { error });
        }
      }

      logger.info(`Downloaded ${results.length} attachments`, { user: userId });
      return results;
    } catch (error) {
      logger.error(`Failed to fetch attachments for ${issueKey}`, { error, user: userId });
      throw error;
    }
  }

  async addComment(issueKey: string, comment: string, userId: string): Promise<void> {
    logger.info(`Adding comment to ${issueKey}`, { user: userId });

    const headers = await this.authenticator.getAuthHeaders(userId);
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/comment`;

    try {
      const response = await fetchWithSSL(url, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add comment: ${response.status}`);
      }

      logger.info(`Successfully added comment to ${issueKey}`, { user: userId });
    } catch (error) {
      logger.error(`Failed to add comment to ${issueKey}`, { error, user: userId });
      throw error;
    }
  }
}

/**
 * Simplified JIRA client that uses an access token directly
 * Useful for CLI where we already have the token
 */
export class JiraOAuthClientWithToken {
  private baseUrl: string;
  private accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.accessToken = accessToken;
  }

  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept': 'application/json',
    };
  }

  async fetchCurrentUser(): Promise<{
    name: string;
    displayName: string;
    emailAddress: string;
  }> {
    const response = await fetchWithSSL(`${this.baseUrl}/rest/api/2/myself`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch user: ${response.status}`);
    }

    return response.json();
  }

  async fetchIssue(issueKey: string): Promise<JiraTicket> {
    logger.info(`Fetching JIRA issue: ${issueKey}`);

    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}?expand=renderedFields`;

    try {
      const response = await fetchWithSSL(url, { headers: this.getHeaders() });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch JIRA issue: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();

      const comments = await this.fetchComments(issueKey);

      const ticket: JiraTicket = {
        key: data.key,
        fields: data.fields,
        comments,
      };

      logger.info(`Successfully fetched issue ${issueKey}`);
      return ticket;
    } catch (error) {
      logger.error(`Failed to fetch issue ${issueKey}`, { error });
      throw error;
    }
  }

  async fetchComments(issueKey: string): Promise<JiraTicket['comments']> {
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/comment`;

    try {
      const response = await fetchWithSSL(url, { headers: this.getHeaders() });

      if (!response.ok) {
        logger.warn(`Failed to fetch comments for ${issueKey}`);
        return [];
      }

      const data = await response.json() as {
        comments: Array<{
          body: string;
          author: { displayName: string };
          created: string;
        }>;
      };

      return data.comments.map((c) => ({
        body: c.body,
        author: {
          displayName: c.author.displayName,
        },
        created: c.created,
      }));
    } catch (error) {
      logger.warn(`Error fetching comments for ${issueKey}`, { error });
      return [];
    }
  }

  async fetchAttachments(issueKey: string): Promise<JiraAttachment[]> {
    logger.info(`Fetching attachments for ${issueKey}`);

    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}`;

    try {
      const response = await fetchWithSSL(url, { headers: this.getHeaders() });

      if (!response.ok) {
        throw new Error(`Failed to fetch issue: ${response.status}`);
      }

      const data = await response.json();
      const attachments = data.fields.attachment || [];

      const results: JiraAttachment[] = [];

      for (const att of attachments) {
        logger.debug(`Downloading attachment: ${att.filename}`);

        try {
          const contentResponse = await fetchWithSSL(att.content, {
            headers: this.getHeaders(),
          });

          if (!contentResponse.ok) {
            logger.warn(`Failed to download attachment: ${att.filename}`);
            continue;
          }

          const buffer = await contentResponse.arrayBuffer();
          const content = Buffer.from(buffer).toString('base64');

          results.push({
            id: att.id,
            filename: att.filename,
            mimeType: att.mimeType,
            content,
            size: att.size,
          });
        } catch (error) {
          logger.warn(`Error downloading attachment: ${att.filename}`, { error });
        }
      }

      logger.info(`Downloaded ${results.length} attachments`);
      return results;
    } catch (error) {
      logger.error(`Failed to fetch attachments for ${issueKey}`, { error });
      throw error;
    }
  }

  async addComment(issueKey: string, comment: string): Promise<void> {
    logger.info(`Adding comment to ${issueKey}`);

    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/comment`;

    try {
      const response = await fetchWithSSL(url, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: comment }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add comment: ${response.status}`);
      }

      logger.info(`Successfully added comment to ${issueKey}`);
    } catch (error) {
      logger.error(`Failed to add comment to ${issueKey}`, { error });
      throw error;
    }
  }
}

