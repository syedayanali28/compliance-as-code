"use client";

import type { ReactFlowProps } from "@xyflow/react";
import type { ReactNode } from "react";

import { Background, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCanvasPreferences } from "@/modules/workflow-canvas/providers/canvas-preferences";

type CanvasProps = ReactFlowProps & {
  children?: ReactNode;
};

const deleteKeyCode = ["Backspace", "Delete"];

/** Matches workflow canvas zoom limits (see minZoom / maxZoom below). */
export const WORKFLOW_MIN_ZOOM = 0.08;
export const WORKFLOW_MAX_ZOOM = 2.4;

const CanvasInner = ({ children, ...props }: CanvasProps) => {
  const { showGrid } = useCanvasPreferences();

  return (
    <ReactFlow
      className="blueprint-grid"
      deleteKeyCode={deleteKeyCode}
      fitView
      maxZoom={WORKFLOW_MAX_ZOOM}
      minZoom={WORKFLOW_MIN_ZOOM}
      multiSelectionKeyCode={["Meta", "Control"]}
      panOnDrag={true}
      panOnScroll={false}
      zoomOnPinch
      zoomOnScroll
      selectionKeyCode={["Meta", "Control"]}
      selectionOnDrag={false}
      zoomOnDoubleClick={false}
      {...props}
    >
      {showGrid ? (
        <>
          <Background color="rgb(139 92 246 / 0.18)" gap={28} size={1} />
          <Background color="rgb(217 249 157 / 0.08)" gap={140} size={1.4} />
        </>
      ) : null}
      {children}
    </ReactFlow>
  );
};

export const Canvas = (props: CanvasProps) => <CanvasInner {...props} />;

