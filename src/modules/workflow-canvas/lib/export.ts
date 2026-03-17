import type { Edge, Node } from "@xyflow/react";
import * as XLSX from "xlsx";
import { getEdgeMetadata } from "@/modules/workflow-canvas/lib/edge-metadata";
import type { HkmaNodeData } from "@/modules/workflow-canvas/lib/hkma-graph";

interface CanvasExportPayload {
  nodes: Node[];
  edges: Edge[];
}

const DEFAULT_NODE_WIDTH = 260;
const DEFAULT_NODE_HEIGHT = 120;

const resolveNodeWidth = (node: Node) => node.measured?.width ?? DEFAULT_NODE_WIDTH;
const resolveNodeHeight = (node: Node) => node.measured?.height ?? DEFAULT_NODE_HEIGHT;

const normalizeString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
};

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

const createDiagramCanvas = ({ nodes, edges }: CanvasExportPayload) => {
  const margin = 80;

  if (!nodes.length) {
    const emptyCanvas = document.createElement("canvas");
    emptyCanvas.width = 1280;
    emptyCanvas.height = 720;
    const ctx = emptyCanvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, emptyCanvas.width, emptyCanvas.height);
      ctx.fillStyle = "#334155";
      ctx.font = "600 28px sans-serif";
      ctx.fillText("No nodes to export", 80, 120);
    }
    return emptyCanvas;
  }

  const minX = Math.min(...nodes.map((node) => node.position.x));
  const minY = Math.min(...nodes.map((node) => node.position.y));
  const maxX = Math.max(
    ...nodes.map((node) => node.position.x + resolveNodeWidth(node))
  );
  const maxY = Math.max(
    ...nodes.map((node) => node.position.y + resolveNodeHeight(node))
  );

  const width = Math.max(1280, Math.ceil(maxX - minX + margin * 2));
  const height = Math.max(720, Math.ceil(maxY - minY + margin * 2));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return canvas;
  }

  const offsetX = margin - minX;
  const offsetY = margin - minY;

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  // Draw edges first.
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#64748b";
  edges.forEach((edge) => {
    const source = nodes.find((node) => node.id === edge.source);
    const target = nodes.find((node) => node.id === edge.target);
    if (!(source && target)) return;

    const sourceX = source.position.x + resolveNodeWidth(source) / 2 + offsetX;
    const sourceY = source.position.y + resolveNodeHeight(source) / 2 + offsetY;
    const targetX = target.position.x + resolveNodeWidth(target) / 2 + offsetX;
    const targetY = target.position.y + resolveNodeHeight(target) / 2 + offsetY;

    ctx.beginPath();
    ctx.moveTo(sourceX, sourceY);
    ctx.lineTo(targetX, targetY);
    ctx.stroke();
  });

  // Draw nodes over edges.
  nodes.forEach((node) => {
    const data = node.data as unknown as HkmaNodeData;
    const x = node.position.x + offsetX;
    const y = node.position.y + offsetY;
    const w = resolveNodeWidth(node);
    const h = resolveNodeHeight(node);

    drawRoundedRect(ctx, x, y, w, h, 20);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = "#cbd5e1";
    ctx.stroke();

    ctx.fillStyle = "#0f172a";
    ctx.font = "600 18px sans-serif";
    ctx.fillText(data.label ?? node.type, x + 14, y + 30);

    ctx.fillStyle = "#334155";
    ctx.font = "400 14px sans-serif";
    if (data.description) {
      ctx.fillText(data.description.slice(0, 48), x + 14, y + 52);
    }

    const tags = [data.category, data.zone, data.componentType]
      .filter(Boolean)
      .join(" • ");
    if (tags) {
      ctx.fillStyle = "#64748b";
      ctx.font = "400 12px sans-serif";
      ctx.fillText(tags, x + 14, y + h - 14);
    }
  });

  return canvas;
};

const downloadCanvas = (
  canvas: HTMLCanvasElement,
  mimeType: "image/png" | "image/jpeg",
  filename: string
) => {
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      downloadBlob(blob, filename);
    },
    mimeType,
    mimeType === "image/jpeg" ? 0.95 : undefined
  );
};

export const exportCanvasAsPng = (payload: CanvasExportPayload, fileBase: string) => {
  const canvas = createDiagramCanvas(payload);
  downloadCanvas(canvas, "image/png", `${fileBase}.png`);
};

export const exportCanvasAsJpeg = (payload: CanvasExportPayload, fileBase: string) => {
  const canvas = createDiagramCanvas(payload);
  downloadCanvas(canvas, "image/jpeg", `${fileBase}.jpeg`);
};

export const exportCanvasAsImage = (payload: CanvasExportPayload, fileBase: string) => {
  exportCanvasAsPng(payload, fileBase);
};

export const exportCanvasAsPdf = async (
  payload: CanvasExportPayload,
  fileBase: string
) => {
  const lines = [
    `Workflow Design Export`,
    `Generated: ${new Date().toISOString()}`,
    "",
    "Nodes:",
    ...payload.nodes.map((node) => {
      const data = node.data as unknown as HkmaNodeData;
      return `${node.id} | ${node.type} | ${data.label ?? ""} | ${data.category ?? ""} | ${data.zone ?? ""} | ${data.componentType ?? ""}`;
    }),
    "",
    "Edges:",
    ...payload.edges.map(
      (edge) => `${edge.id} | ${edge.source} -> ${edge.target} | ${edge.type ?? "animated"}`
    ),
  ];

  const safeText = lines
    .join("\n")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", String.raw`\(`)
    .replaceAll(")", String.raw`\)`);

  const contentStream = `BT\n/F1 11 Tf\n40 800 Td\n16 TL\n(${safeText
    .split("\n")
    .join(") Tj T* (")}) Tj\nET`;

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 842 1191] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >> endobj",
    `4 0 obj << /Length ${contentStream.length} >> stream\n${contentStream}\nendstream endobj`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object) => {
    offsets.push(body.length);
    body += `${object}\n`;
  });

  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  offsets.forEach((offset) => {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  const blob = new Blob([body], { type: "application/pdf" });
  downloadBlob(blob, `${fileBase}.pdf`);
};

export const exportCanvasAsExcel = (
  payload: CanvasExportPayload,
  fileBase: string
) => {
  const nodeById = new Map(payload.nodes.map((node) => [node.id, node]));

  const nodesSheet = payload.nodes.map((node) => {
    const data = node.data as unknown as HkmaNodeData;
    return {
      id: node.id,
      type: node.type,
      label: data.label ?? "",
      category: data.category ?? "",
      zone: data.zone ?? "",
      component_type: data.componentType ?? "",
      description: data.description ?? "",
      custom_fields: JSON.stringify(data.customFields ?? {}),
      x: node.position.x,
      y: node.position.y,
    };
  });

  const edgesSheet = payload.edges.map((edge) => {
    const metadata = getEdgeMetadata(edge);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: edge.type ?? "animated",
      connection_type: metadata.connectionType,
      directionality: metadata.directionality,
      line_style: metadata.lineStyle,
      protocol: metadata.protocol ?? "",
      ports: metadata.ports ?? "",
      source_label:
        ((nodeById.get(edge.source)?.data as unknown as HkmaNodeData | undefined)
          ?.label ?? ""),
      target_label:
        ((nodeById.get(edge.target)?.data as unknown as HkmaNodeData | undefined)
          ?.label ?? ""),
    };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(nodesSheet),
    "nodes"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(edgesSheet),
    "edges"
  );

  XLSX.writeFile(workbook, `${fileBase}.xlsx`);
};

export const exportCanvasAsIdacTemplateExcel = (
  payload: CanvasExportPayload,
  fileBase: string
) => {
  const nodeById = new Map(payload.nodes.map((node) => [node.id, node]));

  const componentsSheet = payload.nodes.map((node) => {
    const data = (node.data ?? {}) as HkmaNodeData & Record<string, unknown>;
    const parentNode = node.parentId ? nodeById.get(node.parentId) : undefined;
    const parentData = (parentNode?.data ?? {}) as unknown as HkmaNodeData;
    const componentKey =
      normalizeString(data.componentKey) ||
      normalizeString(data.componentType) ||
      normalizeString(node.type);

    return {
      component_name: data.label ?? node.type,
      component_key: componentKey,
      category: data.category ?? "",
      zone: data.zone ?? "",
      environment: parentData.label ?? (data.isZone ? data.label : ""),
      component_type: data.componentType ?? "",
      parent_component: parentData.label ?? "",
      description: data.description ?? "",
      x: node.position.x,
      y: node.position.y,
    };
  });

  const connectionsSheet = payload.edges.flatMap((edge) => {
    const metadata = getEdgeMetadata(edge);
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    const sourceData = (source?.data ?? {}) as unknown as HkmaNodeData;
    const targetData = (target?.data ?? {}) as unknown as HkmaNodeData;

    const baseRow = {
      connection_id: edge.id,
      source_component: sourceData.label ?? edge.source,
      source_zone: sourceData.zone ?? "",
      target_component: targetData.label ?? edge.target,
      target_zone: targetData.zone ?? "",
      direction: "source_to_target",
      connection_type: metadata.connectionType,
      line_style: metadata.lineStyle,
      protocol: metadata.protocol ?? "",
      ports: metadata.ports ?? "",
      firewall_relevance:
        metadata.connectionType === "firewall-request" ? "YES" : "CONDITIONAL",
      notes:
        metadata.directionality === "two-way"
          ? "Bidirectional connection in diagram."
          : "",
    };

    if (metadata.directionality === "two-way") {
      return [
        baseRow,
        {
          ...baseRow,
          direction: "target_to_source",
          source_component: targetData.label ?? edge.target,
          source_zone: targetData.zone ?? "",
          target_component: sourceData.label ?? edge.source,
          target_zone: sourceData.zone ?? "",
        },
      ];
    }

    return [baseRow];
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(componentsSheet),
    "idac_components"
  );
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(connectionsSheet),
    "idac_connections"
  );

  XLSX.writeFile(workbook, `${fileBase}-idac-template.xlsx`);
};
