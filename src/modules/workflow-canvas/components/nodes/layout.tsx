import { useReactFlow } from "@xyflow/react";
import { CodeIcon, CopyIcon, EyeIcon, TrashIcon } from "lucide-react";
import { type ReactNode, useState } from "react";
import {
  Node,
  NodeContent,
  NodeHeader,
  NodeTitle,
} from "@/modules/workflow-canvas/components/ai-elements/node";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/modules/workflow-canvas/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/workflow-canvas/components/ui/dialog";
import {
  supportsInboundConnection,
  supportsOutboundConnection,
} from "@/modules/workflow-canvas/lib/hkma-graph";
import { cn } from "@/modules/workflow-canvas/lib/utils";
import { useNodeOperations } from "@/modules/workflow-canvas/providers/node-operations";
import { NodeToolbar } from "./toolbar";

interface NodeLayoutProps {
  children: ReactNode;
  id: string;
  data?: unknown;
  title: string;
  type: string;
  toolbar?: {
    tooltip?: string;
    children: ReactNode;
  }[];
  className?: string;
  disableDefaultSurface?: boolean;
  contentClassName?: string;
}

export const NodeLayout = ({
  children,
  type,
  id,
  data,
  toolbar,
  title,
  className,
  disableDefaultSurface,
  contentClassName,
}: NodeLayoutProps) => {
  const { deleteElements, setCenter, getNode, updateNode } = useReactFlow();
  const { duplicateNode } = useNodeOperations();
  const [showData, setShowData] = useState(false);

  const handleFocus = () => {
    const node = getNode(id);

    if (!node) {
      return;
    }

    const { x, y } = node.position;
    const width = node.measured?.width ?? 0;

    setCenter(x + width / 2, y, {
      duration: 1000,
    });
  };

  const handleDelete = () => {
    deleteElements({
      nodes: [{ id }],
    });
  };

  const handleShowData = () => {
    setTimeout(() => {
      setShowData(true);
    }, 100);
  };

  const handleSelect = (open: boolean) => {
    if (!open) {
      return;
    }

    const node = getNode(id);

    if (!node) {
      return;
    }

    if (!node.selected) {
      updateNode(id, { selected: true });
    }
  };

  return (
    <>
      {type !== "drop" && Boolean(toolbar?.length) && (
        <NodeToolbar id={id} items={toolbar} />
      )}
      <ContextMenu onOpenChange={handleSelect}>
        <ContextMenuTrigger>
          <Node
            className={cn(
              className,
              "rounded-[14px] bg-transparent shadow-none"
            )}
            handles={{
              target: supportsInboundConnection(type),
              source: supportsOutboundConnection(type),
            }}
          >
            {type !== "drop" && (
              <NodeHeader className="absolute -top-3 mb-1.5 border-none bg-transparent p-0!">
                <NodeTitle className="font-mono font-normal text-[9px] text-muted-foreground">
                  {title}
                </NodeTitle>
              </NodeHeader>
            )}
            <NodeContent
              className={cn(
                "rounded-[14px] bg-card p-1 ring-1 ring-border",
                contentClassName
              )}
            >
              {disableDefaultSurface ? (
                children
              ) : (
                <div className="overflow-hidden rounded-xl border border-primary/35 bg-white shadow-[0_0_0_1px_rgba(139,92,246,0.2)]">
                  {children}
                </div>
              )}
            </NodeContent>
          </Node>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => duplicateNode(id)}>
            <CopyIcon size={6} />
            <span>Duplicate</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleFocus}>
            <EyeIcon size={6} />
            <span>Focus</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleDelete} variant="destructive">
            <TrashIcon size={6} />
            <span>Delete</span>
          </ContextMenuItem>
          {process.env.NODE_ENV === "development" && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleShowData}>
                <CodeIcon size={6} />
                <span>Show data</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <Dialog onOpenChange={setShowData} open={showData}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Node data</DialogTitle>
            <DialogDescription>
              Data for node{" "}
              <code className="rounded-sm bg-secondary px-2 py-1 font-mono">
                {id}
              </code>
            </DialogDescription>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-lg bg-white p-2 text-[10.5px] text-foreground">
            {JSON.stringify(data, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
};

