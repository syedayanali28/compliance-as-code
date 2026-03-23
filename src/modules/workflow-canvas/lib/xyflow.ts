import type { Node } from "@xyflow/react";
import type { TextNodeProps } from "@/modules/workflow-canvas/components/nodes/text";
import {
  getEffectiveNodeCategory,
  isFirewallNode,
  isValidHkmaConnection,
  supportsOutboundConnection,
} from "@/modules/workflow-canvas/lib/hkma-graph";

export const getTextFromTextNodes = (nodes: Node[]) => {
  const sourceTexts = nodes
    .filter((node) => node.type === "text")
    .map((node) => (node.data as TextNodeProps["data"]).text);

  const generatedTexts = nodes
    .filter((node) => node.type === "text" && node.data.generated)
    .map((node) => (node.data as TextNodeProps["data"]).generated?.text);

  return [...sourceTexts, ...generatedTexts].filter(Boolean) as string[];
};

export const isValidSourceTarget = (source: Node, target: Node) => {
  if (!supportsOutboundConnection(source.type)) {
    return false;
  }

  // Zones cannot be connection endpoints - components connect via firewalls
  const sourceCategory = getEffectiveNodeCategory(source);
  const targetCategory = getEffectiveNodeCategory(target);
  
  if (sourceCategory === "zone" || targetCategory === "zone") {
    return false;
  }

  // Firewalls cannot connect to other firewalls
  const sourceFw = isFirewallNode(source);
  const targetFw = isFirewallNode(target);
  if (sourceFw && targetFw) {
    return false;
  }

  // Components can connect to firewalls (and vice versa)
  // Validation for full firewall transit path happens in canvas.tsx

  if (!isValidHkmaConnection(source, target)) {
    return false;
  }

  return true;
};

