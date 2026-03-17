"use client";

import { NodeResizer, type NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { DoorOpenIcon, PencilIcon } from "lucide-react";
import { useNodeOperations } from "@/modules/workflow-canvas/providers/node-operations";

type EnvironmentBoxData = {
  label?: string;
  description?: string;
  category?: string;
  componentType?: string;
};

export const EnvironmentBoxNode = ({ data, id, selected, type }: NodeProps) => {
  const { updateNode } = useReactFlow();
  const { setActiveZoneId, activeZoneId } = useNodeOperations();
  const typedData = (data ?? {}) as EnvironmentBoxData;
  const label = typedData.label ?? "Environment";
  const category =
    typedData.category === "zone" || String(type).startsWith("zone-")
      ? "zone"
      : "environment";
  const typeLabel =
    category === "environment" ? "Environment" : "Zone";

  const handleRename = () => {
    const next = window.prompt(`Rename ${typeLabel.toLowerCase()}`, label);

    if (!next || !next.trim()) {
      return;
    }

    updateNode(id, {
      data: {
        ...(typedData ?? {}),
        label: next.trim(),
      },
    });
  };

  return (
    <div
      className={`h-full w-full rounded-2xl border-2 border-dashed bg-white/90 p-3 ${
        selected || activeZoneId === id ? "border-primary" : "border-primary/40"
      }`}
      onClick={() => setActiveZoneId(id)}
      role="button"
      tabIndex={0}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={category === "environment" ? 720 : 240}
        minHeight={category === "environment" ? 420 : 180}
      />
      <div className="mb-2 flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <div>
          <p className="text-xs uppercase tracking-[0.12em] text-primary">{typeLabel}</p>
          <p className="text-sm font-semibold text-foreground">{label}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="rounded-md border border-primary/30 bg-white px-2 py-1 text-xs text-primary hover:bg-primary/5"
            onClick={(event) => {
              event.stopPropagation();
              handleRename();
            }}
            type="button"
          >
            <PencilIcon className="h-3.5 w-3.5" />
          </button>
          <button
            className="rounded-md border border-primary/30 bg-white px-2 py-1 text-xs text-primary hover:bg-primary/5"
            onClick={(event) => {
              event.stopPropagation();
              setActiveZoneId(id);
            }}
            type="button"
          >
            <DoorOpenIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="h-[calc(100%-3.5rem)] rounded-lg border border-dashed border-zinc-300 bg-white/80 p-2 text-xs text-zinc-500">
        {category === "environment"
          ? "Drag zones here. Components must be placed inside zones."
          : "Drag workload components here. Zone stays attached to its environment."}
      </div>
    </div>
  );
};
