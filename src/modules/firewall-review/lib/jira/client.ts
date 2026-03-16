// JIRA API Client

import { SSOAuthenticator } from './auth-sso';
import { logger } from '../logging/app-logger';
import { fetchWithSSL } from './fetch-with-ssl';
import type { JiraTicket, JiraAttachment } from '../types';

// ============================================================================
// HTTP Status Code Definitions
// ============================================================================

export enum HttpStatusCode {
  // 1xx Informational
  CONTINUE = 100,
  SWITCHING_PROTOCOL = 101,
  PROCESSING = 102,
  EARLY_HINTS = 103,

  // 2xx Success
  OK = 200,
  CREATED = 201,
  ACCEPTED = 202,
  NON_AUTHORITATIVE_INFO = 203,
  NO_CONTENT = 204,
  RESET_CONTENT = 205,
  PARTIAL_CONTENT = 206,
  MULTI_STATUS = 207,
  ALREADY_REPORTED = 208,
  IM_USED = 226,

  // 3xx Redirection
  MULTIPLE_CHOICES = 300,
  MOVED_PERMANENTLY = 301,
  FOUND = 302,
  SEE_OTHER = 303,
  NOT_MODIFIED = 304,
  USE_PROXY = 305,
  TEMPORARY_REDIRECT = 307,
  PERMANENT_REDIRECT = 308,

  // 4xx Client Error
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  PAYMENT_REQUIRED = 402,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  NOT_ACCEPTABLE = 406,
  PROXY_AUTH_REQUIRED = 407,
  REQUEST_TIMEOUT = 408,
  CONFLICT = 409,
  GONE = 410,
  LENGTH_REQUIRED = 411,
  PRECONDITION_FAILED = 412,
  PAYLOAD_TOO_LARGE = 413,
  URI_TOO_LONG = 414,
  UNSUPPORTED_MEDIA_TYPE = 415,
  RANGE_NOT_SATISFIABLE = 416,
  EXPECTATION_FAILED = 417,
  IM_A_TEAPOT = 418,
  ENHANCE_YOUR_CALM = 420,
  UNPROCESSABLE_ENTITY = 422,
  LOCKED = 423,
  FAILED_DEPENDENCY = 424,
  TOO_EARLY = 425,
  UPGRADE_REQUIRED = 426,
  PRECONDITION_REQUIRED = 428,
  TOO_MANY_REQUESTS = 429,
  REQUEST_HEADER_FIELDS_TOO_LARGE = 431,
  NO_RESPONSE = 444,
  RETRY_WITH = 449,
  BLOCKED_BY_PARENTAL_CONTROLS = 450,
  UNAVAILABLE_FOR_LEGAL_REASONS = 451,
  CLIENT_CLOSED_REQUEST = 499,

  // 5xx Server Error
  INTERNAL_SERVER_ERROR = 500,
  NOT_IMPLEMENTED = 501,
  BAD_GATEWAY = 502,
  SERVICE_UNAVAILABLE = 503,
  GATEWAY_TIMEOUT = 504,
  HTTP_VERSION_NOT_SUPPORTED = 505,
  VARIANT_ALSO_NEGOTIATES = 506,
  INSUFFICIENT_STORAGE = 507,
  LOOP_DETECTED = 508,
  NOT_EXTENDED = 510,
  NETWORK_AUTH_REQUIRED = 511,
}

// ============================================================================
// Error Classes
// ============================================================================

export class JiraApiError extends Error {
  public readonly statusCode: number;
  public readonly statusText: string;
  public readonly errorCategory: 'informational' | 'success' | 'redirection' | 'client' | 'server';
  public readonly isRetryable: boolean;
  public readonly retryAfterMs?: number;
  public readonly rawBody?: string;
  public readonly jiraErrors?: string[];

  constructor(
    message: string,
    statusCode: number,
    statusText: string,
    options?: {
      rawBody?: string;
      retryAfterMs?: number;
      jiraErrors?: string[];
    }
  ) {
    super(message);
    this.name = 'JiraApiError';
    this.statusCode = statusCode;
    this.statusText = statusText;
    this.rawBody = options?.rawBody;
    this.retryAfterMs = options?.retryAfterMs;
    this.jiraErrors = options?.jiraErrors;
    this.errorCategory = this.getErrorCategory();
    this.isRetryable = this.determineRetryable();
  }

  private getErrorCategory(): 'informational' | 'success' | 'redirection' | 'client' | 'server' {
    if (this.statusCode >= 100 && this.statusCode < 200) return 'informational';
    if (this.statusCode >= 200 && this.statusCode < 300) return 'success';
    if (this.statusCode >= 300 && this.statusCode < 400) return 'redirection';
    if (this.statusCode >= 400 && this.statusCode < 500) return 'client';
    return 'server';
  }

  private determineRetryable(): boolean {
    // Retryable status codes
    const retryableCodes = [
      HttpStatusCode.REQUEST_TIMEOUT,      // 408 - Client timeout, can retry
      HttpStatusCode.TOO_MANY_REQUESTS,    // 429 - Rate limited, should retry after delay
      HttpStatusCode.INTERNAL_SERVER_ERROR, // 500 - Server error, might be transient
      HttpStatusCode.BAD_GATEWAY,          // 502 - Gateway error, often transient
      HttpStatusCode.SERVICE_UNAVAILABLE,  // 503 - Server overloaded, should retry
      HttpStatusCode.GATEWAY_TIMEOUT,      // 504 - Gateway timeout, can retry
    ];
    return retryableCodes.includes(this.statusCode);
  }
}

// ============================================================================
// Status Code Handler
// ============================================================================

interface ErrorInfo {
  message: string;
  userFriendlyMessage: string;
  suggestion: string;
}

function getStatusCodeInfo(status: number, responseBody?: string): ErrorInfo {
  // Try to extract JIRA-specific errors from response body
  let jiraMessage = '';
  let jiraErrors: string[] = [];
  
  if (responseBody) {
    try {
      const json = JSON.parse(responseBody);
      if (json.errorMessages && Array.isArray(json.errorMessages)) {
        jiraErrors = json.errorMessages;
        jiraMessage = json.errorMessages.join('; ');
      }
      if (json.message) {
        jiraMessage = json.message;
      }
      if (json.errors && typeof json.errors === 'object') {
        const fieldErrors = Object.entries(json.errors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join('; ');
        if (fieldErrors) {
          jiraMessage = jiraMessage ? `${jiraMessage}. ${fieldErrors}` : fieldErrors;
        }
      }
    } catch {
      // Try to extract from HTML
      const titleMatch = responseBody.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        jiraMessage = titleMatch[1].trim();
      }
    }
  }

  const statusMessages: Record<number, ErrorInfo> = {
    // 4xx Client Errors
    [HttpStatusCode.BAD_REQUEST]: {
      message: jiraMessage || 'Bad Request - The request syntax is invalid',
      userFriendlyMessage: 'The request to JIRA was malformed',
      suggestion: 'Check the request parameters and try again',
    },
    [HttpStatusCode.UNAUTHORIZED]: {
      message: jiraMessage || 'Unauthorized - Authentication required',
      userFriendlyMessage: 'JIRA authentication failed',
      suggestion: 'Check your PAT token or credentials in .env file. Token may have expired.',
    },
    [HttpStatusCode.FORBIDDEN]: {
      message: jiraMessage || 'Forbidden - Access denied',
      userFriendlyMessage: 'You do not have permission to access this resource',
      suggestion: 'Check that your account has the necessary permissions for this project/issue',
    },
    [HttpStatusCode.NOT_FOUND]: {
      message: jiraMessage || 'Not Found - Resource does not exist',
      userFriendlyMessage: 'The requested JIRA issue or resource was not found',
      suggestion: 'Verify the ticket key is correct and the issue exists',
    },
    [HttpStatusCode.METHOD_NOT_ALLOWED]: {
      message: jiraMessage || 'Method Not Allowed',
      userFriendlyMessage: 'The HTTP method is not allowed for this endpoint',
      suggestion: 'This is likely a bug in the application - please report it',
    },
    [HttpStatusCode.NOT_ACCEPTABLE]: {
      message: jiraMessage || 'Not Acceptable - Content type not supported',
      userFriendlyMessage: 'JIRA cannot provide the requested content format',
      suggestion: 'Check Accept headers in the request',
    },
    [HttpStatusCode.PROXY_AUTH_REQUIRED]: {
      message: jiraMessage || 'Proxy Authentication Required',
      userFriendlyMessage: 'Corporate proxy requires authentication',
      suggestion: 'Configure your proxy credentials or contact IT support',
    },
    [HttpStatusCode.REQUEST_TIMEOUT]: {
      message: jiraMessage || 'Request Timeout',
      userFriendlyMessage: 'The request to JIRA timed out',
      suggestion: 'Check your network connection and try again',
    },
    [HttpStatusCode.CONFLICT]: {
      message: jiraMessage || 'Conflict - Resource state conflict',
      userFriendlyMessage: 'The request conflicts with the current state of the resource',
      suggestion: 'The issue may have been modified. Refresh and try again.',
    },
    [HttpStatusCode.GONE]: {
      message: jiraMessage || 'Gone - Resource permanently removed',
      userFriendlyMessage: 'The requested resource has been permanently deleted',
      suggestion: 'The issue may have been deleted. Check with your administrator.',
    },
    [HttpStatusCode.PRECONDITION_FAILED]: {
      message: jiraMessage || 'Precondition Failed',
      userFriendlyMessage: 'A precondition for the request was not met',
      suggestion: 'The resource may have been modified. Refresh and try again.',
    },
    [HttpStatusCode.PAYLOAD_TOO_LARGE]: {
      message: jiraMessage || 'Payload Too Large',
      userFriendlyMessage: 'The request data is too large',
      suggestion: 'Reduce the size of attachments or data being sent',
    },
    [HttpStatusCode.URI_TOO_LONG]: {
      message: jiraMessage || 'URI Too Long',
      userFriendlyMessage: 'The request URL is too long',
      suggestion: 'This is likely a bug in the application - please report it',
    },
    [HttpStatusCode.UNSUPPORTED_MEDIA_TYPE]: {
      message: jiraMessage || 'Unsupported Media Type',
      userFriendlyMessage: 'JIRA does not support the content type of this request',
      suggestion: 'Check Content-Type headers in the request',
    },
    [HttpStatusCode.UNPROCESSABLE_ENTITY]: {
      message: jiraMessage || 'Unprocessable Entity - Validation failed',
      userFriendlyMessage: 'JIRA could not process the request due to validation errors',
      suggestion: 'Check the request data for missing or invalid fields',
    },
    [HttpStatusCode.LOCKED]: {
      message: jiraMessage || 'Locked - Resource is locked',
      userFriendlyMessage: 'The JIRA issue is currently locked',
      suggestion: 'Wait for the lock to be released or contact the issue owner',
    },
    [HttpStatusCode.TOO_MANY_REQUESTS]: {
      message: jiraMessage || 'Too Many Requests - Rate limited',
      userFriendlyMessage: 'JIRA API rate limit exceeded',
      suggestion: 'Wait a few minutes before retrying. The system will auto-retry.',
    },
    [HttpStatusCode.UNAVAILABLE_FOR_LEGAL_REASONS]: {
      message: jiraMessage || 'Unavailable For Legal Reasons',
      userFriendlyMessage: 'This content is not available due to legal restrictions',
      suggestion: 'Contact your administrator for more information',
    },

    // 5xx Server Errors
    [HttpStatusCode.INTERNAL_SERVER_ERROR]: {
      message: jiraMessage || 'Internal Server Error',
      userFriendlyMessage: 'JIRA server encountered an unexpected error',
      suggestion: 'This is a JIRA server issue. Try again later or contact JIRA admin.',
    },
    [HttpStatusCode.NOT_IMPLEMENTED]: {
      message: jiraMessage || 'Not Implemented',
      userFriendlyMessage: 'This feature is not implemented on the JIRA server',
      suggestion: 'Check your JIRA server version supports this API',
    },
    [HttpStatusCode.BAD_GATEWAY]: {
      message: jiraMessage || 'Bad Gateway',
      userFriendlyMessage: 'JIRA received an invalid response from upstream server',
      suggestion: 'This is usually temporary. Wait and retry.',
    },
    [HttpStatusCode.SERVICE_UNAVAILABLE]: {
      message: jiraMessage || 'Service Unavailable',
      userFriendlyMessage: 'JIRA server is currently unavailable',
      suggestion: 'JIRA may be under maintenance. Try again later.',
    },
    [HttpStatusCode.GATEWAY_TIMEOUT]: {
      message: jiraMessage || 'Gateway Timeout',
      userFriendlyMessage: 'JIRA gateway timed out',
      suggestion: 'The server is slow to respond. Try again later.',
    },
    [HttpStatusCode.INSUFFICIENT_STORAGE]: {
      message: jiraMessage || 'Insufficient Storage',
      userFriendlyMessage: 'JIRA server has run out of storage',
      suggestion: 'Contact your JIRA administrator',
    },
  };

  // Default error info for unknown status codes
  const defaultInfo: ErrorInfo = {
    message: jiraMessage || `HTTP Error ${status}`,
    userFriendlyMessage: `JIRA returned an unexpected status code: ${status}`,
    suggestion: 'Check the logs for more details',
  };

  return statusMessages[status] || defaultInfo;
}

/**
 * Extract clean error message from HTML/JSON response
 */
function getCleanError(responseText: string, status: number): string {
  const errorInfo = getStatusCodeInfo(status, responseText);
  return errorInfo.message;
}

export class JiraClient {
  private baseUrl: string;
  private authenticator: SSOAuthenticator;
  private maxRetries: number = 5;
  private retryDelayMs: number = 5000;

  constructor(baseUrl: string, authenticator: SSOAuthenticator) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.authenticator = authenticator;
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Parse Retry-After header value
   */
  private parseRetryAfter(header: string | null): number | null {
    if (!header) return null;

    // Try parsing as seconds
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds) && seconds > 0 && seconds < 3600) {
      return seconds * 1000;
    }

    // Try parsing as HTTP date
    const date = Date.parse(header);
    if (!isNaN(date)) {
      const delayMs = date - Date.now();
      if (delayMs > 0 && delayMs < 3600000) {
        return delayMs;
      }
    }

    return null;
  }

  /**
   * Create a JiraApiError from a response
   */
  private async createApiError(response: Response, context: string): Promise<JiraApiError> {
    const errorBody = await response.text();
    const errorInfo = getStatusCodeInfo(response.status, errorBody);
    const retryAfterMs = this.parseRetryAfter(response.headers.get('Retry-After'));

    // Extract JIRA-specific errors
    let jiraErrors: string[] = [];
    try {
      const json = JSON.parse(errorBody);
      if (json.errorMessages) {
        jiraErrors = json.errorMessages;
      }
    } catch {
      // Not JSON
    }

    const error = new JiraApiError(
      `${context}: ${errorInfo.message}`,
      response.status,
      response.statusText,
      {
        rawBody: errorBody.substring(0, 1000),
        retryAfterMs: retryAfterMs || undefined,
        jiraErrors,
      }
    );

    // Log with appropriate level based on error category
    const logDetails = {
      status: response.status,
      statusText: response.statusText,
      category: error.errorCategory,
      isRetryable: error.isRetryable,
      message: errorInfo.message,
      suggestion: errorInfo.suggestion,
      jiraErrors,
    };

    if (error.errorCategory === 'server') {
      logger.error(`JIRA Server Error (${response.status})`, logDetails);
    } else if (error.isRetryable) {
      logger.warn(`JIRA API Error (${response.status}) - will retry`, logDetails);
    } else {
      logger.error(`JIRA Client Error (${response.status})`, logDetails);
    }

    return error;
  }

  /**
   * Fetch with retry logic for rate limiting (429) and transient server errors
   */
  private async fetchWithRetry(
    url: string, 
    options: RequestInit, 
    context: string,
    retries = 0
  ): Promise<Response> {
    let response: Response;
    
    try {
      response = await fetchWithSSL(url, options);
    } catch (networkError) {
      // Handle network-level errors (DNS, connection refused, etc.)
      logger.error('Network error connecting to JIRA', {
        url,
        error: networkError instanceof Error ? networkError.message : String(networkError),
      });
      throw new JiraApiError(
        `Network error: ${networkError instanceof Error ? networkError.message : 'Connection failed'}`,
        0,
        'Network Error',
        { rawBody: String(networkError) }
      );
    }

    // Check if we should retry
    const isRetryableStatus = [
      HttpStatusCode.REQUEST_TIMEOUT,
      HttpStatusCode.TOO_MANY_REQUESTS,
      HttpStatusCode.INTERNAL_SERVER_ERROR,
      HttpStatusCode.BAD_GATEWAY,
      HttpStatusCode.SERVICE_UNAVAILABLE,
      HttpStatusCode.GATEWAY_TIMEOUT,
    ].includes(response.status);

    if (isRetryableStatus && retries < this.maxRetries) {
      // Calculate delay
      let delayMs = this.retryDelayMs * Math.pow(2, retries); // Exponential backoff
      
      // Use Retry-After header if available
      const retryAfterMs = this.parseRetryAfter(response.headers.get('Retry-After'));
      if (retryAfterMs) {
        delayMs = retryAfterMs;
      }

      // Cap max delay at 2 minutes
      delayMs = Math.min(delayMs, 120000);

      const statusName = HttpStatusCode[response.status] || response.status;
      logger.warn(`${statusName} (${response.status}). Retrying in ${Math.round(delayMs / 1000)}s... (attempt ${retries + 1}/${this.maxRetries})`);
      
      await this.sleep(delayMs);
      return this.fetchWithRetry(url, options, context, retries + 1);
    }
    
    return response;
  }

  /**
   * Handle response and throw appropriate errors
   */
  private async handleResponse<T>(
    response: Response, 
    context: string,
    parseJson = true
  ): Promise<T> {
    if (!response.ok) {
      throw await this.createApiError(response, context);
    }

    if (parseJson) {
      try {
        return await response.json() as T;
      } catch (parseError) {
        throw new JiraApiError(
          `Failed to parse JIRA response as JSON`,
          response.status,
          'Parse Error',
          { rawBody: 'Response was not valid JSON' }
        );
      }
    }

    return undefined as T;
  }

  async fetchIssue(issueKey: string): Promise<JiraTicket> {
    logger.info(`Fetching JIRA issue: ${issueKey}`);
    
    const headers = await this.authenticator.getAuthHeaders();
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}?expand=renderedFields`;
    const context = `Fetch issue ${issueKey}`;

    try {
      logger.debug(`Fetching from URL: ${url}`);
      const response = await this.fetchWithRetry(url, { headers }, context);
      const data = await this.handleResponse<{ key: string; fields: JiraTicket['fields'] }>(
        response, 
        context
      );
      
      // Fetch comments separately
      const comments = await this.fetchComments(issueKey);
      
      const ticket: JiraTicket = {
        key: data.key,
        fields: data.fields,
        comments,
      };

      logger.info(`Successfully fetched issue ${issueKey}`);
      return ticket;
    } catch (error) {
      if (error instanceof JiraApiError) {
        // Add context-specific suggestions
        if (error.statusCode === HttpStatusCode.NOT_FOUND) {
          logger.error(`Issue ${issueKey} not found. Verify the ticket key is correct.`);
        } else if (error.statusCode === HttpStatusCode.UNAUTHORIZED) {
          logger.error(`Authentication failed. Check your PAT token in .env file.`);
        } else if (error.statusCode === HttpStatusCode.FORBIDDEN) {
          logger.error(`Access denied to ${issueKey}. Check your permissions.`);
        }
        throw error;
      }

      logger.error(`Failed to fetch issue ${issueKey}`, { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async fetchComments(issueKey: string): Promise<JiraTicket['comments']> {
    const headers = await this.authenticator.getAuthHeaders();
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/comment`;
    const context = `Fetch comments for ${issueKey}`;

    try {
      const response = await this.fetchWithRetry(url, { headers }, context);

      if (!response.ok) {
        // Comments are optional - log warning but don't throw
        const errorInfo = getStatusCodeInfo(response.status);
        logger.warn(`Failed to fetch comments for ${issueKey}: ${errorInfo.message}`);
        return [];
      }

      const data = await response.json() as { 
        comments: Array<{ body: string; author: { displayName: string }; created: string }> 
      };
      return data.comments.map((c) => ({
        body: c.body,
        author: {
          displayName: c.author.displayName,
        },
        created: c.created,
      }));
    } catch (error) {
      // Comments are optional - log warning but don't throw
      if (error instanceof JiraApiError) {
        logger.warn(`Could not fetch comments for ${issueKey}: ${error.message}`);
      } else {
        logger.warn(`Error fetching comments for ${issueKey}`, { error });
      }
      return [];
    }
  }

  async fetchAttachments(issueKey: string): Promise<JiraAttachment[]> {
    logger.info(`Fetching attachments for ${issueKey}`);
    
    const headers = await this.authenticator.getAuthHeaders();
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}`;
    const context = `Fetch attachments for ${issueKey}`;

    try {
      const response = await this.fetchWithRetry(url, { headers }, context);
      const data = await this.handleResponse<{ fields: { attachment?: Array<{
        id: string;
        filename: string;
        mimeType: string;
        content: string;
        size: number;
      }> } }>(response, context);

      const attachments = data.fields.attachment || [];
      const results: JiraAttachment[] = [];

      for (const att of attachments) {
        logger.debug(`Downloading attachment: ${att.filename}`);
        
        try {
          const contentResponse = await this.fetchWithRetry(
            att.content, 
            { headers },
            `Download attachment ${att.filename}`
          );
          
          if (!contentResponse.ok) {
            const errorInfo = getStatusCodeInfo(contentResponse.status);
            logger.warn(`Failed to download attachment ${att.filename}: ${errorInfo.message}`);
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
          if (error instanceof JiraApiError) {
            logger.warn(`Could not download attachment ${att.filename}: ${error.message}`);
          } else {
            logger.warn(`Error downloading attachment: ${att.filename}`, { error });
          }
        }
      }

      logger.info(`Downloaded ${results.length} attachments`);
      return results;
    } catch (error) {
      if (error instanceof JiraApiError) {
        logger.error(`Failed to fetch attachments for ${issueKey}: ${error.message}`, {
          statusCode: error.statusCode,
          suggestion: getStatusCodeInfo(error.statusCode).suggestion,
        });
      } else {
        logger.error(`Failed to fetch attachments for ${issueKey}`, { error });
      }
      throw error;
    }
  }

  async addComment(issueKey: string, comment: string): Promise<void> {
    logger.info(`Adding comment to ${issueKey}`);
    
    const headers = await this.authenticator.getAuthHeaders();
    const url = `${this.baseUrl}/rest/api/2/issue/${issueKey}/comment`;
    const context = `Add comment to ${issueKey}`;

    try {
      const response = await this.fetchWithRetry(
        url, 
        {
          method: 'POST',
          headers,
          body: JSON.stringify({ body: comment }),
        },
        context
      );

      if (!response.ok) {
        throw await this.createApiError(response, context);
      }

      logger.info(`Successfully added comment to ${issueKey}`);
    } catch (error) {
      if (error instanceof JiraApiError) {
        const errorInfo = getStatusCodeInfo(error.statusCode);
        logger.error(`Failed to add comment to ${issueKey}: ${error.message}`, {
          statusCode: error.statusCode,
          suggestion: errorInfo.suggestion,
        });
        
        // Provide specific guidance for common errors
        if (error.statusCode === HttpStatusCode.FORBIDDEN) {
          logger.error('You may not have permission to add comments to this issue.');
        } else if (error.statusCode === HttpStatusCode.NOT_FOUND) {
          logger.error('The issue may have been deleted or moved.');
        }
      } else {
        logger.error(`Failed to add comment to ${issueKey}`, { error });
      }
      throw error;
    }
  }

  /**
   * Verify connection to JIRA server
   * Useful for testing authentication without fetching issue data
   */
  async verifyConnection(): Promise<{ serverVersion: string; baseUrl: string }> {
    const headers = await this.authenticator.getAuthHeaders();
    const url = `${this.baseUrl}/rest/api/2/serverInfo`;
    const context = 'Verify JIRA connection';

    try {
      const response = await this.fetchWithRetry(url, { headers }, context);
      const data = await this.handleResponse<{
        version: string;
        baseUrl: string;
        serverTitle: string;
      }>(response, context);

      logger.info(`Connected to JIRA: ${data.serverTitle} v${data.version}`);
      return {
        serverVersion: data.version,
        baseUrl: data.baseUrl,
      };
    } catch (error) {
      if (error instanceof JiraApiError) {
        if (error.statusCode === HttpStatusCode.UNAUTHORIZED) {
          throw new JiraApiError(
            'JIRA authentication failed. Please check your PAT token.',
            error.statusCode,
            error.statusText,
            { rawBody: error.rawBody }
          );
        }
      }
      throw error;
    }
  }
}

