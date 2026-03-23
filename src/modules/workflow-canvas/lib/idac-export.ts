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
  const firewallRequests = extractFirewallRequests(edges, nodes);
  
  const systemConnections: IdaCSystemConnection[] = firewallRequests.map((req, index) => {
    const sourceZoneName = mapZoneIdToStandardName(req.sourceZone, nodes);
    const destZoneName = mapZoneIdToStandardName(req.destinationZone, nodes);
    const environment = getEnvironmentLabel(req.source, nodes);

    const sourceData = (req.source.data ?? {}) as Record<string, unknown>;
    const destData = (req.destination.data ?? {}) as Record<string, unknown>;
    const firewallData = (req.firewall.data ?? {}) as Record<string, unknown>;

    return {
      rowNumber: index + 1,
      sourceComponent: String(sourceData.label ?? "Unknown"),
      sourceTechnology: getComponentTechnology(req.source),
      sourceZone: sourceZoneName,
      sourceIP: String(sourceData.customFields?.["IP Address"] || sourceData.customFields?.["ip"] || ""),
      destComponent: String(destData.label ?? "Unknown"),
      destTechnology: getComponentTechnology(req.destination),
      destZone: destZoneName,
      destIP: String(destData.customFields?.["IP Address"] || destData.customFields?.["ip"] || ""),
      direction: "Unidirectional",
      protocol: String(sourceData.customFields?.["Protocol"] || "HTTPS"),
      ports: String(sourceData.customFields?.["Port"] || destData.customFields?.["Port"] || "443"),
      action: "Allow",
      isCommonService: "No",
      justification: `${String(sourceData.label)} in ${sourceZoneName} requires access to ${String(destData.label)} in ${destZoneName} for business operations.`,
      environment,
      applicationId: String(metadata?.applicationId || ""),
      dataClassification: "Confidential",
      encryptionRequired: sourceZoneName !== destZoneName ? "Yes" : "No",
      natTranslation: "",
      gateway: String(firewallData.label ?? "Firewall")
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
