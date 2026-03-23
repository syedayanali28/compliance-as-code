"use client";

import {
  applyEdgeChanges,
  applyNodeChanges,
  type Edge,
  getOutgoers,
  type IsValidConnection,
  type Node,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnEdgesChange,
  type OnNodesChange,
  type ReactFlowProps,
  useReactFlow,
} from "@xyflow/react";
import { BoxSelectIcon, PlusIcon } from "lucide-react";
import { nanoid } from "nanoid";
import type { MouseEvent, MouseEventHandler } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";
import { toast } from "sonner";
import { useDebouncedCallback } from "use-debounce";
import { useAnalytics } from "@/modules/workflow-canvas/hooks/use-analytics";
import { loadCanvas, saveCanvas, saveHkmaCanvasGraph } from "@/modules/workflow-canvas/lib/canvas-storage";
import { isFirewallNode, toHkmaCanvasGraph } from "@/modules/workflow-canvas/lib/hkma-graph";
import { buildNodeButtons } from "@/modules/workflow-canvas/lib/node-buttons";
import {
  canAssignParent,
  createDefaultCatalog,
  findParentNodeByCategory,
  getComponentKeyFromNode,
  getNodeCategory,
  getRequiredParentCategoryForNode,
  isContainerNode,
  isDirectPublicToDatabase,
  resolveNodeCatalog,
  validateConnectionByPolicies,
  validateUniqueComponent,
  type RuntimePolicyCatalog,
} from "@/modules/workflow-canvas/lib/policy-catalog";
import { DEFAULT_EDGE_METADATA } from "@/modules/workflow-canvas/lib/edge-metadata";
import { validateFirewallTransit } from "@/modules/workflow-canvas/lib/firewall-requests";
import { isValidSourceTarget } from "@/modules/workflow-canvas/lib/xyflow";
import { NodeOperationsProvider } from "@/modules/workflow-canvas/providers/node-operations";
import { Canvas as CanvasComponent } from "./ai-elements/canvas";
import { Connection } from "./ai-elements/connection";
import { Edge as EdgeComponents } from "./ai-elements/edge";
import { nodeTypes } from "./nodes";

const edgeTypes = {
  animated: EdgeComponents.Animated,
  temporary: EdgeComponents.Temporary,
};

const WORKFLOW_CANVAS_POLICY_CACHE_KEY = "workflow-canvas-policy-catalog-v1";

const NODE_FALLBACK_SIZE = {
  environment: { width: 215, height: 135 },
  zone: { width: 70, height: 55 },
  default: { width: 75, height: 41 },
};

const CHILD_PADDING = 14;

/** Stacking order to keep child elements visible above their parents.
 * React Flow's default selected z-index is 1000.
 * - Components inside zones: 1002 (highest)
 * - Firewalls and zones: 1001 (above environment)
 * - Environments: default (can go up to 1000 when selected)
 */
const COMPONENT_NODE_Z_INDEX = 1002;
const FIREWALL_NODE_Z_INDEX = 1001;
const ZONE_NODE_Z_INDEX = 1001;
const EDGE_Z_INDEX = 2000;

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(value, max));

const toNumericSize = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
};

const getSafeString = (value: unknown, fallback = "") =>
  typeof value === "string" ? value : fallback;

const getFallbackSizeForCategory = (category: string) => {
  if (category === "environment") {
    return NODE_FALLBACK_SIZE.environment;
  }

  if (category === "zone") {
    return NODE_FALLBACK_SIZE.zone;
  }

  return NODE_FALLBACK_SIZE.default;
};

const getNodeSize = (
  node: Node,
  fallback: { width: number; height: number }
) => ({
  width:
    toNumericSize((node as { width?: unknown }).width) ??
    toNumericSize(node.measured?.width) ??
    toNumericSize((node as { initialWidth?: unknown }).initialWidth) ??
    toNumericSize((node.style as { width?: unknown } | undefined)?.width) ??
    fallback.width,
  height:
    toNumericSize((node as { height?: unknown }).height) ??
    toNumericSize(node.measured?.height) ??
    toNumericSize((node as { initialHeight?: unknown }).initialHeight) ??
    toNumericSize((node.style as { height?: unknown } | undefined)?.height) ??
    fallback.height,
});

const getChildBounds = ({
  parentSize,
  childSize,
}: {
  parentSize: { width: number; height: number };
  childSize: { width: number; height: number };
}) => {
  const rawMaxX = parentSize.width - childSize.width - CHILD_PADDING;
  const rawMaxY = parentSize.height - childSize.height - CHILD_PADDING;

  // If a child is larger than its parent, allow negative offsets so it can still move.
  const minX = Math.min(CHILD_PADDING, rawMaxX);
  const maxX = Math.max(CHILD_PADDING, rawMaxX);
  const minY = Math.min(CHILD_PADDING, rawMaxY);
  const maxY = Math.max(CHILD_PADDING, rawMaxY);

  return {
    minX,
    maxX,
    minY,
    maxY,
  };
};

const getChildSlotPosition = ({
  parent,
  siblingCount,
  childSize,
}: {
  parent: Node;
  siblingCount: number;
  childSize: { width: number; height: number };
}) => {
  const parentSize = getNodeSize(parent, NODE_FALLBACK_SIZE.environment);
  const usableWidth = Math.max(1, parentSize.width - CHILD_PADDING * 2);
  const columns = Math.max(
    1,
    Math.floor(usableWidth / (childSize.width + CHILD_PADDING))
  );
  const row = Math.floor(siblingCount / columns);
  const col = siblingCount % columns;
  const bounds = getChildBounds({
    parentSize,
    childSize,
  });

  return {
    x: clamp(CHILD_PADDING + col * (childSize.width + CHILD_PADDING), bounds.minX, bounds.maxX),
    y: clamp(CHILD_PADDING + row * (childSize.height + CHILD_PADDING), bounds.minY, bounds.maxY),
  };
};

const withFirewallStacking = (node: Node): Node => {
  if (!isFirewallNode(node)) {
    return node;
  }
  const prev = node.style;
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...prev }
      : {};
  return {
    ...node,
    style: {
      ...base,
      zIndex: FIREWALL_NODE_Z_INDEX,
    },
  };
};

const withZoneStacking = (node: Node): Node => {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const category = getSafeString(data.category);
  
  if (category !== "zone") {
    return node;
  }
  
  const prev = node.style;
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...prev }
      : {};
  return {
    ...node,
    style: {
      ...base,
      zIndex: ZONE_NODE_Z_INDEX,
    },
  };
};

const withComponentStacking = (node: Node): Node => {
  const data = (node.data ?? {}) as Record<string, unknown>;
  const category = getSafeString(data.category);
  
  // Components inside zones need highest z-index to be visible above the zone
  const isComponent = !["environment", "zone"].includes(category) && !isFirewallNode(node);
  
  if (!isComponent) {
    return node;
  }
  
  const prev = node.style;
  const base =
    prev && typeof prev === "object" && !Array.isArray(prev)
      ? { ...prev }
      : {};
  return {
    ...node,
    style: {
      ...base,
      zIndex: COMPONENT_NODE_Z_INDEX,
    },
  };
};

const normalizeChildLayouts = (nodes: Node[]) => {
  return nodes.map((node) => {
    if (!node.parentId) {
      return withFirewallStacking(node);
    }

    const parent = nodes.find((candidate) => candidate.id === node.parentId);
    if (!parent) {
      return withFirewallStacking(node);
    }

    const category = getSafeString(
      ((node.data ?? {}) as Record<string, unknown>).category
    );
    const fallback = getFallbackSizeForCategory(category);
    const childSize = getNodeSize(node, fallback);
    const parentSize = getNodeSize(parent, NODE_FALLBACK_SIZE.environment);
    const bounds = getChildBounds({
      parentSize,
      childSize,
    });

    return withComponentStacking(
      withZoneStacking(
        withFirewallStacking({
          ...node,
          extent: "parent" as const,
          position: {
            x: clamp(node.position.x, bounds.minX, bounds.maxX),
            y: clamp(node.position.y, bounds.minY, bounds.maxY),
          },
        })
      )
    );
  });
};

const withEdgeStacking = (edges: Edge[]) =>
  edges.map((edge) => ({
    ...edge,
    zIndex: EDGE_Z_INDEX,
  }));

type PlacementContext = {
  environmentId?: string;
  environmentLabel?: string;
  zoneId?: string;
  zoneLabel?: string;
};

const getPlacementContext = ({
  parentNode,
  nodes,
}: {
  parentNode?: Node;
  nodes: Node[];
}): PlacementContext => {
  if (!parentNode) {
    return {};
  }

  const parentData = (parentNode.data ?? {}) as Record<string, unknown>;
  const parentCategory = getSafeString(parentData.category);

  if (parentCategory === "environment") {
    return {
      environmentId: parentNode.id,
      environmentLabel: getSafeString(parentData.label, "Environment"),
    };
  }

  if (parentCategory !== "zone") {
    return {};
  }

  const environmentNode = parentNode.parentId
    ? nodes.find((node) => node.id === parentNode.parentId)
    : undefined;
  const environmentData = (environmentNode?.data ?? {}) as Record<string, unknown>;

  return {
    zoneId: parentNode.id,
    zoneLabel: getSafeString(parentData.label, "Zone"),
    environmentId: environmentNode?.id,
    environmentLabel: getSafeString(environmentData.label, "Environment"),
  };
};

const getNextComponentInstanceNumber = ({
  nodes,
  componentKey,
  zoneId,
}: {
  nodes: Node[];
  componentKey: string;
  zoneId?: string;
}) => {
  if (!zoneId) {
    return 1;
  }

  const matching = nodes.filter((node) => {
    const nodeData = (node.data ?? {}) as Record<string, unknown>;
    const nodeZoneId = getSafeString(nodeData.zoneId);
    const nodeComponentKey = getSafeString(nodeData.componentKey, getComponentKeyFromNode(node));
    return nodeZoneId === zoneId && nodeComponentKey === componentKey;
  });

  return matching.length + 1;
};

const mergePlacementIntoData = ({
  baseData,
  placement,
  instanceNumber,
}: {
  baseData: Record<string, unknown>;
  placement: PlacementContext;
  instanceNumber?: number;
}) => {
  const nextData: Record<string, unknown> = {
    ...baseData,
    ...placement,
  };

  if (instanceNumber) {
    nextData.instanceNumber = instanceNumber;
    const componentLabel = getSafeString(baseData.label, "Component");
    nextData.instanceId = `${componentLabel}-${instanceNumber}`;
  }

  const isZoneNode = String(baseData.category ?? "") === "zone";
  if (isZoneNode) {
    // Zones are layout areas inside an environment — never show or persist parent env on the zone.
    delete nextData.environmentId;
    delete nextData.environmentLabel;
    delete nextData.locationSummary;
  } else if (placement.zoneLabel && placement.environmentLabel) {
    nextData.locationSummary = `${placement.zoneLabel} in ${placement.environmentLabel}`;
  } else if (placement.environmentLabel) {
    nextData.locationSummary = placement.environmentLabel;
  }

  return nextData;
};

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "./ui/context-menu";

export const Canvas = ({ children, ...props }: ReactFlowProps) => {
  const {
    onConnect,
    onEdgesChange,
    onNodesChange,
    nodes: initialNodes,
    edges: initialEdges,
    ...restProps
  } = props ?? {};
  const [nodes, setNodes] = useState<Node[]>(initialNodes ?? []);
  const [edges, setEdges] = useState<Edge[]>(withEdgeStacking(initialEdges ?? []));
  const [loaded, setLoaded] = useState(false);
  const [copiedNodes, setCopiedNodes] = useState<Node[]>([]);
  const [copiedEdges, setCopiedEdges] = useState<Edge[]>([]);
  const [activeZoneId, setActiveZoneId] = useState<string | undefined>(
    undefined
  );
  const [policyCatalog, setPolicyCatalog] =
    useState<RuntimePolicyCatalog>(createDefaultCatalog());
  const [nodeButtons, setNodeButtons] = useState(() =>
    buildNodeButtons(createDefaultCatalog())
  );
  const {
    getEdges,
    toObject,
    screenToFlowPosition,
    getNodes,
    getNode,
    getIntersectingNodes,
    updateNode,
    fitView,
  } = useReactFlow();
  const analytics = useAnalytics();
  const hasComplianceRisk = useMemo(() => {
    return isDirectPublicToDatabase(edges, nodes);
  }, [edges, nodes]);

  useEffect(() => {
    const stored = loadCanvas();
    if (stored) {
      setNodes(normalizeChildLayouts(stored.nodes));
      setEdges(withEdgeStacking(stored.edges));
    }
    setLoaded(true);

    const loadPolicies = async () => {
      const readCachedCatalog = () => {
        try {
          const raw = globalThis.localStorage.getItem(WORKFLOW_CANVAS_POLICY_CACHE_KEY);
          if (!raw) {
            return null;
          }

          const parsed = JSON.parse(raw) as RuntimePolicyCatalog;
          if (!Array.isArray(parsed.components) || !Array.isArray(parsed.rules)) {
            return null;
          }

          return parsed;
        } catch {
          return null;
        }
      };

      const writeCachedCatalog = (catalog: RuntimePolicyCatalog) => {
        try {
          globalThis.localStorage.setItem(
            WORKFLOW_CANVAS_POLICY_CACHE_KEY,
            JSON.stringify(catalog)
          );
        } catch {
          // Ignore cache write failures in constrained environments.
        }
      };

      const response = await fetch("/api/workflow-canvas/policies", {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        const cached = readCachedCatalog();
        if (cached) {
          setPolicyCatalog(cached);
          setNodeButtons(buildNodeButtons(cached));
        }
        return;
      }

      const payload = (await response.json()) as RuntimePolicyCatalog;
      if (!Array.isArray(payload.components) || !Array.isArray(payload.rules)) {
        const cached = readCachedCatalog();
        if (cached) {
          setPolicyCatalog(cached);
          setNodeButtons(buildNodeButtons(cached));
        }
        return;
      }

      setPolicyCatalog(payload);
      setNodeButtons(buildNodeButtons(payload));
      writeCachedCatalog(payload);
    };

    void loadPolicies();
  }, []);

  const save = useDebouncedCallback(() => {
    const { nodes: currentNodes, edges: currentEdges } = toObject();
    saveCanvas({ nodes: currentNodes, edges: currentEdges });
    saveHkmaCanvasGraph(toHkmaCanvasGraph(currentNodes, currentEdges));
  }, 1000);

  const handleNodesChange = useCallback<OnNodesChange>(
    (changes) => {
      setNodes((current) => {
        const updated = normalizeChildLayouts(applyNodeChanges(changes, current));
        save();
        onNodesChange?.(changes);
        return updated;
      });
    },
    [save, onNodesChange]
  );

  const handleEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      setEdges((current) => {
        const updated = withEdgeStacking(applyEdgeChanges(changes, current));
        save();
        onEdgesChange?.(changes);
        return updated;
      });
    },
    [save, onEdgesChange]
  );

  const handleConnect = useCallback<OnConnect>(
    (connection) => {
      if (!connection.source || !connection.target) {
        return;
      }

      const currentNodes = getNodes();
      const currentEdges = getEdges();

      // Validate firewall transit rule
      const validation = validateFirewallTransit(
        { source: connection.source, target: connection.target },
        currentEdges,
        currentNodes
      );

      if (!validation.valid) {
        toast.error(validation.message || "Invalid connection");
        return;
      }

      const newEdge: Edge = {
        id: nanoid(),
        type: "animated",
        zIndex: EDGE_Z_INDEX,
        data: {
          ...DEFAULT_EDGE_METADATA,
        },
        ...connection,
      };
      
      setEdges((eds: Edge[]) => eds.concat(newEdge));
      save();
      onConnect?.(connection);

      // Show info message if firewall connection is incomplete
      if (validation.message) {
        toast.info(validation.message);
      } else if (validation.firewallRequest) {
        toast.success("Firewall request created successfully");
        analytics.track("firewall_request_created", {
          source: validation.firewallRequest.source.id,
          firewall: validation.firewallRequest.firewall.id,
          destination: validation.firewallRequest.destination.id,
          sourceZone: validation.firewallRequest.sourceZone,
          destZone: validation.firewallRequest.destinationZone,
        });
      }
    },
    [save, onConnect, getNodes, getEdges, analytics]
  );

  const addNode = useCallback(
    (selector: string, options?: Record<string, unknown>) => {
      const { data: nodeData, ...nodeOptions } = options ?? {};
      const catalogEntry = resolveNodeCatalog(selector, policyCatalog);
      const typedNodeData = (nodeData ?? {}) as Record<string, unknown>;
      const componentKey = getSafeString(
        typedNodeData.componentKey,
        catalogEntry?.componentKey ?? selector
      );
      const nodeType = catalogEntry?.nodeType ?? selector;
      const currentNodes = getNodes();

      const nodeCategory = getSafeString(
        typedNodeData.category,
        catalogEntry?.category ?? "integration"
      );
      const candidateNode: Node = {
        id: "candidate",
        type: nodeType,
        position: { x: 0, y: 0 },
        data: {
          label: catalogEntry?.label ?? "Component",
          category: nodeCategory,
          description: catalogEntry?.description,
          componentType: catalogEntry?.componentType,
          componentKey,
          zone: catalogEntry?.zone,
          isZone: catalogEntry?.isZone,
          ...typedNodeData,
        },
      };

      const requiredParentCategory = getRequiredParentCategoryForNode(candidateNode, policyCatalog);

      // Pre-resolve environment for unique firewalls — never use activeZoneId (a zone) for this.
      const preliminaryEnvId =
        requiredParentCategory === "environment"
          ? (typeof nodeOptions.parentId === "string"
              ? nodeOptions.parentId
              : undefined) ??
            findParentNodeByCategory(currentNodes, "environment")
          : undefined;

      const uniqueError = validateUniqueComponent(
        currentNodes,
        componentKey,
        policyCatalog,
        preliminaryEnvId
      );
      if (uniqueError) {
        toast.error(uniqueError);
        return "";
      }

      let targetParentId =
        typeof nodeOptions.parentId === "string" ? nodeOptions.parentId : undefined;

      if (!targetParentId && requiredParentCategory === "environment") {
        targetParentId = findParentNodeByCategory(currentNodes, "environment");
      }
      if (!targetParentId && requiredParentCategory === "zone") {
        targetParentId =
          activeZoneId ??
          findParentNodeByCategory(currentNodes, "zone");
      }

      const parentNode = targetParentId
        ? currentNodes.find((node) => node.id === targetParentId)
        : undefined;

      if (requiredParentCategory) {
        if (!parentNode) {
          toast.error(`Select or create a ${requiredParentCategory} before adding this component.`);
          return "";
        }

        if (!canAssignParent(candidateNode, parentNode, policyCatalog)) {
          const childCat = getSafeString(
            (candidateNode.data as Record<string, unknown> | undefined)?.category
          );
          toast.error(
            requiredParentCategory === "environment"
              ? childCat === "zone"
                ? "Zones can only be placed inside an environment."
                : "Place this item in the environment (not inside a zone). Firewalls belong between zones at environment level."
              : "Components can only be placed inside a zone."
          );
          return "";
        }
      }

      const requestedPosition = nodeOptions.position as
        | { x: number; y: number }
        | undefined;
      const childSize = getFallbackSizeForCategory(nodeCategory);

      let snappedPosition = requestedPosition ?? { x: 0, y: 0 };

      // For firewalls at environment level: use requested position (viewport center from toolbar)
      // instead of auto-grid placement, so they can be positioned between zones manually.
      const isFirewall =
        candidateNode.data &&
        typeof candidateNode.data === "object" &&
        "componentType" in candidateNode.data &&
        String(candidateNode.data.componentType).toLowerCase().startsWith("firewall:");

      if (parentNode && !isFirewall) {
        const siblings = currentNodes.filter((node) => node.parentId === parentNode.id);
        snappedPosition = getChildSlotPosition({
          parent: parentNode,
          siblingCount: siblings.length,
          childSize,
        });
      } else if (parentNode && isFirewall && requestedPosition) {
        // For firewalls: use the requested position but ensure it's within parent bounds
        const parentSize = getNodeSize(parentNode, NODE_FALLBACK_SIZE.environment);
        const bounds = getChildBounds({
          parentSize,
          childSize,
        });
        snappedPosition = {
          x: clamp(requestedPosition.x - parentNode.position.x, bounds.minX, bounds.maxX),
          y: clamp(requestedPosition.y - parentNode.position.y, bounds.minY, bounds.maxY),
        };
      }

      const placement = getPlacementContext({
        parentNode,
        nodes: currentNodes,
      });
      const isContainer = isContainerNode(candidateNode, policyCatalog);
      const instanceNumber = isContainer
        ? undefined
        : getNextComponentInstanceNumber({
            nodes: currentNodes,
            componentKey,
            zoneId: placement.zoneId,
          });

      const newNode: Node = {
        id: nanoid(),
        type: nodeType,
        data: mergePlacementIntoData({
          baseData: {
          label: catalogEntry?.label ?? "Component",
          category: nodeCategory,
          description: catalogEntry?.description,
          componentType: catalogEntry?.componentType,
          componentKey,
          zone: catalogEntry?.zone,
          isZone: catalogEntry?.isZone,
            ...(typedNodeData ? typedNodeData : {}),
          },
          placement,
          instanceNumber,
        }),
        position: parentNode ? snappedPosition : requestedPosition ?? { x: 0, y: 0 },
        origin: [0, 0],
        ...(parentNode
          ? {
              parentId: parentNode.id,
              extent: "parent" as const,
            }
          : {}),
        ...(isContainer
          ? {
              style: {
                width:
                  catalogEntry?.defaultWidth ??
                  (nodeCategory === "zone"
                    ? NODE_FALLBACK_SIZE.zone.width
                    : NODE_FALLBACK_SIZE.environment.width),
                height:
                  catalogEntry?.defaultHeight ??
                  (nodeCategory === "zone"
                    ? NODE_FALLBACK_SIZE.zone.height
                    : NODE_FALLBACK_SIZE.environment.height),
              },
            }
          : {}),
        ...nodeOptions,
      };

      const nodeToAdd = withFirewallStacking(newNode);

      setNodes((nds: Node[]) => nds.concat(nodeToAdd));
      save();

      analytics.track("toolbar", "node", "added", {
        type: nodeType,
      });

      return nodeToAdd.id;
    },
    [save, analytics, activeZoneId, policyCatalog, getNodes]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      const node = getNode(id);

      if (!node?.type) {
        return;
      }

      const { id: _oldId, ...nodeProps } = node;

      const selector = getSafeString(
        (node.data as Record<string, unknown>)?.componentKey,
        node.type ?? ""
      );
      const newId = addNode(selector, {
        ...nodeProps,
        position: {
          x: node.position.x + 200,
          y: node.position.y + 200,
        },
        selected: true,
      });

      setTimeout(() => {
        updateNode(id, { selected: false });
        updateNode(newId, { selected: true });
      }, 0);
    },
    [addNode, getNode, updateNode]
  );

  const handleConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      if (!connectionState.isValid) {
        const { clientX, clientY } =
          "changedTouches" in event ? event.changedTouches[0] : event;

        const sourceId = connectionState.fromNode?.id;
        const isSourceHandle = connectionState.fromHandle?.type === "source";

        if (!sourceId) {
          return;
        }

        const newNodeId = addNode("drop", {
          position: screenToFlowPosition({ x: clientX, y: clientY }),
          data: {
            isSource: !isSourceHandle,
          },
        });

        setEdges((eds: Edge[]) =>
          eds.concat({
            id: nanoid(),
            source: isSourceHandle ? sourceId : newNodeId,
            target: isSourceHandle ? newNodeId : sourceId,
            type: "temporary",
            zIndex: EDGE_Z_INDEX,
          })
        );
      }
    },
    [addNode, screenToFlowPosition]
  );

  const handleNodeDragStop = useCallback(
    (_event: unknown, draggedNode: Node) => {
      const currentNodes = getNodes();
      const source = currentNodes.find((node) => node.id === draggedNode.id);
      if (!source) {
        return;
      }

      const sourceCategory = getNodeCategory(source, policyCatalog);
      const requiredParentCategory = getRequiredParentCategoryForNode(source, policyCatalog);

      if (!requiredParentCategory) {
        return;
      }

      const intersections = getIntersectingNodes(source).filter(
        (node) => node.id !== source.id
      );
      let parentCandidate = intersections.find((node) => {
        const category = getNodeCategory(node, policyCatalog);
        return category === requiredParentCategory;
      });

      // Environment-level nodes (e.g. firewalls) often intersect child zones only; keep their env parent.
      if (
        !parentCandidate &&
        requiredParentCategory === "environment" &&
        source.parentId
      ) {
        const existing = currentNodes.find((n) => n.id === source.parentId);
        if (
          existing &&
          getNodeCategory(existing, policyCatalog) === "environment"
        ) {
          parentCandidate = existing;
        }
      }

      if (!parentCandidate || !canAssignParent(source, parentCandidate, policyCatalog)) {
        return;
      }

      const childSize = getFallbackSizeForCategory(sourceCategory ?? "");
      const siblings = currentNodes.filter(
        (node) => node.parentId === parentCandidate.id && node.id !== source.id
      );
      const hasSameParent = source.parentId === parentCandidate.id;
      const nextPosition = hasSameParent
        ? draggedNode.position
        : getChildSlotPosition({
            parent: parentCandidate,
            siblingCount: siblings.length,
            childSize,
          });

      setNodes((nodesState) => {
        const placement = getPlacementContext({
          parentNode: parentCandidate,
          nodes: nodesState,
        });

        const nextNodes = nodesState.map((node) => {
          if (node.id !== source.id) {
            return node;
          }

          const nodeData = (node.data ?? {}) as Record<string, unknown>;
          const componentKey = getSafeString(nodeData.componentKey, getComponentKeyFromNode(node));
          const instanceNumber = isContainerNode(node, policyCatalog)
            ? undefined
            : getNextComponentInstanceNumber({
                nodes: nodesState.filter((candidate) => candidate.id !== source.id),
                componentKey,
                zoneId: placement.zoneId,
              });

          return {
            ...node,
            parentId: parentCandidate.id,
            extent: "parent" as const,
            position: nextPosition,
            data: mergePlacementIntoData({
              baseData: nodeData,
              placement,
              instanceNumber,
            }),
          };
        });

        return normalizeChildLayouts(nextNodes);
      });
      save();
    },
    [getNodes, getIntersectingNodes, policyCatalog, save]
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      const currentNodes = getNodes();
      const currentEdges = getEdges();
      const target = currentNodes.find((node) => node.id === connection.target);

      if (connection.source) {
        const source = currentNodes.find(
          (node) => node.id === connection.source
        );

        if (!(source && target)) {
          return false;
        }

        const valid = isValidSourceTarget(source, target);

        if (!valid) {
          return false;
        }

        const policyCheck = validateConnectionByPolicies(
          source,
          target,
          policyCatalog
        );
        if (!policyCheck.allowed) {
          return false;
        }
      }

      const hasCycle = (node: Node, visited = new Set<string>()) => {
        if (visited.has(node.id)) {
          return false;
        }

        visited.add(node.id);

        for (const outgoer of getOutgoers(node, currentNodes, currentEdges)) {
          if (outgoer.id === connection.source || hasCycle(outgoer, visited)) {
            return true;
          }
        }
      };

      if (!target || target.id === connection.source) {
        return false;
      }

      return !hasCycle(target);
    },
    [getNodes, getEdges, policyCatalog]
  );

  const handleConnectStart = useCallback<OnConnectStart>(() => {
    setNodes((nds: Node[]) => nds.filter((n: Node) => n.type !== "drop"));
    setEdges((eds: Edge[]) => eds.filter((e: Edge) => e.type !== "temporary"));
    save();
  }, [save]);

  const addDropNode = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      const { x, y } = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode("drop", {
        position: { x, y },
      });
    },
    [addNode, screenToFlowPosition]
  );

  const handleSelectAll = useCallback(() => {
    setNodes((nds: Node[]) =>
      nds.map((node: Node) => ({ ...node, selected: true }))
    );
    setEdges((eds: Edge[]) =>
      eds.map((edge: Edge) => ({ ...edge, selected: true }))
    );
  }, []);

  const handleClearSelection = useCallback(() => {
    setNodes((nds: Node[]) =>
      nds.map((node: Node) => ({ ...node, selected: false }))
    );
    setEdges((eds: Edge[]) =>
      eds.map((edge: Edge) => ({ ...edge, selected: false }))
    );
  }, []);

  const handleCopy = useCallback(() => {
    const selectedNodes = getNodes().filter((node) => node.selected);

    if (selectedNodes.length > 0) {
      const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
      const selectedEdges = getEdges().filter(
        (edge) =>
          selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
      );

      setCopiedNodes(selectedNodes);
      setCopiedEdges(selectedEdges);
    }
  }, [getNodes, getEdges]);

  const handlePaste = useCallback(() => {
    if (copiedNodes.length === 0) {
      return;
    }

    const idMap = new Map<string, string>();

    const newNodes = copiedNodes.map((node) => {
      const nextId = nanoid();
      idMap.set(node.id, nextId);

      return {
        ...node,
        id: nextId,
        position: {
          x: node.position.x + 120,
          y: node.position.y + 120,
        },
        selected: true,
      };
    });

    const newEdges = copiedEdges.reduce<Edge[]>((result, edge) => {
        const source = idMap.get(edge.source);
        const target = idMap.get(edge.target);
        if (!source || !target) {
          return result;
        }

        result.push({
          ...edge,
          id: nanoid(),
          source,
          target,
          selected: true,
        });

        return result;
      }, []);

    setNodes((nds: Node[]) =>
      nds.map((node: Node) => ({
        ...node,
        selected: false,
      }))
    );

    setEdges((eds: Edge[]) =>
      eds.map((edge: Edge) => ({
        ...edge,
        selected: false,
      }))
    );

    setNodes((nds: Node[]) => [...nds, ...newNodes]);
    setEdges((eds: Edge[]) => [...eds, ...newEdges]);
    save();
  }, [copiedNodes, copiedEdges, save]);

  const handleFitViewport = useCallback(() => {
    void fitView({ duration: 220, padding: 0.16 });
  }, [fitView]);

  const handleDuplicateAll = useCallback(() => {
    const selected = getNodes().filter((node) => node.selected);

    for (const node of selected) {
      duplicateNode(node.id);
    }
  }, [getNodes, duplicateNode]);

  const handleContextMenu = useCallback((event: MouseEvent) => {
    if (
      !(
        event.target instanceof HTMLElement &&
        event.target.classList.contains("react-flow__pane")
      )
    ) {
      event.preventDefault();
    }
  }, []);

  useHotkeys("meta+a,ctrl+a", handleSelectAll, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys("meta+d,ctrl+d", handleDuplicateAll, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys("meta+c,ctrl+c", handleCopy, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys("meta+v,ctrl+v", handlePaste, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys("esc", handleClearSelection, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys("f", handleFitViewport, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  if (!loaded) {
    return null;
  }

  return (
    <NodeOperationsProvider
      activeZoneId={activeZoneId}
      addNode={addNode}
      duplicateNode={duplicateNode}
      nodeButtons={nodeButtons}
      policyCatalog={policyCatalog}
      setActiveZoneId={setActiveZoneId}
    >
      <ContextMenu>
        <ContextMenuTrigger onContextMenu={handleContextMenu}>
          <CanvasComponent
            connectionLineComponent={Connection}
            defaultEdgeOptions={{ zIndex: EDGE_Z_INDEX }}
            edges={edges}
            edgeTypes={edgeTypes}
            isValidConnection={isValidConnection}
            nodes={nodes}
            nodeTypes={nodeTypes}
            onConnect={handleConnect}
            onConnectEnd={handleConnectEnd}
            onConnectStart={handleConnectStart}
            onDoubleClick={addDropNode}
            onEdgesChange={handleEdgesChange}
            onNodeDragStop={handleNodeDragStop}
            onNodesChange={handleNodesChange}
            {...restProps}
          >
            {children}
            {hasComplianceRisk ? (
              <div className="pointer-events-none absolute right-4 top-4 z-30 max-w-[12rem] rounded-xl border border-[#ff4d00]/60 bg-white p-3 text-xs text-[#c2410c] neon-alert-border shadow-xl">
                Compliance warning: public-facing node linked directly to a secure DB tier.
              </div>
            ) : null}
          </CanvasComponent>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={addDropNode}>
            <PlusIcon size={12} />
            <span>Add a new node</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleSelectAll}>
            <BoxSelectIcon size={12} />
            <span>Select all</span>
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    </NodeOperationsProvider>
  );
};

