import type { ComponentProps } from "react";

import { cn } from "@/modules/workflow-canvas/lib/utils";
import { NodeToolbar, Position } from "@xyflow/react";

type ToolbarProps = ComponentProps<typeof NodeToolbar>;

export const Toolbar = ({ className, ...props }: ToolbarProps) => (
  <NodeToolbar
    className={cn(
      "flex items-center gap-0.5 rounded-sm border bg-background p-0.5",
      className
    )}
    position={Position.Bottom}
    {...props}
  />
);

