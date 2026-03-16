// Configuration management

import {
  MAAS_URL,
  MAAS_API_KEY,
  DEFAULT_MODEL as MAAS_DEFAULT_MODEL,
  DEFAULT_TEMPERATURE as MAAS_DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS as MAAS_DEFAULT_MAX_TOKENS,
} from './maas-config';

export interface Config {
  jira: {
    baseUrl: string;
    authType: 'basic' | 'sso' | 'pat';
    tokenCachePath: string;
    // Auto-loaded credentials from .env (PAT-based auth)
    username?: string;
    pat?: string;
  };
  llm: {
    provider: 'openai' | 'azure' | 'anthropic' | 'maas';
    model: string;
    apiKey?: string;
    endpoint?: string;
    temperature: number;
    maxTokens: number;
  };
  review: {
    riskScoreThreshold: number;
    autoRejectHighRisk: boolean;
  };
  logging: {
    auditLogPath: string;
    appLogLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  // SSL configuration
  ssl: {
    rejectUnauthorized: boolean;
  };
}

/**
 * Determine the best LLM provider based on configuration
 * Priority: MaaS (if configured) > OpenAI > Azure > Anthropic
 */
function determineLLMProvider(): 'openai' | 'azure' | 'anthropic' | 'maas' {
  const envProvider = process.env.LLM_PROVIDER?.toLowerCase();
  
  // If explicitly set, use that
  if (envProvider === 'maas' || envProvider === 'openai' || envProvider === 'azure' || envProvider === 'anthropic') {
    return envProvider as 'openai' | 'azure' | 'anthropic' | 'maas';
  }
  
  // Auto-detect: prefer MaaS if configured
  if (MAAS_API_KEY) {
    return 'maas';
  }
  
  // Fallback to OpenAI if that's configured
  if (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY) {
    return 'openai';
  }
  
  // Default to MaaS (internal provider)
  return 'maas';
}

/**
 * Extract username from PAT token if available
 */
function extractPATCredentials(): { username?: string; pat?: string } {
  // Check for PAT in various env vars
  const pat = process.env.PAT || process.env.JIRA_PAT || process.env.JIRA_TOKEN;
  const uatPat = process.env.UAT_PAT;
  const jiraUrl = process.env.JIRA_BASE_URL || '';
  
  // Use UAT PAT if connecting to UAT JIRA
  const activePat = jiraUrl.includes('uat') ? (uatPat || pat) : pat;
  
  // Username can be explicit or derived
  const username = process.env.JIRA_USERNAME || process.env.PAT_USERNAME;
  
  return {
    username,
    pat: activePat,
  };
}

const provider = determineLLMProvider();
const patCreds = extractPATCredentials();

const DEFAULT_CONFIG: Config = {
  jira: {
    baseUrl: process.env.JIRA_BASE_URL || 'https://jira.intra.hkma.gov.hk',
    authType: (process.env.JIRA_AUTH_TYPE as 'basic' | 'sso' | 'pat') || 'pat',
    tokenCachePath: process.env.TOKEN_CACHE_PATH || './.fw-cli-cache',
    username: patCreds.username,
    pat: patCreds.pat,
  },
  llm: {
    provider,
    model: provider === 'maas' 
      ? MAAS_DEFAULT_MODEL 
      : (process.env.LLM_MODEL || 'gpt-4-turbo-preview'),
    apiKey: provider === 'maas' 
      ? MAAS_API_KEY 
      : (process.env.OPENAI_API_KEY || process.env.LLM_API_KEY),
    endpoint: provider === 'maas' 
      ? MAAS_URL 
      : process.env.LLM_ENDPOINT,
    temperature: provider === 'maas' 
      ? MAAS_DEFAULT_TEMPERATURE 
      : parseFloat(process.env.LLM_TEMPERATURE || '0.3'),
    maxTokens: provider === 'maas' 
      ? MAAS_DEFAULT_MAX_TOKENS 
      : parseInt(process.env.LLM_MAX_TOKENS || '4000', 10),
  },
  review: {
    riskScoreThreshold: parseInt(process.env.RISK_SCORE_THRESHOLD || '40', 10),
    autoRejectHighRisk: process.env.AUTO_REJECT_HIGH_RISK !== 'false',
  },
  logging: {
    auditLogPath: process.env.AUDIT_LOG_PATH || './logs/audit.jsonl',
    appLogLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  },
  ssl: {
    // Default to allowing self-signed certs for internal networks
    rejectUnauthorized: process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0',
  },
};

export function getConfig(): Config {
  return DEFAULT_CONFIG;
}

/**
 * Print configuration summary (for debugging)
 * Masks sensitive values
 */
export function printConfigSummary(): void {
  const config = getConfig();
  console.log('Configuration Summary:');
  console.log(`  JIRA URL: ${config.jira.baseUrl}`);
  console.log(`  Auth Type: ${config.jira.authType}`);
  console.log(`  PAT Configured: ${config.jira.pat ? 'Yes' : 'No'}`);
  console.log(`  LLM Provider: ${config.llm.provider}`);
  console.log(`  LLM Model: ${config.llm.model}`);
  console.log(`  LLM API Key: ${config.llm.apiKey ? '***configured***' : 'NOT SET'}`);
  console.log(`  SSL Verify: ${config.ssl.rejectUnauthorized ? 'Enabled' : 'Disabled'}`);
}

