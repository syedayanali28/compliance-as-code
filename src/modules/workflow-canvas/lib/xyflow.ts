import type { Node } from "@xyflow/react";
import type { TextNodeProps } from "@/modules/workflow-canvas/components/nodes/text";
import {
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

export const isValidSourceTarget = (source: Node, _target: Node) => {
  if (!supportsOutboundConnection(source.type)) {
    return false;
  }

  if (!isValidHkmaConnection(source, _target)) {
    return false;
  }

  return true;
};

