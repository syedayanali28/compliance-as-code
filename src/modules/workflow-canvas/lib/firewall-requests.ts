import type { Edge, Node } from "@xyflow/react";
import { isFirewallNode } from "@/modules/workflow-canvas/lib/hkma-graph";

export interface FirewallRequest {
  source: Node;
  firewall: Node;
  destination: Node;
  sourceZone: string;
  destinationZone: string;
}

export interface FirewallRequestRow {
  environment: string;
  firewallComponent: string;
  firewallType: string;
  sourceComponent: string;
  sourceZone: string;
  destComponent: string;
  destZone: string;
  protocol: string;
  ports: string;
  direction: string;
  connectionType: string;
  originalEdgeId: string;
}

/**
 * Get the zone ID where a component resides (from its parent zone node)
 */
const getComponentZoneId = (component: Node, allNodes: Node[]): string | undefined => {
  if (!component.parentId) {
    return undefined;
  }

  // Check if parent is a zone
  const parent = allNodes.find(n => n.id === component.parentId);
  if (!parent) {
    return undefined;
  }

  const parentData = (parent.data ?? {}) as Record<string, unknown>;
  const parentCategory = String(parentData.category ?? "");

  if (parentCategory === "zone") {
    return parent.id;
  }

  // If parent is environment, component might not have a zone (like firewalls)
  return undefined;
};

/**
 * Checks if an edge completes a valid firewall transit:
 * Component A (zone 1) → Firewall → Component B (zone 2)
 * where zone 1 ≠ zone 2
 */
export const validateFirewallTransit = (
  newEdge: { source: string; target: string },
  allEdges: Edge[],
  allNodes: Node[]
): { valid: boolean; message?: string; firewallRequest?: FirewallRequest } => {
  const sourceNode = allNodes.find(n => n.id === newEdge.source);
  const targetNode = allNodes.find(n => n.id === newEdge.target);

  if (!sourceNode || !targetNode) {
    return { valid: false, message: "Source or target node not found" };
  }

  const sourceIsFirewall = isFirewallNode(sourceNode);
  const targetIsFirewall = isFirewallNode(targetNode);

  // If neither endpoint is a firewall, this is not a firewall connection
  if (!sourceIsFirewall && !targetIsFirewall) {
    return { valid: true };
  }

  // Case 1: Component → Firewall (incomplete, needs onward connection)
  if (!sourceIsFirewall && targetIsFirewall) {
    // Check if firewall already has an outgoing connection to another component
    const firewallOutgoing = allEdges.find(
      e => e.source === targetNode.id && e.target !== sourceNode.id
    );

    if (!firewallOutgoing) {
      // Incomplete: Allow but warn that it needs onward connection
      return {
        valid: true,
        message: "Firewall connection incomplete. Connect the firewall to a destination component in a different zone."
      };
    }

    // Check if the onward connection goes to a different zone
    const destinationNode = allNodes.find(n => n.id === firewallOutgoing.target);
    if (!destinationNode || isFirewallNode(destinationNode)) {
      return { valid: false, message: "Firewall must connect to a component, not another firewall" };
    }

    const sourceZone = getComponentZoneId(sourceNode, allNodes);
    const destZone = getComponentZoneId(destinationNode, allNodes);

    if (!sourceZone || !destZone) {
      return { valid: false, message: "Components must be inside zones to use firewall transit" };
    }

    if (sourceZone === destZone) {
      return { valid: false, message: "Firewall transit requires source and destination in DIFFERENT zones" };
    }

    return {
      valid: true,
      firewallRequest: {
        source: sourceNode,
        firewall: targetNode,
        destination: destinationNode,
        sourceZone,
        destinationZone: destZone
      }
    };
  }

  // Case 2: Firewall → Component (completing transit)
  if (sourceIsFirewall && !targetIsFirewall) {
    // Check if firewall has an incoming connection from a component
    const firewallIncoming = allEdges.find(
      e => e.target === sourceNode.id && e.source !== targetNode.id
    );

    if (!firewallIncoming) {
      // Incomplete: Allow but warn
      return {
        valid: true,
        message: "Firewall connection incomplete. A source component must connect to the firewall first."
      };
    }

    const originNode = allNodes.find(n => n.id === firewallIncoming.source);
    if (!originNode || isFirewallNode(originNode)) {
      return { valid: false, message: "Firewall must connect from a component, not another firewall" };
    }

    const originZone = getComponentZoneId(originNode, allNodes);
    const destZone = getComponentZoneId(targetNode, allNodes);

    if (!originZone || !destZone) {
      return { valid: false, message: "Components must be inside zones to use firewall transit" };
    }

    if (originZone === destZone) {
      return { valid: false, message: "Firewall transit requires source and destination in DIFFERENT zones" };
    }

    return {
      valid: true,
      firewallRequest: {
        source: originNode,
        firewall: sourceNode,
        destination: targetNode,
        sourceZone: originZone,
        destinationZone: destZone
      }
    };
  }

  return { valid: true };
};

/**
 * Finds all complete firewall requests in the graph and returns them in the format needed for export
 */
export const extractFirewallRequests = (
  nodes: Node[],
  edges: Edge[]
): FirewallRequestRow[] => {
  const requests: FirewallRequestRow[] = [];
  const processed = new Set<string>();

  for (const edge of edges) {
    const source = nodes.find(n => n.id === edge.source);
    const target = nodes.find(n => n.id === edge.target);

    if (!source || !target) continue;

    // Look for pattern: Component → Firewall → Component
    if (!isFirewallNode(source) && isFirewallNode(target)) {
      const firewall = target;
      const onwardEdge = edges.find(e => e.source === firewall.id);
      
      if (!onwardEdge) continue;

      const destination = nodes.find(n => n.id === onwardEdge.target);
      if (!destination || isFirewallNode(destination)) continue;

      const requestKey = `${source.id}-${firewall.id}-${destination.id}`;
      if (processed.has(requestKey)) continue;

      const sourceZone = getComponentZoneId(source, nodes);
      const destZone = getComponentZoneId(destination, nodes);

      if (!sourceZone || !destZone || sourceZone === destZone) continue;

      // Get zone labels
      const sourceZoneNode = nodes.find(n => n.id === sourceZone);
      const destZoneNode = nodes.find(n => n.id === destZone);
      
      const sourceZoneLabel = sourceZoneNode ? String((sourceZoneNode.data as any)?.label || "") : "";
      const destZoneLabel = destZoneNode ? String((destZoneNode.data as any)?.label || "") : "";

      // Get environment
      const getEnvironment = (node: Node): string => {
        const data = (node.data ?? {}) as any;
        return data.environmentLabel || "Production";
      };

      const firewallData = (firewall.data ?? {}) as any;
      const sourceData = (source.data ?? {}) as any;
      const destData = (destination.data ?? {}) as any;

      requests.push({
        environment: getEnvironment(source),
        firewallComponent: firewallData.label || "Firewall",
        firewallType: firewallData.componentType || "firewall",
        sourceComponent: sourceData.label || source.id,
        sourceZone: sourceZoneLabel,
        destComponent: destData.label || destination.id,
        destZone: destZoneLabel,
        protocol: sourceData.customFields?.["Protocol"] || destData.customFields?.["Protocol"] || "HTTPS",
        ports: sourceData.customFields?.["Port"] || destData.customFields?.["Port"] || "443",
        direction: "Outbound",
        connectionType: "firewall-request",
        originalEdgeId: edge.id
      });

      processed.add(requestKey);
    }
  }

  return requests;
};
