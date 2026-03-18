import type { ReactFlowProps } from "@xyflow/react";
import type { ReactNode } from "react";

import { Background, ReactFlow } from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type CanvasProps = ReactFlowProps & {
  children?: ReactNode;
};

const deleteKeyCode = ["Backspace", "Delete"];

export const Canvas = ({ children, ...props }: CanvasProps) => (
  <ReactFlow
    className="blueprint-grid"
    deleteKeyCode={deleteKeyCode}
    fitView
    maxZoom={2.4}
    minZoom={0.08}
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
    <Background color="rgb(139 92 246 / 0.18)" gap={28} size={1} />
    <Background color="rgb(217 249 157 / 0.08)" gap={140} size={1.4} />
    {children}
  </ReactFlow>
);

