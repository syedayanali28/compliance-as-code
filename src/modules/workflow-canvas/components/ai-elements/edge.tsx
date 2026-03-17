import type { EdgeProps, InternalNode, Node } from "@xyflow/react";

import {
  BaseEdge,
  getBezierPath,
  getSimpleBezierPath,
  Position,
  useInternalNode,
} from "@xyflow/react";
import {
  getEdgeMetadataFromData,
  getEdgeStrokeColor,
} from "@/modules/workflow-canvas/lib/edge-metadata";

const Temporary = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) => {
  const [edgePath] = getSimpleBezierPath({
    sourcePosition,
    sourceX,
    sourceY,
    targetPosition,
    targetX,
    targetY,
  });

  return (
    <BaseEdge
      className="stroke-1 stroke-ring"
      id={id}
      path={edgePath}
      style={{
        strokeDasharray: "5, 5",
      }}
    />
  );
};

const getHandleCoordsByPosition = (
  node: InternalNode<Node>,
  handlePosition: Position
) => {
  // Choose the handle type based on position - Left is for target, Right is for source
  const handleType = handlePosition === Position.Left ? "target" : "source";

  const handle = node.internals.handleBounds?.[handleType]?.find(
    (h) => h.position === handlePosition
  );

  if (!handle) {
    return [0, 0] as const;
  }

  let offsetX = handle.width / 2;
  let offsetY = handle.height / 2;

  // this is a tiny detail to make the markerEnd of an edge visible.
  // The handle position that gets calculated has the origin top-left, so depending which side we are using, we add a little offset
  // when the handlePosition is Position.Right for example, we need to add an offset as big as the handle itself in order to get the correct position
  switch (handlePosition) {
    case Position.Left: {
      offsetX = 0;
      break;
    }
    case Position.Right: {
      offsetX = handle.width;
      break;
    }
    case Position.Top: {
      offsetY = 0;
      break;
    }
    case Position.Bottom: {
      offsetY = handle.height;
      break;
    }
    default: {
      throw new Error(`Invalid handle position: ${handlePosition}`);
    }
  }

  const x = node.internals.positionAbsolute.x + handle.x + offsetX;
  const y = node.internals.positionAbsolute.y + handle.y + offsetY;

  return [x, y] as const;
};

const getEdgeParams = (
  source: InternalNode<Node>,
  target: InternalNode<Node>
) => {
  const sourcePos = Position.Right;
  const [sx, sy] = getHandleCoordsByPosition(source, sourcePos);
  const targetPos = Position.Left;
  const [tx, ty] = getHandleCoordsByPosition(target, targetPos);

  return {
    sourcePos,
    sx,
    sy,
    targetPos,
    tx,
    ty,
  };
};

const Animated = ({ id, source, target, data, style }: EdgeProps) => {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);

  if (!(sourceNode && targetNode)) {
    return null;
  }

  const { sx, sy, tx, ty, sourcePos, targetPos } = getEdgeParams(
    sourceNode,
    targetNode
  );

  const [edgePath] = getBezierPath({
    sourcePosition: sourcePos,
    sourceX: sx,
    sourceY: sy,
    targetPosition: targetPos,
    targetX: tx,
    targetY: ty,
  });

  const metadata = getEdgeMetadataFromData(data);
  const dashArray = metadata.lineStyle === "dotted" ? "6 4" : undefined;
  const stroke = getEdgeStrokeColor(metadata.connectionType);
  const markerEndId = `${id}-arrow-end`;
  const markerStartId = `${id}-arrow-start`;

  return (
    <>
      <defs>
        <marker
          id={markerEndId}
          markerHeight="8"
          markerWidth="8"
          orient="auto"
          refX="7"
          refY="3"
        >
          <path d="M0,0 L0,6 L7,3 z" fill={stroke} />
        </marker>
        <marker
          id={markerStartId}
          markerHeight="8"
          markerWidth="8"
          orient="auto-start-reverse"
          refX="1"
          refY="3"
        >
          <path d="M7,0 L7,6 L0,3 z" fill={stroke} />
        </marker>
      </defs>
      <BaseEdge
        id={id}
        markerEnd={`url(#${markerEndId})`}
        markerStart={metadata.directionality === "two-way" ? `url(#${markerStartId})` : undefined}
        path={edgePath}
        style={{
          ...(style ?? {}),
          stroke,
          strokeDasharray: dashArray,
          strokeWidth: 2,
        }}
      />
      <circle fill={stroke} r="3.4">
        <animateMotion dur="2s" path={edgePath} repeatCount="indefinite" />
      </circle>
    </>
  );
};

export const Edge = {
  Animated,
  Temporary,
};

