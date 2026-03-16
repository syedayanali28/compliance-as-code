// Fetch wrapper with SSL certificate handling for corporate environments

import { logger } from '../logging/app-logger';

/**
 * Wrapper for fetch with SSL handling for Next.js environment
 * 
 * Next.js uses undici for fetch, which requires different SSL handling.
 * We set Node.js environment variables to control SSL behavior.
 */
export async function fetchWithSSL(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Check if SSL verification should be disabled
  const disableSSL = process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ||
                     process.env.DISABLE_SSL_VERIFY === 'true';

  if (disableSSL) {
    logger.warn('SSL certificate verification is disabled - use only in trusted networks');
  }

  try {
    // For Next.js/undici, we need to handle SSL at the Node.js level
    // Store the original value
    const originalRejectUnauthorized = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    
    // Temporarily set SSL verification based on config
    if (disableSSL) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      return response;
    } finally {
      // Restore original value
      if (originalRejectUnauthorized !== undefined) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalRejectUnauthorized;
      } else {
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      }
    }
  } catch (error) {
    // Provide better error messages for common SSL issues
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 30 seconds');
      }
      
      if (error.message.includes('certificate') || error.message.includes('SSL') || error.message.includes('TLS')) {
        logger.error('SSL certificate error. Set NODE_TLS_REJECT_UNAUTHORIZED=0 or DISABLE_SSL_VERIFY=true in .env to bypass (not recommended for production)');
        throw new Error(`SSL certificate error: ${error.message}`);
      }
      
      if (error.message.includes('ECONNREFUSED')) {
        throw new Error('Connection refused - JIRA server may be down or URL is incorrect');
      }
      
      if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
        throw new Error('Cannot resolve JIRA hostname - check your JIRA_BASE_URL in .env');
      }
    }
    
    throw error;
  }
}

