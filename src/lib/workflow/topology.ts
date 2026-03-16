import type { Edge, Node } from "@xyflow/react";

export type WorkflowNodeCategory =
  | "environment"
  | "zone"
  | "control"
  | "resource";

export type WorkflowZone = "internet" | "dmz" | "intranet";

export interface WorkflowNodeData {
  label: string;
  category: WorkflowNodeCategory;
  zone?: WorkflowZone;
  description?: string;
  componentType?: string;
}

export interface WorkflowTopologyNode {
  id: string;
  type: string;
  data: WorkflowNodeData;
  position: {
    x: number;
    y: number;
  };
}

export interface WorkflowTopologyEdge {
  id: string;
  source: string;
  target: string;
}

export interface WorkflowTopology {
  version: "1.0";
  nodes: WorkflowTopologyNode[];
  edges: WorkflowTopologyEdge[];
}

export const WORKFLOW_NODE_CATALOG = [
  {
    id: "environment",
    label: "Environment",
    data: {
      label: "Environment",
      category: "environment",
      componentType: "environment",
    } satisfies WorkflowNodeData,
  },
  {
    id: "zone-internet",
    label: "Zone: Internet",
    data: {
      label: "Internet Zone",
      category: "zone",
      zone: "internet",
      componentType: "network-zone",
    } satisfies WorkflowNodeData,
  },
  {
    id: "zone-dmz",
    label: "Zone: DMZ",
    data: {
      label: "DMZ Zone",
      category: "zone",
      zone: "dmz",
      componentType: "network-zone",
    } satisfies WorkflowNodeData,
  },
  {
    id: "zone-intranet",
    label: "Zone: Intranet",
    data: {
      label: "Intranet Zone",
      category: "zone",
      zone: "intranet",
      componentType: "network-zone",
    } satisfies WorkflowNodeData,
  },
  {
    id: "control-firewall",
    label: "Control: Firewall",
    data: {
      label: "Firewall",
      category: "control",
      componentType: "firewall",
    } satisfies WorkflowNodeData,
  },
  {
    id: "control-proxy",
    label: "Control: Proxy",
    data: {
      label: "Proxy",
      category: "control",
      componentType: "proxy",
    } satisfies WorkflowNodeData,
  },
  {
    id: "resource-app",
    label: "Resource: App",
    data: {
      label: "Application",
      category: "resource",
      componentType: "application",
    } satisfies WorkflowNodeData,
  },
  {
    id: "resource-db",
    label: "Resource: DB",
    data: {
      label: "Database",
      category: "resource",
      componentType: "database",
    } satisfies WorkflowNodeData,
  },
] as const;

const CATEGORY_ORDER: Record<WorkflowNodeCategory, number> = {
  environment: 0,
  zone: 1,
  control: 2,
  resource: 3,
};

export const canNodeBeSource = (data?: WorkflowNodeData) =>
  data ? data.category !== "resource" : true;

export const isValidWorkflowConnection = (source: Node, target: Node) => {
  const sourceData = source.data as WorkflowNodeData | undefined;
  const targetData = target.data as WorkflowNodeData | undefined;

  if (!(sourceData && targetData)) {
    return true;
  }

  const sourceLevel = CATEGORY_ORDER[sourceData.category];
  const targetLevel = CATEGORY_ORDER[targetData.category];

  if (targetLevel !== sourceLevel + 1) {
    return false;
  }

  if (
    sourceData.category === "zone" &&
    targetData.zone &&
    sourceData.zone &&
    sourceData.zone !== targetData.zone
  ) {
    return false;
  }

  if (
    sourceData.category === "control" &&
    sourceData.zone &&
    targetData.zone &&
    sourceData.zone !== targetData.zone
  ) {
    return false;
  }

  return true;
};

export const toWorkflowTopology = (
  nodes: Node[],
  edges: Edge[]
): WorkflowTopology => ({
  version: "1.0",
  nodes: nodes.map((node) => ({
    id: node.id,
    type: node.type ?? "custom",
    data: node.data as WorkflowNodeData,
    position: node.position,
  })),
  edges: edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  })),
});