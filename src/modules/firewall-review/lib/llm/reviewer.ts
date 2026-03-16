// LLM reviewer - calls LLM and parses response

import { logger } from '../logging/app-logger';
import type { NormalizedFormat, LLMReview } from '../types';
import { PromptBuilder } from './prompt-builder';
import { MaaSProvider } from './maas-provider';

export interface LLMConfig {
  provider: 'openai' | 'azure' | 'anthropic' | 'maas';
  model: string;
  apiKey?: string;
  endpoint?: string;
  temperature: number;
  maxTokens: number;
}

export class LLMReviewer {
  private config: LLMConfig;
  private promptBuilder: PromptBuilder;
  private maasProvider: MaaSProvider | null = null;

  constructor(config: LLMConfig) {
    this.config = config;
    this.promptBuilder = new PromptBuilder();

    // Initialize MaaS provider if using MaaS
    if (config.provider === 'maas') {
      this.maasProvider = new MaaSProvider({
        maasUrl: config.endpoint,
        apiKey: config.apiKey,
        defaultModel: config.model,
        temperature: config.temperature,
        maxTokens: config.maxTokens,
      });
    }
  }

  async review(normalized: NormalizedFormat): Promise<LLMReview> {
    logger.info('Starting LLM review');

    const prompt = this.promptBuilder.buildReviewPrompt(normalized);
    
    try {
      const response = await this.callLLM(prompt);
      const review = this.parseResponse(response);
      
      logger.info(
        `LLM review complete: ${review.decision}`,
        { confidence: review.confidence, violations: review.violations.length }
      );

      return review;
    } catch (error) {
      logger.error('LLM review failed', { error });
      
      // Return REQUEST_INFO on error
      return {
        decision: 'REQUEST_INFO',
        confidence: 0,
        summary: 'LLM review failed. Manual review required.',
        violations: [],
        missing_info: ['LLM analysis unavailable - technical error'],
        suggested_jira_comment: 
          'Automated review encountered an error. Please conduct manual review.',
      };
    }
  }

  private async callLLM(prompt: string): Promise<string> {
    switch (this.config.provider) {
      case 'maas':
        return this.callMaaS(prompt);
      case 'openai':
        return this.callOpenAI(prompt);
      case 'azure':
        return this.callAzureOpenAI(prompt);
      case 'anthropic':
        return this.callAnthropic(prompt);
      default:
        throw new Error(`Unsupported LLM provider: ${this.config.provider}`);
    }
  }

  private async callMaaS(prompt: string): Promise<string> {
    if (!this.maasProvider) {
      throw new Error('MaaS provider not initialized');
    }

    if (!this.maasProvider.isConfigured()) {
      throw new Error('MaaS not configured. Set MAAS_API_KEY in .env file.');
    }

    logger.debug('Calling MaaS API', { model: this.config.model });

    const systemPrompt = 
      'You are a senior security engineer reviewing firewall rules. ' +
      'Always respond with valid JSON only. No additional text before or after the JSON.';

    return this.maasProvider.complete(systemPrompt, prompt);
  }

  private async callOpenAI(prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('OpenAI API key not provided');
    }

    const endpoint = this.config.endpoint || 'https://api.openai.com/v1/chat/completions';

    logger.debug('Calling OpenAI API', { model: this.config.model });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'You are a senior security engineer reviewing firewall rules. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callAzureOpenAI(prompt: string): Promise<string> {
    if (!this.config.apiKey || !this.config.endpoint) {
      throw new Error('Azure OpenAI API key and endpoint required');
    }

    logger.debug('Calling Azure OpenAI', { model: this.config.model });

    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.config.apiKey,
      },
      body: JSON.stringify({
        messages: [
          {
            role: 'system',
            content: 'You are a senior security engineer reviewing firewall rules. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Azure OpenAI error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private async callAnthropic(prompt: string): Promise<string> {
    if (!this.config.apiKey) {
      throw new Error('Anthropic API key not provided');
    }

    const endpoint = this.config.endpoint || 'https://api.anthropic.com/v1/messages';

    logger.debug('Calling Anthropic API', { model: this.config.model });

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }

  private parseResponse(response: string): LLMReview {
    try {
      // Try to extract JSON if wrapped in markdown code blocks
      let jsonStr = response.trim();
      
      const codeBlockMatch = jsonStr.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      // Validate required fields
      if (!parsed.decision || !['ACCEPT', 'REJECT', 'REQUEST_INFO'].includes(parsed.decision)) {
        throw new Error('Invalid decision field');
      }

      return {
        decision: parsed.decision,
        confidence: parsed.confidence || 0,
        summary: parsed.summary || '',
        violations: parsed.violations || [],
        missing_info: parsed.missing_info || [],
        suggested_jira_comment: parsed.suggested_jira_comment || '',
      };
    } catch (error) {
      logger.error('Failed to parse LLM response', { error, response });
      
      // Return REQUEST_INFO for invalid responses
      return {
        decision: 'REQUEST_INFO',
        confidence: 0,
        summary: 'Failed to parse LLM response',
        violations: [],
        missing_info: ['LLM response format error'],
        suggested_jira_comment: 
          'Automated review returned invalid format. Manual review required.',
      };
    }
  }
}

