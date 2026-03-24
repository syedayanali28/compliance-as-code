import { useReactFlow, type XYPosition } from "@xyflow/react";
import { nanoid } from "nanoid";
import { useEffect, useRef } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/modules/workflow-canvas/components/ui/command";
import { useNodeOperations } from "@/modules/workflow-canvas/providers/node-operations";
import { NodeLayout } from "./layout";

interface DropNodeProps {
  data: {
    isSource?: boolean;
    position: XYPosition;
  };
  id: string;
}

export const DropNode = ({ data, id }: DropNodeProps) => {
  const { deleteElements, getNode, addEdges, getNodeConnections } =
    useReactFlow();
  const { addNode, nodeButtons } = useNodeOperations();
  const ref = useRef<HTMLDivElement>(null);

  const handleSelect = (type: string, options?: Record<string, unknown>) => {
    // Get the position of the current node
    const currentNode = getNode(id);
    const position = currentNode?.position || { x: 0, y: 0 };
    const sourceNodes = getNodeConnections({
      nodeId: id,
    });

    const { data: nodeData, ...rest } = options ?? {};

    const addResult = addNode(type, {
      position,
      data: {
        ...(nodeData ? nodeData : {}),
      },
      origin: [0, 0.5],
      ...rest,
    });

    if (!addResult.ok) {
      return;
    }

    const newNodeId = addResult.nodeId;

    deleteElements({
      nodes: [{ id }],
    });

    for (const sourceNode of sourceNodes) {
      addEdges({
        id: nanoid(),
        source: data.isSource ? newNodeId : sourceNode.source,
        target: data.isSource ? sourceNode.source : newNodeId,
        type: "animated",
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // Delete the drop node when Escape is pressed
        deleteElements({
          nodes: [{ id }],
        });
      }
    };

    const handleClick = (event: MouseEvent) => {
      // Get the DOM element for this node
      const nodeElement = ref.current;

      // Check if the click was outside the node
      if (nodeElement && !nodeElement.contains(event.target as Node)) {
        deleteElements({
          nodes: [{ id }],
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    setTimeout(() => {
      window.addEventListener("click", handleClick);
    }, 50);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClick);
    };
  }, [deleteElements, id]);

  return (
    <div ref={ref}>
      <NodeLayout data={data} id={id} title="Add a new node" type="drop">
        <Command className="rounded-lg">
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup heading="Add node">
              {nodeButtons.map((button) => (
                <CommandItem
                  key={button.id}
                  onSelect={() =>
                    handleSelect(button.id, {
                      data: button.data,
                    })
                  }
                >
                  <button.icon size={8} />
                  {button.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </NodeLayout>
    </div>
  );
};

