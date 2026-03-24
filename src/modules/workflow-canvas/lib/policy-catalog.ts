import type { Edge, Node } from "@xyflow/react";

export type ComponentCategory =
  | "zone"
  | "region"
  | "environment"
  | "compute"
  | "database"
  | "backend"
  | "frontend"
  | "integration"
  | "iam"
  | "orchestration"
  | "ai"
  | "security"
  | "monitoring"
  | "storage"
  | "cicd";

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

export type ParentCategoryRequirement = "zone" | "region" | "environment" | "compute" | null;

/** Resize floor for containers (NodeResizer); default spawn size adds CONTAINER_DEFAULT_BUMP. */
export const CONTAINER_MIN_DIMENSIONS = {
  zone: { width: 600, height: 400 },
  region: { width: 500, height: 350 },
  environment: { width: 400, height: 275 },
  compute: { width: 100, height: 100 },
} as const;

const CONTAINER_DEFAULT_BUMP = { width: 40, height: 30 };

export const DEFAULT_COMPONENTS: CanvasComponentDef[] = [
  // =====================================================================
  // ZONES (top-level containers)
  // =====================================================================
  {
    componentKey: "zone-oa-baremetal",
    nodeType: "zone-oa-baremetal",
    label: "OA Network - Baremetal",
    category: "zone",
    description: "OA network zone for baremetal servers.",
    zone: "oa-baremetal",
    componentType: "zone:oa-baremetal",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.zone.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.zone.height + CONTAINER_DEFAULT_BUMP.height,
  },
  {
    componentKey: "zone-oa-private-cloud",
    nodeType: "zone-oa-private-cloud",
    label: "OA Network - Private Cloud",
    category: "zone",
    description: "OA network zone for private cloud VMs with virtual firewall.",
    zone: "oa-private-cloud",
    componentType: "zone:oa-private-cloud",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.zone.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.zone.height + CONTAINER_DEFAULT_BUMP.height,
  },
  {
    componentKey: "zone-oa-app-dmz",
    nodeType: "zone-oa-app-dmz",
    label: "OA Network - App DMZ",
    category: "zone",
    description: "OA network zone for application DMZ.",
    zone: "oa-app-dmz",
    componentType: "zone:oa-app-dmz",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.zone.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.zone.height + CONTAINER_DEFAULT_BUMP.height,
  },
  {
    componentKey: "zone-dmz",
    nodeType: "zone-dmz",
    label: "DMZ",
    category: "zone",
    description: "DMZ network zone.",
    zone: "dmz",
    componentType: "zone:dmz",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.zone.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.zone.height + CONTAINER_DEFAULT_BUMP.height,
  },
  {
    componentKey: "zone-aws-landing-zone",
    nodeType: "zone-aws-landing-zone",
    label: "AWS Landing Zone",
    category: "zone",
    description: "AWS landing zone with virtual firewall.",
    zone: "aws-landing-zone",
    componentType: "zone:aws-landing-zone",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.zone.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.zone.height + CONTAINER_DEFAULT_BUMP.height,
  },
  
  // =====================================================================
  // REGIONS
  // =====================================================================
  {
    componentKey: "region-ifc",
    nodeType: "region-ifc",
    label: "IFC",
    category: "region",
    description: "IFC office location.",
    componentType: "region:ifc",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.region.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.region.height + CONTAINER_DEFAULT_BUMP.height,
  },
  {
    componentKey: "region-kcc",
    nodeType: "region-kcc",
    label: "KCC",
    category: "region",
    description: "KCC office location.",
    componentType: "region:kcc",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.region.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.region.height + CONTAINER_DEFAULT_BUMP.height,
  },
  
  // =====================================================================
  // ENVIRONMENTS
  // =====================================================================
  {
    componentKey: "environment-prod",
    nodeType: "environment-prod",
    label: "Production Environment",
    category: "environment",
    description: "Production MA environment.",
    componentType: "environment:prod",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.environment.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.environment.height +
      CONTAINER_DEFAULT_BUMP.height,
  },
  {
    componentKey: "environment-pre",
    nodeType: "environment-pre",
    label: "Pre-Production Environment",
    category: "environment",
    description: "Pre-production MA environment.",
    componentType: "environment:pre",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.environment.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.environment.height +
      CONTAINER_DEFAULT_BUMP.height,
  },
  {
    componentKey: "environment-uat",
    nodeType: "environment-uat",
    label: "UAT Environment",
    category: "environment",
    description: "UAT MA environment.",
    componentType: "environment:uat",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.environment.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.environment.height +
      CONTAINER_DEFAULT_BUMP.height,
  },
  {
    componentKey: "environment-dev",
    nodeType: "environment-dev",
    label: "Development Environment",
    category: "environment",
    description: "Development MA environment.",
    componentType: "environment:dev",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.environment.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.environment.height +
      CONTAINER_DEFAULT_BUMP.height,
  },
  {
    componentKey: "environment-dr",
    nodeType: "environment-dr",
    label: "Disaster Recovery Environment",
    category: "environment",
    description: "Disaster recovery MA environment.",
    componentType: "environment:dr",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.environment.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.environment.height +
      CONTAINER_DEFAULT_BUMP.height,
  },
  
  // =====================================================================
  // COMPUTE RESOURCES
  // =====================================================================
  {
    componentKey: "compute-vm",
    nodeType: "compute-vm",
    label: "Virtual Machine",
    category: "compute",
    description: "Virtual machine compute resource.",
    componentType: "compute:vm",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.compute.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.compute.height + CONTAINER_DEFAULT_BUMP.height,
  },
  {
    componentKey: "compute-k8s",
    nodeType: "compute-k8s",
    label: "Kubernetes Box",
    category: "compute",
    description: "Kubernetes cluster compute resource.",
    componentType: "compute:k8s",
    isZone: true,
    defaultWidth:
      CONTAINER_MIN_DIMENSIONS.compute.width + CONTAINER_DEFAULT_BUMP.width,
    defaultHeight:
      CONTAINER_MIN_DIMENSIONS.compute.height + CONTAINER_DEFAULT_BUMP.height,
  },
  
  // =====================================================================
  // DATABASES
  // =====================================================================
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
    componentKey: "data-dremio",
    nodeType: "data-dremio",
    label: "Dremio",
    category: "database",
    description: "Dremio data lakehouse platform.",
    componentType: "database:dremio",
  },
  
  // =====================================================================
  // BACKEND
  // =====================================================================
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
    componentKey: "backend-express",
    nodeType: "backend-express",
    label: "Express JS",
    category: "backend",
    description: "Express.js backend framework.",
    componentType: "backend:express",
  },
  {
    componentKey: "backend-drizzle-orm",
    nodeType: "backend-drizzle-orm",
    label: "Drizzle ORM",
    category: "backend",
    description: "TypeScript ORM for SQL databases.",
    componentType: "backend:drizzle-orm",
  },
  {
    componentKey: "container-docker",
    nodeType: "container-docker",
    label: "Docker",
    category: "backend",
    description: "Docker containerization platform.",
    componentType: "backend:docker",
  },
  
  // =====================================================================
  // FRONTEND
  // =====================================================================
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
  {
    componentKey: "frontend-axios",
    nodeType: "frontend-axios",
    label: "Axios",
    category: "frontend",
    description: "HTTP client library for frontend.",
    componentType: "frontend:axios",
  },
  
  // =====================================================================
  // IAM
  // =====================================================================
  {
    componentKey: "iam-active-directory",
    nodeType: "iam-active-directory",
    label: "Active Directory (HKMA ADFS)",
    category: "iam",
    description: "HKMA Active Directory Federation Services.",
    componentType: "iam:active-directory",
  },
  
  // =====================================================================
  // ORCHESTRATION
  // =====================================================================
  {
    componentKey: "orchestration-kubernetes",
    nodeType: "orchestration-kubernetes",
    label: "Kubernetes",
    category: "orchestration",
    description: "Kubernetes container orchestration platform.",
    componentType: "orchestration:kubernetes",
  },
  
  // =====================================================================
  // AI/ML
  // =====================================================================
  {
    componentKey: "ai-maas-genai",
    nodeType: "ai-maas-genai",
    label: "MaaS GenAI",
    category: "ai",
    description: "Model-as-a-Service Generative AI platform.",
    componentType: "ai:maas-genai",
  },
  {
    componentKey: "ai-rayserve",
    nodeType: "ai-rayserve",
    label: "RayServe",
    category: "ai",
    description: "Ray Serve ML model serving.",
    componentType: "ai:rayserve",
  },
  {
    componentKey: "ai-dify",
    nodeType: "ai-dify",
    label: "Dify",
    category: "ai",
    description: "Dify LLM application platform.",
    componentType: "ai:dify",
  },
  
  // =====================================================================
  // SECURITY
  // =====================================================================
  {
    componentKey: "security-siem",
    nodeType: "security-siem",
    label: "SIEM",
    category: "security",
    description: "Security Information and Event Management system.",
    componentType: "security:siem",
  },
  {
    componentKey: "security-edr",
    nodeType: "security-edr",
    label: "EDR (Windows Environment)",
    category: "security",
    description: "Endpoint Detection and Response for Windows.",
    componentType: "security:edr",
  },
  
  // =====================================================================
  // MONITORING
  // =====================================================================
  {
    componentKey: "monitoring-grafana",
    nodeType: "monitoring-grafana",
    label: "Grafana",
    category: "monitoring",
    description: "Grafana monitoring and observability platform.",
    componentType: "monitoring:grafana",
  },
  
  // =====================================================================
  // STORAGE
  // =====================================================================
  {
    componentKey: "storage-pure-storage",
    nodeType: "storage-pure-storage",
    label: "Pure Storage",
    category: "storage",
    description: "Pure Storage flash storage system.",
    componentType: "storage:pure-storage",
  },
  {
    componentKey: "storage-filecloud",
    nodeType: "storage-filecloud",
    label: "Filecloud",
    category: "storage",
    description: "Filecloud file storage and sharing.",
    componentType: "storage:filecloud",
  },
  
  // =====================================================================
  // CI/CD
  // =====================================================================
  {
    componentKey: "cicd-harbor",
    nodeType: "cicd-harbor",
    label: "Harbor",
    category: "cicd",
    description: "Harbor container registry.",
    componentType: "cicd:harbor",
  },
  {
    componentKey: "cicd-jenkins",
    nodeType: "cicd-jenkins",
    label: "Jenkins",
    category: "cicd",
    description: "Jenkins automation server.",
    componentType: "cicd:jenkins",
  },
  {
    componentKey: "cicd-ansible",
    nodeType: "cicd-ansible",
    label: "Ansible",
    category: "cicd",
    description: "Ansible automation platform.",
    componentType: "cicd:ansible",
  },
  {
    componentKey: "cicd-sonarqube",
    nodeType: "cicd-sonarqube",
    label: "SonarQube",
    category: "cicd",
    description: "SonarQube code quality platform.",
    componentType: "cicd:sonarqube",
  },
  {
    componentKey: "cicd-gitlab",
    nodeType: "cicd-gitlab",
    label: "GitLab",
    category: "cicd",
    description: "GitLab DevOps platform.",
    componentType: "cicd:gitlab",
  },
  
  // =====================================================================
  // INTEGRATION / EXTERNAL
  // =====================================================================
  {
    componentKey: "issue-tracking-jira",
    nodeType: "issue-tracking-jira",
    label: "Jira",
    category: "integration",
    description: "Atlassian Jira issue tracking system.",
    componentType: "integration:jira",
  },
  {
    componentKey: "bi-tableau",
    nodeType: "bi-tableau",
    label: "Tableau",
    category: "integration",
    description: "Tableau business intelligence platform.",
    componentType: "integration:tableau",
  },
  {
    componentKey: "external-lseg-api",
    nodeType: "external-lseg-api",
    label: "LSEG API Endpoint",
    category: "integration",
    description: "London Stock Exchange Group API endpoint.",
    componentType: "integration:lseg-api",
  },
];

export const DEFAULT_RULES: CanvasValidationRule[] = [
  // No validation rules needed - firewall logic is now auto-determined based on hierarchy
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

  // New hierarchy: Zone > Region > Environment > Compute > Tech Component
  if (category === "zone") {
    return null; // Zone is top-level
  }

  if (category === "region") {
    return "zone";
  }

  if (category === "environment") {
    return "region";
  }

  if (category === "compute") {
    return "environment";
  }

  // All tech components go inside compute
  return "compute";
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
  return category === "zone" || category === "region" || category === "environment" || category === "compute";
};

export const validateUniqueComponent = (
  nodes: Node[],
  componentKey: string,
  catalog: RuntimePolicyCatalog,
  parentEnvironmentId?: string
): string | null => {
  const component = catalog.components.find((item) => item.componentKey === componentKey);
  if (!component?.isUnique) {
    return null;
  }

  // Check if component already exists in the canvas
  const exists = nodes.some((node) => getComponentKeyFromNode(node) === componentKey);
  if (exists) {
    return `Only one ${component.label} is allowed per canvas.`;
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
  const matches = nodes.filter((node) => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    return String(data.category ?? "") === category;
  });

  const selected = matches.find((node) => node.selected);
  if (selected) {
    return selected.id;
  }

  return matches[0]?.id;
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