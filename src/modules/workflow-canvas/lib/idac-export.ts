import type { Edge, Node } from "@xyflow/react";
import { extractFirewallRequests, type FirewallRequest } from "./firewall-requests";

export interface IdaCSystemConnection {
  rowNumber: number;
  sourceComponent: string;
  sourceTechnology: string;
  sourceZone: string;
  sourceIP: string;
  destComponent: string;
  destTechnology: string;
  destZone: string;
  destIP: string;
  direction: string;
  protocol: string;
  ports: string;
  action: string;
  isCommonService: string;
  justification: string;
  environment: string;
  applicationId: string;
  dataClassification: string;
  encryptionRequired: string;
  natTranslation: string;
  gateway: string;
}

export interface IdaCCommonService {
  serviceName: string;
  protocol: string;
  ports: string;
  destination: string;
  description: string;
}

export interface IdaCMetadata {
  projectName: string;
  applicationId: string;
  businessUnit: string;
  contactPerson: string;
  contactEmail: string;
  [key: string]: string;
}

export interface IdaCExport {
  systemConnections: IdaCSystemConnection[];
  commonServices: IdaCCommonService[];
  metadata: IdaCMetadata;
}

/**
 * Maps zone ID to standard zone name for IdAC
 */
const mapZoneIdToStandardName = (zoneId: string, nodes: Node[]): string => {
  const zoneNode = nodes.find(n => n.id === zoneId);
  if (!zoneNode) return "Unknown";

  const data = (zoneNode.data ?? {}) as Record<string, unknown>;
  const zone = String(data.zone ?? "");
  
  // Map internal zone names to IdAC standard names
  const zoneMap: Record<string, string> = {
    "public-network": "Internet",
    "internet": "Internet",
    "dmz": "DMZ",
    "private-network": "Intranet",
    "internal-network": "Intranet",
    "oa": "Intranet",
    "aws-private-cloud": "Intranet"
  };

  return zoneMap[zone] || "Intranet";
};

/**
 * Gets component technology/type
 */
const getComponentTechnology = (node: Node): string => {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const componentType = String(data.componentType ?? "");
  const category = String(data.category ?? "");

  if (componentType) {
    // "backend:nodejs" → "Node.js Backend"
    const [family, subtype] = componentType.split(":");
    if (subtype) {
      const familyName = family.charAt(0).toUpperCase() + family.slice(1);
      const subtypeName = subtype
        .split("-")
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      return `${subtypeName} ${familyName}`;
    }
  }

  return category.charAt(0).toUpperCase() + category.slice(1);
};

/**
 * Get the zone ID where a component resides
 */
const getComponentZoneId = (component: Node, allNodes: Node[]): string | undefined => {
  if (!component.parentId) {
    return undefined;
  }

  const parent = allNodes.find(n => n.id === component.parentId);
  if (!parent) {
    return undefined;
  }

  const parentData = (parent.data ?? {}) as Record<string, unknown>;
  const parentCategory = String(parentData.category ?? "");

  if (parentCategory === "zone") {
    return parent.id;
  }

  return undefined;
};

/**
 * Get the environment label from a node's context
 */
const getEnvironmentLabel = (node: Node, allNodes: Node[]): string => {
  const data = (node.data ?? {}) as Record<string, unknown>;
  
  // Check direct data
  if (data.environmentLabel && typeof data.environmentLabel === "string") {
    return data.environmentLabel;
  }

  // Traverse up to find environment
  let current: Node | undefined = node;
  while (current) {
    const currentData = (current.data ?? {}) as Record<string, unknown>;
    if (String(currentData.category) === "environment") {
      return String(currentData.label ?? "Production");
    }
    
    if (!current.parentId) break;
    current = allNodes.find(n => n.id === current.parentId);
  }

  return "Production";
};

/**
 * Converts canvas graph to IdAC export format
 */
export const toIdaCExport = (
  edges: Edge[],
  nodes: Node[],
  metadata?: Partial<IdaCMetadata>
): IdaCExport => {
  const firewallRequests = extractFirewallRequests(nodes, edges);
  
  const systemConnections: IdaCSystemConnection[] = firewallRequests.map((req, index) => {
    return {
      rowNumber: index + 1,
      sourceComponent: req.sourceComponent,
      sourceTechnology: req.sourceComponent, // Could be enhanced with actual tech detection
      sourceZone: req.sourceZone,
      sourceIP: "", // Could be extracted from customFields if needed
      destComponent: req.destComponent,
      destTechnology: req.destComponent, // Could be enhanced with actual tech detection
      destZone: req.destZone,
      destIP: "", // Could be extracted from customFields if needed
      direction: req.direction,
      protocol: req.protocol,
      ports: req.ports,
      action: "Allow",
      isCommonService: "No",
      justification: `${req.sourceComponent} in ${req.sourceZone} requires access to ${req.destComponent} in ${req.destZone} for business operations. Firewall type: ${req.firewallType} (${req.provider})`,
      environment: req.environment,
      applicationId: String(metadata?.applicationId || ""),
      dataClassification: "Confidential",
      encryptionRequired: req.sourceZone !== req.destZone ? "Yes" : "No",
      natTranslation: "",
      gateway: `${req.provider} ${req.firewallType} Firewall`
    };
  });

  const commonServices: IdaCCommonService[] = [];

  const idacMetadata: IdaCMetadata = {
    projectName: metadata?.projectName || "Infrastructure as Code Design",
    applicationId: metadata?.applicationId || "",
    businessUnit: metadata?.businessUnit || "",
    contactPerson: metadata?.contactPerson || "",
    contactEmail: metadata?.contactEmail || "",
    ...metadata
  };

  return {
    systemConnections,
    commonServices,
    metadata: idacMetadata
  };
};
