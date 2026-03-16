/**
 * MaaS (Model as a Service) Provider
 * 
 * Internal LLM provider for HKMA's MaaS service.
 * Implements the same interface as other LLM providers (OpenAI, Azure, Anthropic)
 * but connects to the internal MaaS endpoint.
 * 
 * Security considerations:
 * - API keys are never logged or exposed
 * - SSL verification is controlled via environment settings
 * - Requests timeout after configurable duration
 */

import https from 'https';
import { logger } from '../logging/app-logger';
import {
  MAAS_URL,
  MAAS_API_KEY,
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS,
  REQUEST_TIMEOUT,
} from '../config/maas-config';

export interface MaaSConfig {
  maasUrl?: string;
  apiKey?: string;
  defaultModel?: string;
  maxConcurrency?: number;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}

export interface MaaSMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface MaaSResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * MaaS Provider - connects to internal MaaS LLM service
 */
export class MaaSProvider {
  private maasUrl: string;
  private apiKey: string;
  private defaultModel: string;
  private temperature: number;
  private maxTokens: number;
  private timeout: number;

  constructor(config: MaaSConfig = {}) {
    this.maasUrl = config.maasUrl || MAAS_URL;
    this.apiKey = config.apiKey || MAAS_API_KEY;
    this.defaultModel = config.defaultModel || DEFAULT_MODEL;
    this.temperature = config.temperature ?? DEFAULT_TEMPERATURE;
    this.maxTokens = config.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.timeout = config.timeout ?? REQUEST_TIMEOUT;

    if (!this.apiKey) {
      logger.warn('MaaS API key not configured. LLM features will not work.');
    }
  }

  /**
   * Send a chat completion request to MaaS
   */
  async chatCompletion(
    messages: MaaSMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error('MaaS API key not configured. Set MAAS_API_KEY in .env file.');
    }

    const model = options?.model || this.defaultModel;
    const temperature = options?.temperature ?? this.temperature;
    const maxTokens = options?.maxTokens ?? this.maxTokens;

    // Construct endpoint URL - MaaS uses OpenAI-compatible API
    const endpoint = this.maasUrl.endsWith('/v1/chat/completions')
      ? this.maasUrl
      : `${this.maasUrl.replace(/\/$/, '')}/v1/chat/completions`;

    logger.debug('Calling MaaS API', {
      model,
      endpoint: endpoint.replace(/\/\/[^@]+@/, '//***:***@'), // Mask credentials in URL
      messageCount: messages.length,
    });

    try {
      const response = await this.makeRequest(endpoint, {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: false,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('MaaS API error', {
          status: response.status,
          statusText: response.statusText,
          error: errorBody.substring(0, 500),
        });
        throw new Error(`MaaS API error: ${response.status} - ${this.parseErrorMessage(errorBody)}`);
      }

      const data = (await response.json()) as MaaSResponse;

      if (!data.choices || data.choices.length === 0) {
        throw new Error('MaaS returned empty response');
      }

      const content = data.choices[0].message?.content;
      if (!content) {
        throw new Error('MaaS response missing content');
      }

      logger.debug('MaaS response received', {
        model: data.model,
        finishReason: data.choices[0].finish_reason,
        tokens: data.usage?.total_tokens,
      });

      return content;
    } catch (error) {
      if (error instanceof Error && error.message.includes('MaaS API error')) {
        throw error;
      }
      logger.error('MaaS request failed', { error });
      throw new Error(`MaaS request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Simple completion helper (wraps chatCompletion)
   */
  async complete(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<string> {
    const messages: MaaSMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];

    return this.chatCompletion(messages, options);
  }

  /**
   * Make HTTP request with proper SSL handling
   */
  private async makeRequest(url: string, body: unknown): Promise<Response> {
    // Check SSL verification setting
    const disableSSL = process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ||
                       process.env.DISABLE_SSL_VERIFY === 'true';

    // Create custom HTTPS agent for internal networks with self-signed certs
    const agent = new https.Agent({
      rejectUnauthorized: !disableSSL,
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
        // @ts-expect-error - agent is valid but TypeScript doesn't recognize it
        agent,
      });

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse error message from response body
   */
  private parseErrorMessage(body: string): string {
    try {
      const json = JSON.parse(body);
      if (json.error?.message) {
        return json.error.message;
      }
      if (json.message) {
        return json.message;
      }
      if (json.detail) {
        return typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail);
      }
    } catch {
      // Not JSON, return raw body excerpt
    }
    return body.substring(0, 200);
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.maasUrl;
  }

  /**
   * Get configuration status
   */
  getStatus(): { configured: boolean; endpoint: string; model: string } {
    return {
      configured: this.isConfigured(),
      endpoint: this.maasUrl.replace(/\/\/[^@]+@/, '//***:***@'),
      model: this.defaultModel,
    };
  }
}

// Singleton instance for shared use
let _sharedInstance: MaaSProvider | null = null;

/**
 * Get shared MaaS provider instance (singleton)
 */
export function getSharedMaaSProvider(): MaaSProvider {
  if (!_sharedInstance) {
    _sharedInstance = new MaaSProvider();
  }
  return _sharedInstance;
}

/**
 * Reset shared instance (for testing)
 */
export function resetSharedMaaSProvider(): void {
  _sharedInstance = null;
}

