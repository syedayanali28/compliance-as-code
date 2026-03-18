import type { Edge, Node } from "@xyflow/react";

export type ComponentCategory =
  | "environment"
  | "zone"
  | "control"
  | "database"
  | "backend"
  | "frontend"
  | "integration";

export interface CanvasComponentDef {
  componentKey: string;
  nodeType: string;
  label: string;
  category: ComponentCategory;
  description: string;
  zone?: string;
  componentType: string;
  parentComponentKey?: string;
  isZone?: boolean;
  isUnique?: boolean;
  defaultWidth?: number;
  defaultHeight?: number;
}

export interface CanvasValidationRule {
  policyId: string;
  sourceComponentKey: string;
  targetComponentKey: string;
  action: "allow" | "deny";
  reason: string;
  enabled: boolean;
}

export interface RuntimePolicyCatalog {
  components: CanvasComponentDef[];
  rules: CanvasValidationRule[];
}

export type ParentCategoryRequirement = "environment" | "zone" | null;

export const DEFAULT_COMPONENTS: CanvasComponentDef[] = [
  {
    componentKey: "environment-prod",
    nodeType: "environment-prod",
    label: "Production Environment",
    category: "environment",
    description: "Production MA environment.",
    componentType: "environment:prod",
    isZone: true,
    defaultWidth: 980,
    defaultHeight: 620,
  },
  {
    componentKey: "environment-pre",
    nodeType: "environment-pre",
    label: "Pre-Production Environment",
    category: "environment",
    description: "Pre-production MA environment.",
    componentType: "environment:pre",
    isZone: true,
    defaultWidth: 980,
    defaultHeight: 620,
  },
  {
    componentKey: "environment-uat",
    nodeType: "environment-uat",
    label: "UAT Environment",
    category: "environment",
    description: "UAT MA environment.",
    componentType: "environment:uat",
    isZone: true,
    defaultWidth: 980,
    defaultHeight: 620,
  },
  {
    componentKey: "environment-dev",
    nodeType: "environment-dev",
    label: "Development Environment",
    category: "environment",
    description: "Development MA environment.",
    componentType: "environment:dev",
    isZone: true,
    defaultWidth: 980,
    defaultHeight: 620,
  },
  {
    componentKey: "zone-public-network",
    nodeType: "zone-public-network",
    label: "Public Network Zone",
    category: "zone",
    description: "Public network zone inside MA.",
    zone: "public-network",
    componentType: "zone:public-network",
    isZone: true,
    defaultWidth: 300,
    defaultHeight: 240,
  },
  {
    componentKey: "zone-dmz",
    nodeType: "zone-dmz",
    label: "DMZ Zone",
    category: "zone",
    description: "DMZ network zone inside MA.",
    zone: "dmz",
    componentType: "zone:dmz",
    isZone: true,
    defaultWidth: 300,
    defaultHeight: 240,
  },
  {
    componentKey: "zone-private-network",
    nodeType: "zone-private-network",
    label: "Private Network Zone",
    category: "zone",
    description: "Private/Internal/OA network zone inside MA.",
    zone: "private-network",
    componentType: "zone:private-network",
    isZone: true,
    defaultWidth: 300,
    defaultHeight: 240,
  },
  {
    componentKey: "firewall-external-facing",
    nodeType: "control-firewall-external",
    label: "External Facing Firewall",
    category: "control",
    description: "Firewall between Public Network and DMZ.",
    componentType: "firewall:external-facing",
    isUnique: true,
  },
  {
    componentKey: "firewall-internal-facing",
    nodeType: "control-firewall-internal",
    label: "Internal Facing Firewall",
    category: "control",
    description: "Firewall between DMZ and Private Network.",
    componentType: "firewall:internal-facing",
    isUnique: true,
  },
  {
    componentKey: "database-postgres",
    nodeType: "database-postgres",
    label: "PostgreSQL",
    category: "database",
    description: "PostgreSQL database instance.",
    componentType: "database:postgres",
  },
  {
    componentKey: "database-mysql",
    nodeType: "database-mysql",
    label: "MySQL",
    category: "database",
    description: "MySQL database instance.",
    componentType: "database:mysql",
  },
  {
    componentKey: "backend-nodejs",
    nodeType: "backend-nodejs",
    label: "Node.js Service",
    category: "backend",
    description: "Node.js backend runtime.",
    componentType: "backend:nodejs",
  },
  {
    componentKey: "backend-fastapi",
    nodeType: "backend-fastapi",
    label: "FastAPI Service",
    category: "backend",
    description: "Python FastAPI backend.",
    componentType: "backend:fastapi",
  },
  {
    componentKey: "backend-flask",
    nodeType: "backend-flask",
    label: "Flask Service",
    category: "backend",
    description: "Python Flask backend.",
    componentType: "backend:flask",
  },
  {
    componentKey: "backend-dotnet",
    nodeType: "backend-dotnet",
    label: ".NET Service",
    category: "backend",
    description: "ASP.NET/.NET backend.",
    componentType: "backend:dotnet",
  },
  {
    componentKey: "frontend-nextjs",
    nodeType: "frontend-nextjs",
    label: "Next.js Frontend",
    category: "frontend",
    description: "Next.js web frontend.",
    componentType: "frontend:nextjs",
  },
  {
    componentKey: "frontend-gradio",
    nodeType: "frontend-gradio",
    label: "Gradio UI",
    category: "frontend",
    description: "Gradio-based interactive frontend.",
    componentType: "frontend:gradio",
  },
];

export const DEFAULT_RULES: CanvasValidationRule[] = [
  {
    policyId: "CVR-0001",
    sourceComponentKey: "zone-public-network",
    targetComponentKey: "firewall-external-facing",
    action: "allow",
    reason: "Public network traffic must enter through the external-facing firewall.",
    enabled: true,
  },
  {
    policyId: "CVR-0002",
    sourceComponentKey: "firewall-external-facing",
    targetComponentKey: "zone-dmz",
    action: "allow",
    reason: "External firewall may route traffic into DMZ.",
    enabled: true,
  },
  {
    policyId: "CVR-0003",
    sourceComponentKey: "zone-dmz",
    targetComponentKey: "firewall-internal-facing",
    action: "allow",
    reason: "DMZ to private network traffic must pass through internal-facing firewall.",
    enabled: true,
  },
  {
    policyId: "CVR-0004",
    sourceComponentKey: "firewall-internal-facing",
    targetComponentKey: "zone-private-network",
    action: "allow",
    reason: "Internal-facing firewall may route traffic into private network.",
    enabled: true,
  },
  {
    policyId: "CVR-0005",
    sourceComponentKey: "zone-public-network",
    targetComponentKey: "database-postgres",
    action: "deny",
    reason: "Public network must never connect directly to PostgreSQL.",
    enabled: true,
  },
  {
    policyId: "CVR-0006",
    sourceComponentKey: "zone-public-network",
    targetComponentKey: "database-mysql",
    action: "deny",
    reason: "Public network must never connect directly to MySQL.",
    enabled: true,
  },
];

export const createDefaultCatalog = (): RuntimePolicyCatalog => ({
  components: DEFAULT_COMPONENTS,
  rules: DEFAULT_RULES,
});

export const getComponentKeyFromNode = (node: Node): string => {
  const data = (node.data ?? {}) as Record<string, unknown>;
  return String(data.componentKey ?? "") || String(data.componentType ?? "") || String(node.type ?? "");
};

export const getNodeCategory = (
  node: Node,
  catalog: RuntimePolicyCatalog
): ComponentCategory | null => {
  const data = (node.data ?? {}) as Record<string, unknown>;
  if (typeof data.category === "string") {
    return data.category as ComponentCategory;
  }

  const component = catalog.components.find(
    (item) => item.componentKey === getComponentKeyFromNode(node)
  );

  return component?.category ?? null;
};

export const getRequiredParentCategory = (
  category: ComponentCategory | null
): ParentCategoryRequirement => {
  if (!category) {
    return null;
  }

  if (category === "zone") {
    return "environment";
  }

  if (category === "environment") {
    return null;
  }

  return "zone";
};

export const getRequiredParentCategoryForNode = (
  node: Node,
  catalog: RuntimePolicyCatalog
): ParentCategoryRequirement => {
  const category = getNodeCategory(node, catalog);
  const data = (node.data ?? {}) as Record<string, unknown>;
  if (data.standalone === true) {
    return null;
  }

  const componentType = String(data.componentType ?? "").toLowerCase();
  const componentKey = getComponentKeyFromNode(node).toLowerCase();
  const isFirewall = componentType.startsWith("firewall:") || componentKey.includes("firewall");

  if (isFirewall) {
    return "environment";
  }

  return getRequiredParentCategory(category);
};

export const canAssignParent = (
  child: Node,
  parent: Node,
  catalog: RuntimePolicyCatalog
): boolean => {
  const parentCategory = getNodeCategory(parent, catalog);
  const requiredParent = getRequiredParentCategoryForNode(child, catalog);

  if (!requiredParent) {
    return false;
  }

  return parentCategory === requiredParent;
};

export const isContainerNode = (node: Node, catalog: RuntimePolicyCatalog): boolean => {
  const category = getNodeCategory(node, catalog);
  return category === "environment" || category === "zone";
};

export const validateUniqueComponent = (
  nodes: Node[],
  componentKey: string,
  catalog: RuntimePolicyCatalog
): string | null => {
  const component = catalog.components.find((item) => item.componentKey === componentKey);
  if (!component?.isUnique) {
    return null;
  }

  const exists = nodes.some((node) => getComponentKeyFromNode(node) === componentKey);
  if (exists) {
    return `Only one ${component.label} is allowed in a canvas.`;
  }

  return null;
};

export const resolveNodeCatalog = (
  selector: string,
  catalog: RuntimePolicyCatalog
): CanvasComponentDef | undefined => {
  return catalog.components.find(
    (component) =>
      component.componentKey === selector || component.nodeType === selector
  );
};

export const getComponentFamily = (component: CanvasComponentDef): string => {
  const [family] = component.componentType.split(":");
  return family || component.category;
};

export const getComponentSubtype = (component: CanvasComponentDef): string => {
  const [, subtype] = component.componentType.split(":");
  return subtype || component.label;
};

export const findParentNodeByCategory = (
  nodes: Node[],
  category: ComponentCategory
): string | undefined => {
  return nodes.find((node) => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    return String(data.category ?? "") === category;
  })?.id;
};

export const validateConnectionByPolicies = (
  source: Node,
  target: Node,
  catalog: RuntimePolicyCatalog
): { allowed: boolean; reason?: string } => {
  const sourceKey = getComponentKeyFromNode(source);
  const targetKey = getComponentKeyFromNode(target);

  const enabledRules = catalog.rules.filter((rule) => rule.enabled);
  const forwardRules = enabledRules.filter(
    (rule) => rule.sourceComponentKey === sourceKey && rule.targetComponentKey === targetKey
  );
  const reverseRules = enabledRules.filter(
    (rule) => rule.sourceComponentKey === targetKey && rule.targetComponentKey === sourceKey
  );
  const matchingRules = [...forwardRules, ...reverseRules];

  const denied = matchingRules.find((rule) => rule.action === "deny");
  if (denied) {
    return { allowed: false, reason: `${denied.policyId}: ${denied.reason}` };
  }

  const sourceRules = enabledRules.filter((rule) => rule.sourceComponentKey === sourceKey);
  const targetRules = enabledRules.filter((rule) => rule.sourceComponentKey === targetKey);
  const hasDirectionalRules = sourceRules.length > 0 || targetRules.length > 0;

  if (hasDirectionalRules) {
    const allowedRule = matchingRules.find((rule) => rule.action === "allow");
    if (!allowedRule) {
      return {
        allowed: false,
        reason: `No policy allows ${sourceKey} to connect to ${targetKey}.`,
      };
    }
  }

  return { allowed: true };
};

export const toPolicyPayload = (catalog: RuntimePolicyCatalog) => {
  const mapByComponentKey = new Map(
    catalog.components.map((component) => [component.componentKey, component])
  );

  return catalog.components.map((component) => ({
    id: component.componentKey,
    label: component.label,
    nodeType: component.nodeType,
    category: component.category,
    data: {
      label: component.label,
      category: component.category,
      description: component.description,
      componentType: component.componentType,
      componentKey: component.componentKey,
      zone: component.zone,
      isZone: Boolean(component.isZone),
      parentComponentKey: component.parentComponentKey,
      defaultWidth: component.defaultWidth,
      defaultHeight: component.defaultHeight,
      componentFamily: getComponentFamily(component),
      componentSubtype: getComponentSubtype(component),
      parentNodeType: component.parentComponentKey
        ? mapByComponentKey.get(component.parentComponentKey)?.nodeType
        : undefined,
    },
  }));
};

export const isDirectPublicToDatabase = (edges: Edge[], nodes: Node[]) => {
  return edges.some((edge) => {
    const source = nodes.find((node) => node.id === edge.source);
    const target = nodes.find((node) => node.id === edge.target);

    if (!(source && target)) {
      return false;
    }

    const sourceKey = getComponentKeyFromNode(source);
    const targetKey = getComponentKeyFromNode(target);

    return (
      sourceKey === "zone-public-network" &&
      (targetKey === "database-postgres" || targetKey === "database-mysql")
    );
  });
};