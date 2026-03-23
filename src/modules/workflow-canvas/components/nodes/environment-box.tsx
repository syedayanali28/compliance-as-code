"use client";

import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
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
  const category =
    typedData.category === "zone" || String(type).startsWith("zone-")
      ? "zone"
      : "environment";
  const label =
    typedData.label ?? (category === "environment" ? "Environment" : "Zone");
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
      className={`h-full w-full rounded border border-dashed bg-white/90 p-1 dark:bg-slate-900/90 ${
        selected || activeZoneId === id ? "border-primary" : "border-slate-300 dark:border-slate-700"
      }`}
      onClick={() => {
        if (category === "zone") {
          setActiveZoneId(id);
        } else {
          setActiveZoneId(undefined);
        }
      }}
      role="button"
      tabIndex={0}
    >
      {category === "zone" && (
        <>
          <Handle
            className="-ml-1.5 h-5 w-5 border-[1.5px] border-emerald-500 bg-white shadow-[0_0_0_3px_rgba(16,185,129,0.22)]"
            position={Position.Left}
            type="target"
          />
          <Handle
            className="-mr-1.5 h-5 w-5 border-[1.5px] border-emerald-500 bg-white shadow-[0_0_0_3px_rgba(16,185,129,0.22)]"
            position={Position.Right}
            type="source"
          />
        </>
      )}
      <NodeResizer
        isVisible={selected}
        handleStyle={{
          width: 12,
          height: 12,
          borderRadius: 999,
          border: "1.5px solid #ec4899",
          background: "#ffffff",
          boxShadow: "0 0 0 2px rgba(236, 72, 153, 0.2)",
        }}
        lineStyle={{
          borderColor: "#ec4899",
          borderWidth: 1.5,
        }}
        minWidth={category === "environment" ? 320 : 110}
        minHeight={category === "environment" ? 190 : 85}
      />
      <div className="mb-0.5 flex items-center justify-between border-b border-slate-200 pb-0.5 dark:border-slate-700">
        <div>
          <p className="text-[7.5px] uppercase text-slate-500 dark:text-slate-400">{typeLabel}</p>
          <p className="text-[9px] font-semibold text-foreground">{label}</p>
        </div>
        <div className="flex items-center gap-px">
          <button
            className="rounded border border-slate-300 bg-white px-0.5 py-px hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            onClick={(event) => {
              event.stopPropagation();
              handleRename();
            }}
            type="button"
          >
            <PencilIcon className="h-1.5 w-1.5 text-slate-600 dark:text-slate-400" />
          </button>
          <button
            className="rounded border border-slate-300 bg-white px-0.5 py-px hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
            onClick={(event) => {
              event.stopPropagation();
              setActiveZoneId(id);
            }}
            type="button"
          >
            <DoorOpenIcon className="h-1.5 w-1.5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>
      </div>
      <div className="h-[calc(100%-1.25rem)] rounded border border-dashed border-slate-200 bg-slate-50/50 p-0.5 text-[7.5px] text-slate-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-400">
        {category === "environment"
          ? "Drag zones here"
          : "Drag components here"}
      </div>
    </div>
  );
};
