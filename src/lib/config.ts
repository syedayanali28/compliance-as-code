// Centralized configuration from environment variables

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  supabase: {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("SUPABASE_ANON_KEY"),
    serviceRoleKey: optional("SUPABASE_SERVICE_ROLE_KEY", ""),
  },
  auth: {
    secret: required("NEXTAUTH_SECRET"),
    url: optional("NEXTAUTH_URL", "http://localhost:3000"),
  },
  keycloak: {
    issuer: optional("KEYCLOAK_ISSUER", ""),
    clientId: optional("KEYCLOAK_CLIENT_ID", ""),
    clientSecret: optional("KEYCLOAK_CLIENT_SECRET", ""),
  },
  adfs: {
    issuer: optional("ADFS_ISSUER", ""),
    clientId: optional("ADFS_CLIENT_ID", ""),
    clientSecret: optional("ADFS_CLIENT_SECRET", ""),
    authorizationUrl: optional("ADFS_AUTHORIZATION_URL", ""),
    tokenUrl: optional("ADFS_TOKEN_URL", ""),
  },
  gitlab: {
    url: optional("GITLAB_URL", ""),
    apiToken: optional("GITLAB_API_TOKEN", ""),
    idacGroup: optional("GITLAB_IDAC_GROUP", "idac"),
  },
  jira: {
    baseUrl: optional("JIRA_BASE_URL", ""),
    serviceAccountToken: optional("JIRA_SERVICE_ACCOUNT_TOKEN", ""),
    webhookSecret: optional("JIRA_WEBHOOK_SECRET", ""),
    firewallProjectKey: optional("JIRA_FIREWALL_PROJECT_KEY", "ITISUFR"),
  },
  llm: {
    provider: optional("LLM_PROVIDER", "maas"),
    apiKey: optional("LLM_API_KEY", ""),
    endpoint: optional("LLM_ENDPOINT", ""),
    model: optional("LLM_MODEL", "gpt-4"),
  },
  app: {
    logLevel: optional("LOG_LEVEL", "info"),
  },
} as const;

// Lazy accessor - only validates when config is actually used
let _config: typeof config | null = null;

export function getConfig() {
  if (!_config) {
    _config = config;
  }
  return _config;
}
