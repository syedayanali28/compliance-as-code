import { createOpenAI } from "@ai-sdk/openai";

export interface WorkflowTextModelEntry {
  id: string;
  name: string;
  provider: string;
  pricing?: {
    input?: string;
    output?: string;
  };
  default?: boolean;
  disabled?: boolean;
}

interface WorkflowProviderState {
  id: string;
  getTextModels: () => Promise<WorkflowTextModelEntry[]>;
  getLanguageModel: (modelId: string) => unknown;
}

const DEFAULT_MAAS_MODEL = "qwen3-30b-instruct-awq-maas-trial-endpoint";

const getMaasBaseUrl = () => {
  const rawUrl = process.env.MAAS_URL?.trim();
  if (!rawUrl) {
    return "";
  }

  const normalized = rawUrl.replace(/\/$/, "");
  if (normalized.endsWith("/v1")) {
    return normalized;
  }
  if (normalized.endsWith("/v1/chat/completions")) {
    return normalized.replace(/\/chat\/completions$/, "");
  }

  return `${normalized}/v1`;
};

const parseConfiguredModels = () => {
  const configured =
    process.env.WORKFLOW_CANVAS_TEXT_MODELS ??
    process.env.MAAS_MODELS ??
    process.env.MAAS_MODEL ??
    process.env.DEFAULT_MODEL ??
    DEFAULT_MAAS_MODEL;

  const parsed = configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return parsed.length ? parsed : [DEFAULT_MAAS_MODEL];
};

const getDefaultModelId = (modelIds: string[]) => {
  const configuredDefault =
    process.env.WORKFLOW_CANVAS_DEFAULT_MODEL ??
    process.env.MAAS_MODEL ??
    process.env.DEFAULT_MODEL;

  if (configuredDefault && modelIds.includes(configuredDefault)) {
    return configuredDefault;
  }

  return modelIds[0] ?? DEFAULT_MAAS_MODEL;
};

const maasProviderState: WorkflowProviderState = {
  id: "maas",
  async getTextModels() {
    const modelIds = parseConfiguredModels();
    const defaultModel = getDefaultModelId(modelIds);

    return modelIds.map((modelId) => ({
      id: modelId,
      name: modelId,
      provider: "maas",
      default: modelId === defaultModel,
    }));
  },
  getLanguageModel(modelId: string) {
    const baseURL = getMaasBaseUrl();
    const apiKey = process.env.MAAS_API_KEY ?? "";
    const maas = createOpenAI({
      baseURL,
      apiKey,
    });

    return maas(modelId);
  },
};

const providerStates: Record<string, WorkflowProviderState> = {
  maas: maasProviderState,
};

export const getAvailableProviderStates = () => Object.values(providerStates);

export const getActiveProviderState = () => {
  const configured =
    process.env.WORKFLOW_CANVAS_LLM_PROVIDER ?? process.env.LLM_PROVIDER;

  if (configured && configured in providerStates) {
    return providerStates[configured];
  }

  return maasProviderState;
};
