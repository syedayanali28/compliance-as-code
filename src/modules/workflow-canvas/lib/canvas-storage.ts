import type { Edge, Node } from "@xyflow/react";
import type { HkmaCanvasGraph } from "@/modules/workflow-canvas/lib/hkma-graph";

const STORAGE_KEY = "tersa-canvas";
const HKMA_GRAPH_KEY = "hkma-canvas-graph";

interface CanvasData {
  nodes: Node[];
  edges: Edge[];
}

export const saveCanvas = (data: CanvasData) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("idac:canvas-saved", {
          detail: {
            designName: "PROD_VNET",
            nodeCount: data.nodes.length,
            edgeCount: data.edges.length,
            at: new Date().toISOString(),
          },
        })
      );
    }
  } catch {
    // localStorage may be full or unavailable
  }
};

export const loadCanvas = (): CanvasData | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as CanvasData;
  } catch {
    return null;
  }
};

export const saveHkmaCanvasGraph = (graph: HkmaCanvasGraph) => {
  try {
    localStorage.setItem(HKMA_GRAPH_KEY, JSON.stringify(graph));
  } catch {
    // localStorage may be full or unavailable
  }
};

