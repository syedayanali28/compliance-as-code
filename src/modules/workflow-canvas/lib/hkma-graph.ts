import type { Edge, Node } from "@xyflow/react";

export type HkmaNodeCategory =
  | "environment"
  | "zone"
  | "control"
  | "resource"
  | "backend"
  | "frontend"
  | "database"
  | "integration";

export type HkmaZone =
  | "dmz"
  | "oa"
  | "internet"
  | "public-network"
  | "private-network"
  | "internal-network"
  | "aws-private-cloud";

export interface HkmaNodeData {
  label: string;
  category: HkmaNodeCategory;
  description?: string;
  zone?: HkmaZone;
  componentType?: string;
  environmentId?: string;
  environmentLabel?: string;
  zoneId?: string;
  zoneLabel?: string;
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
  environment: { category: "environment", source: true },
  "environment-box": { category: "environment", source: true },
  "environment-prod": { category: "environment", source: true },
  "environment-pre": { category: "environment", source: true },
  "environment-uat": { category: "environment", source: true },
  "environment-dev": { category: "environment", source: true },
  "zone-public": { category: "zone", source: true },
  "zone-box": { category: "zone", source: true },
  "zone-public-network": { category: "zone", source: true },
  "zone-private-network": { category: "zone", source: true },
  "zone-internal": { category: "zone", source: true },
  "zone-aws-private-cloud": { category: "zone", source: true },
  "zone-dmz": { category: "zone", source: true },
  "zone-oa": { category: "zone", source: true },
  "zone-internet": { category: "zone", source: true },
  "control-firewall": { category: "control", source: true },
  "control-proxy": { category: "control", source: true },
  "control-firewall-external": { category: "control", source: true },
  "control-firewall-internal": { category: "control", source: true },
  "control-proxy-public": { category: "control", source: true },
  "control-proxy-internal": { category: "control", source: true },
  "resource-app": { category: "resource", source: true, target: true },
  "resource-db": { category: "resource", source: true, target: true },
  "database-postgres": { category: "database", source: true, target: true },
  "database-mysql": { category: "database", source: true, target: true },
  "backend-nodejs": { category: "backend", source: true },
  "backend-fastapi": { category: "backend", source: true },
  "backend-flask": { category: "backend", source: true },
  "backend-dotnet": { category: "backend", source: true },
  "frontend-nextjs": { category: "frontend", source: true },
  "frontend-gradio": { category: "frontend", source: true },
};

const CATEGORY_ORDER: Record<HkmaNodeCategory, number> = {
  environment: 0,
  zone: 1,
  control: 2,
  resource: 3,
  frontend: 3,
  backend: 4,
  database: 5,
  integration: 6,
};

export const isHkmaNodeType = (type?: string | null): type is string =>
  Boolean(type && HKMA_NODE_DEFS[type]);

export const getHkmaCategory = (type?: string | null): HkmaNodeCategory | null => {
  if (!type || !HKMA_NODE_DEFS[type]) {
    return null;
  }

  return HKMA_NODE_DEFS[type].category;
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
