import type { Edge, Node } from "@xyflow/react";

export type HkmaNodeCategory =
  | "zone"
  | "region"
  | "environment"
  | "compute"
  | "resource"
  | "backend"
  | "frontend"
  | "database"
  | "integration"
  | "iam"
  | "orchestration"
  | "ai"
  | "security"
  | "monitoring"
  | "storage"
  | "cicd";

export type HkmaZone =
  | "oa-baremetal"
  | "oa-private-cloud"
  | "oa-app-dmz"
  | "dmz"
  | "aws-landing-zone";

export interface HkmaNodeData {
  label: string;
  category: HkmaNodeCategory;
  description?: string;
  zone?: HkmaZone;
  componentType?: string;
  componentKey?: string;
  zoneId?: string;
  zoneLabel?: string;
  regionId?: string;
  regionLabel?: string;
  environmentId?: string;
  environmentLabel?: string;
  computeId?: string;
  computeLabel?: string;
  computeType?: string;
  instanceNumber?: number;
  instanceId?: string;
  locationSummary?: string;
  customFields?: Record<string, string>;
}

const HKMA_NODE_DEFS: Record<
  string,
  {
    category: HkmaNodeCategory;
    source: boolean;
    target?: boolean;
  }
> = {
  // Zones (top-level containers)
  "zone-oa-baremetal": { category: "zone", source: false, target: false },
  "zone-oa-private-cloud": { category: "zone", source: false, target: false },
  "zone-oa-app-dmz": { category: "zone", source: false, target: false },
  "zone-dmz": { category: "zone", source: false, target: false },
  "zone-aws-landing-zone": { category: "zone", source: false, target: false },
  
  // Regions
  "region-ifc": { category: "region", source: false, target: false },
  "region-kcc": { category: "region", source: false, target: false },
  
  // Environments
  environment: { category: "environment", source: false, target: false },
  "environment-box": { category: "environment", source: false, target: false },
  "environment-prod": { category: "environment", source: false, target: false },
  "environment-pre": { category: "environment", source: false, target: false },
  "environment-uat": { category: "environment", source: false, target: false },
  "environment-dev": { category: "environment", source: false, target: false },
  "environment-dr": { category: "environment", source: false, target: false },
  
  // Compute
  "compute-vm": { category: "compute", source: false, target: false },
  "compute-k8s": { category: "compute", source: false, target: false },
  
  // Legacy resource (keep for backwards compatibility)
  "resource-app": { category: "resource", source: true, target: true },
  "resource-db": { category: "resource", source: true, target: true },
  
  // Databases
  "database-postgres": { category: "database", source: true, target: true },
  "database-mysql": { category: "database", source: true, target: true },
  "data-dremio": { category: "database", source: true, target: true },
  
  // Backend
  "backend-nodejs": { category: "backend", source: true, target: true },
  "backend-fastapi": { category: "backend", source: true, target: true },
  "backend-flask": { category: "backend", source: true, target: true },
  "backend-dotnet": { category: "backend", source: true, target: true },
  "backend-express": { category: "backend", source: true, target: true },
  "backend-drizzle-orm": { category: "backend", source: true, target: true },
  "container-docker": { category: "backend", source: true, target: true },
  
  // Frontend
  "frontend-nextjs": { category: "frontend", source: true, target: true },
  "frontend-gradio": { category: "frontend", source: true, target: true },
  "frontend-axios": { category: "frontend", source: true, target: true },
  
  // IAM
  "iam-active-directory": { category: "iam", source: true, target: true },
  
  // Orchestration
  "orchestration-kubernetes": { category: "orchestration", source: true, target: true },
  
  // AI/ML
  "ai-maas-genai": { category: "ai", source: true, target: true },
  "ai-rayserve": { category: "ai", source: true, target: true },
  "ai-dify": { category: "ai", source: true, target: true },
  
  // Security
  "security-siem": { category: "security", source: true, target: true },
  "security-edr": { category: "security", source: true, target: true },
  
  // Monitoring
  "monitoring-grafana": { category: "monitoring", source: true, target: true },
  
  // Storage
  "storage-pure-storage": { category: "storage", source: true, target: true },
  "storage-filecloud": { category: "storage", source: true, target: true },
  
  // CI/CD
  "cicd-harbor": { category: "cicd", source: true, target: true },
  "cicd-jenkins": { category: "cicd", source: true, target: true },
  "cicd-ansible": { category: "cicd", source: true, target: true },
  "cicd-sonarqube": { category: "cicd", source: true, target: true },
  "cicd-gitlab": { category: "cicd", source: true, target: true },
  
  // Integration / External
  "issue-tracking-jira": { category: "integration", source: true, target: true },
  "bi-tableau": { category: "integration", source: true, target: true },
  "external-lseg-api": { category: "integration", source: true, target: true },
};

const CATEGORY_ORDER: Record<HkmaNodeCategory, number> = {
  zone: 0,
  region: 1,
  environment: 2,
  compute: 3,
  resource: 4,
  frontend: 4,
  backend: 5,
  database: 6,
  iam: 7,
  orchestration: 8,
  ai: 9,
  security: 10,
  monitoring: 11,
  storage: 12,
  cicd: 13,
  integration: 14,
};

export const isHkmaNodeType = (type?: string | null): type is string =>
  Boolean(type && HKMA_NODE_DEFS[type]);

export const getHkmaCategory = (type?: string | null): HkmaNodeCategory | null => {
  if (!type || !HKMA_NODE_DEFS[type]) {
    return null;
  }

  return HKMA_NODE_DEFS[type].category;
};

/** Prefer `data.category` (e.g. environment boxes) then fall back to node type. */
export const getEffectiveNodeCategory = (node: Node): HkmaNodeCategory | null => {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const fromData = data.category;
  if (typeof fromData === "string") {
    return fromData as HkmaNodeCategory;
  }
  return getHkmaCategory(node.type);
};

export const isFirewallNode = (node: Node): boolean => {
  // Firewalls are no longer visual nodes in the new hierarchy
  return false;
};

export const supportsOutboundConnection = (type?: string | null) => {
  if (!type) {
    return true;
  }

  if (HKMA_NODE_DEFS[type]) {
    return HKMA_NODE_DEFS[type].source;
  }

  return type !== "drop";
};

export const supportsInboundConnection = (type?: string | null) => {
  if (!type) {
    return true;
  }

  if (HKMA_NODE_DEFS[type]) {
    return HKMA_NODE_DEFS[type].target ?? true;
  }

  return type !== "drop";
};

const getNodeZone = (node: Node): HkmaZone | undefined => {
  const data = node.data as unknown as HkmaNodeData | undefined;
  return data?.zone;
};

export const isValidHkmaConnection = (source: Node, target: Node) => {
  if (!(isHkmaNodeType(source.type) && isHkmaNodeType(target.type))) {
    return true;
  }

  const sourceCategory = getHkmaCategory(source.type);
  const targetCategory = getHkmaCategory(target.type);

  if (!(sourceCategory && targetCategory)) {
    return false;
  }

  const sourceZone = getNodeZone(source);
  const targetZone = getNodeZone(target);

  if (
    (sourceCategory === "zone" || sourceCategory === "control") &&
    sourceZone &&
    targetZone &&
    sourceZone !== targetZone
  ) {
    return CATEGORY_ORDER[targetCategory] >= CATEGORY_ORDER[sourceCategory];
  }

  return true;
};

export interface HkmaGraphNode {
  id: string;
  type: string;
  label: string;
  category: HkmaNodeCategory;
  description?: string;
  zone?: HkmaZone;
  componentType?: string;
  customFields?: Record<string, string>;
  position: {
    x: number;
    y: number;
  };
}

export interface HkmaGraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface HkmaCanvasGraph {
  version: "1.0";
  nodes: HkmaGraphNode[];
  edges: HkmaGraphEdge[];
}

export const toHkmaCanvasGraph = (nodes: Node[], edges: Edge[]): HkmaCanvasGraph => ({
  version: "1.0",
  nodes: nodes
    .filter((node) => isHkmaNodeType(node.type))
    .map((node) => {
      const data = (node.data ?? {}) as unknown as HkmaNodeData;

      return {
        id: node.id,
        type: node.type as string,
        label: data.label ?? "Untitled",
        category: data.category ?? "resource",
        description: data.description,
        zone: data.zone,
        componentType: data.componentType,
        customFields: data.customFields,
        position: node.position,
      };
    }),
  edges: edges
    .filter((edge) => edge.source && edge.target)
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
    })),
});
