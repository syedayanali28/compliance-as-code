/**
 * MaaS LLM Configuration
 * Loads settings from .env file for the internal MaaS (Model as a Service) provider
 * 
 * Security notes:
 * - API keys are loaded from environment variables only (never hardcoded)
 * - SSL verification can be disabled for internal networks with self-signed certs
 * - Credentials are cached in memory during session only
 */

import 'dotenv/config';

// ============================================================================
// MaaS Configuration
// ============================================================================

// MaaS endpoint URL - internal LLM service
export const MAAS_URL = process.env.MAAS_URL || 'https://maas-trial-qwen3-30b.model-serving-farm.intra.hkma.gov.hk';

// API key for MaaS authentication (required)
export const MAAS_API_KEY = process.env.MAAS_API_KEY || '';

// Default model to use
// Options: 'deepseek', 'qwen', 'llama', or specific model name
export const DEFAULT_MODEL = process.env.MAAS_MODEL || process.env.DEFAULT_MODEL || 'Qwen3-30B-A3B-Instruct-2507-AWQ';

// Concurrency limit for parallel requests
export const MAAS_MAX_CONCURRENCY = parseInt(process.env.MAAS_MAX_CONCURRENCY || '1', 10);

// ============================================================================
// LLM Parameters
// ============================================================================

export const DEFAULT_TEMPERATURE = parseFloat(process.env.MAAS_TEMPERATURE || process.env.LLM_TEMPERATURE || '0.1');
export const DEFAULT_MAX_TOKENS = parseInt(process.env.MAAS_MAX_TOKENS || process.env.LLM_MAX_TOKENS || '4000', 10);

// ============================================================================
// Network Configuration  
// ============================================================================

export const REQUEST_TIMEOUT = parseInt(process.env.MAAS_TIMEOUT || process.env.REQUEST_TIMEOUT || '60000', 10);
export const HTTPS_PROXY = process.env.HTTPS_PROXY || null;
export const HTTP_PROXY = process.env.HTTP_PROXY || null;

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate MaaS configuration
 * Returns error messages if configuration is invalid
 */
export function validateMaaSConfig(): string[] {
  const errors: string[] = [];
  
  if (!MAAS_API_KEY) {
    errors.push('MAAS_API_KEY is not set. AI features (review, analysis) will not work.');
  }
  
  if (!MAAS_URL) {
    errors.push('MAAS_URL is not set. Cannot connect to MaaS service.');
  }
  
  return errors;
}

/**
 * Check if MaaS is configured and ready
 */
export function isMaaSConfigured(): boolean {
  return !!MAAS_API_KEY && !!MAAS_URL;
}

