import type { Edge, Node } from "@xyflow/react";

export interface FirewallDetermination {
  required: boolean;
  firewallType: "physical" | "virtual" | "none";
  provider: "NSX" | "PSO" | "AWS" | "none";
  reason: string;
}

export interface FirewallRequestRow {
  environment: string;
  sourceZone: string;
  sourceRegion: string;
  sourceCompute: string;
  sourceComponent: string;
  destZone: string;
  destRegion: string;
  destCompute: string;
  destComponent: string;
  firewallType: "physical" | "virtual" | "none";
  provider: "NSX" | "PSO" | "AWS" | "none";
  protocol: string;
  ports: string;
  direction: string;
  connectionType: string;
  originalEdgeId: string;
}

interface HierarchyInfo {
  zoneId?: string;
  zoneLabel?: string;
  zoneType?: string;
  regionId?: string;
  regionLabel?: string;
  environmentId?: string;
  environmentLabel?: string;
  computeId?: string;
  computeLabel?: string;
  computeType?: string;
}

/**
 * Walk up the parent chain to extract complete hierarchy information
 */
const getHierarchyInfo = (node: Node, allNodes: Node[]): HierarchyInfo => {
  const info: HierarchyInfo = {};
  let current: Node | undefined = node;

  while (current) {
    const data = (current.data ?? {}) as Record<string, unknown>;
    const category = String(data.category ?? "");
    
    if (category === "compute") {
      info.computeId = current.id;
      info.computeLabel = String(data.label ?? "");
      info.computeType = String(data.componentType ?? "");
    } else if (category === "environment") {
      info.environmentId = current.id;
      info.environmentLabel = String(data.label ?? "");
    } else if (category === "region") {
      info.regionId = current.id;
      info.regionLabel = String(data.label ?? "");
    } else if (category === "zone") {
      info.zoneId = current.id;
      info.zoneLabel = String(data.label ?? "");
      info.zoneType = String(data.componentType ?? "");
    }

    // Move up to parent
    if (current.parentId) {
      current = allNodes.find(n => n.id === current.parentId);
    } else {
      break;
    }
  }

  return info;
};

/**
 * Determine if a firewall is required and what type based on the hierarchy
 */
export const determineFirewallRequirement = (
  sourceNode: Node,
  targetNode: Node,
  allNodes: Node[]
): FirewallDetermination => {
  const sourceHierarchy = getHierarchyInfo(sourceNode, allNodes);
  const targetHierarchy = getHierarchyInfo(targetNode, allNodes);

  // If both components are in the same compute node, no firewall needed
  if (sourceHierarchy.computeId && sourceHierarchy.computeId === targetHierarchy.computeId) {
    return {
      required: false,
      firewallType: "none",
      provider: "none",
      reason: "Both components are in the same compute resource (intra-host communication).",
    };
  }

  // If zones are different, always physical firewall (NSX)
  if (sourceHierarchy.zoneId !== targetHierarchy.zoneId) {
    return {
      required: true,
      firewallType: "physical",
      provider: "NSX",
      reason: "Connection crosses zone boundary - physical firewall required.",
    };
  }

  // Same zone - check zone type and compute type
  const zoneType = sourceHierarchy.zoneType?.toLowerCase() || "";
  const sourceComputeType = sourceHierarchy.computeType?.toLowerCase() || "";
  const targetComputeType = targetHierarchy.computeType?.toLowerCase() || "";

  // OA Baremetal: Always physical firewall, even baremetal-to-baremetal
  if (zoneType.includes("oa-baremetal")) {
    return {
      required: true,
      firewallType: "physical",
      provider: "NSX",
      reason: "OA Baremetal zone - physical firewall required for all connections.",
    };
  }

  // OA Private Cloud: Virtual firewall if both are VMs (micro-segmentation)
  if (zoneType.includes("oa-private-cloud")) {
    if (sourceComputeType.includes("vm") && targetComputeType.includes("vm")) {
      return {
        required: true,
        firewallType: "virtual",
        provider: "PSO",
        reason: "OA Private Cloud VM-to-VM - virtual firewall (micro-segmentation) required.",
      };
    } else {
      return {
        required: true,
        firewallType: "physical",
        provider: "NSX",
        reason: "OA Private Cloud with non-VM compute - physical firewall required.",
      };
    }
  }

  // AWS Landing Zone: Virtual firewall
  if (zoneType.includes("aws-landing-zone")) {
    return {
      required: true,
      firewallType: "virtual",
      provider: "AWS",
      reason: "AWS Landing Zone - AWS virtual firewall required.",
    };
  }

  // OA App DMZ: Physical firewall
  if (zoneType.includes("oa-app-dmz")) {
    return {
      required: true,
      firewallType: "physical",
      provider: "NSX",
      reason: "OA App DMZ - physical firewall required.",
    };
  }

  // DMZ: Physical firewall
  if (zoneType.includes("dmz")) {
    return {
      required: true,
      firewallType: "physical",
      provider: "NSX",
      reason: "DMZ - physical firewall required.",
    };
  }

  // Default: physical firewall for safety
  return {
    required: true,
    firewallType: "physical",
    provider: "NSX",
    reason: "Default physical firewall required for cross-compute connections.",
  };
};

/**
 * Extract all firewall requests from the graph by analyzing component-to-component connections
 */
export const extractFirewallRequests = (
  nodes: Node[],
  edges: Edge[]
): FirewallRequestRow[] => {
  const requests: FirewallRequestRow[] = [];

  for (const edge of edges) {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);

    if (!source || !target) continue;

    // Skip container nodes (zones, regions, environments, compute)
    const sourceData = (source.data ?? {}) as Record<string, unknown>;
    const targetData = (target.data ?? {}) as Record<string, unknown>;
    const sourceCategory = String(sourceData.category ?? "");
    const targetCategory = String(targetData.category ?? "");

    const containerCategories = ["zone", "region", "environment", "compute"];
    if (containerCategories.includes(sourceCategory) || containerCategories.includes(targetCategory)) {
      continue;
    }

    // Get hierarchy info for both endpoints
    const sourceHierarchy = getHierarchyInfo(source, nodes);
    const targetHierarchy = getHierarchyInfo(target, nodes);

    // Determine firewall requirement
    const firewallDetermination = determineFirewallRequirement(source, target, nodes);

    // Only include in requests if firewall is required
    if (!firewallDetermination.required) {
      continue;
    }

    const edgeData = (edge.data ?? {}) as Record<string, unknown>;
    const customFields = (edgeData.customFields ?? {}) as Record<string, string>;

    requests.push({
      environment: sourceHierarchy.environmentLabel || targetHierarchy.environmentLabel || "Production",
      sourceZone: sourceHierarchy.zoneLabel || "Unknown Zone",
      sourceRegion: sourceHierarchy.regionLabel || "Unknown Region",
      sourceCompute: sourceHierarchy.computeLabel || "Unknown Compute",
      sourceComponent: String(sourceData.label || source.id),
      destZone: targetHierarchy.zoneLabel || "Unknown Zone",
      destRegion: targetHierarchy.regionLabel || "Unknown Region",
      destCompute: targetHierarchy.computeLabel || "Unknown Compute",
      destComponent: String(targetData.label || target.id),
      firewallType: firewallDetermination.firewallType,
      provider: firewallDetermination.provider,
      protocol: customFields["Protocol"] || (sourceData.customFields as any)?.[" Protocol"] || (targetData.customFields as any)?.["Protocol"] || "HTTPS",
      ports: customFields["Port"] || (sourceData.customFields as any)?.["Port"] || (targetData.customFields as any)?.["Port"] || "443",
      direction: "Outbound",
      connectionType: "firewall-request",
      originalEdgeId: edge.id
    });
  }

  return requests;
};
