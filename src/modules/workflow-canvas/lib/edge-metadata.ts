import type { Edge } from "@xyflow/react";

export type EdgeDirectionality = "one-way" | "two-way";
export type EdgeLineStyle = "solid" | "dotted";
export type EdgeConnectionType =
  | "firewall-request"
  | "data-flow"
  | "management"
  | "replication";

export interface EdgeMetadata {
  directionality: EdgeDirectionality;
  lineStyle: EdgeLineStyle;
  connectionType: EdgeConnectionType;
  protocol?: string;
  ports?: string;
}

export const DEFAULT_EDGE_METADATA: EdgeMetadata = {
  directionality: "one-way",
  lineStyle: "solid",
  connectionType: "firewall-request",
};

export const getEdgeMetadata = (edge: Edge): EdgeMetadata => {
  return getEdgeMetadataFromData(edge.data);
};

export const getEdgeMetadataFromData = (
  data: Edge["data"] | undefined
): EdgeMetadata => {
  const raw = (data ?? {}) as Partial<EdgeMetadata>;

  return {
    directionality:
      raw.directionality === "two-way" ? "two-way" : DEFAULT_EDGE_METADATA.directionality,
    lineStyle: raw.lineStyle === "dotted" ? "dotted" : DEFAULT_EDGE_METADATA.lineStyle,
    connectionType:
      raw.connectionType === "data-flow" ||
      raw.connectionType === "management" ||
      raw.connectionType === "replication"
        ? raw.connectionType
        : DEFAULT_EDGE_METADATA.connectionType,
    protocol: typeof raw.protocol === "string" ? raw.protocol : undefined,
    ports: typeof raw.ports === "string" ? raw.ports : undefined,
  };
};

export const getEdgeStrokeColor = (kind: EdgeConnectionType) => {
  switch (kind) {
    case "management":
      return "#0ea5e9";
    case "replication":
      return "#f59e0b";
    case "data-flow":
      return "#22c55e";
    default:
      return "#8b5cf6";
  }
};

export const getEdgeLabel = (edge: Edge) => {
  const meta = getEdgeMetadata(edge);
  const directionLabel = meta.directionality === "two-way" ? "bidirectional" : "one-way";
  const styleLabel = meta.lineStyle;

  return `${meta.connectionType} (${directionLabel}, ${styleLabel})`;
};
