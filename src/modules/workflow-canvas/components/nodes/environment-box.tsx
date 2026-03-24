"use client";

import { NodeResizer, type NodeProps } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { DoorOpenIcon, PencilIcon } from "lucide-react";
import { useNodeOperations } from "@/modules/workflow-canvas/providers/node-operations";
import { CONTAINER_MIN_DIMENSIONS } from "@/modules/workflow-canvas/lib/policy-catalog";

type EnvironmentBoxData = {
  label?: string;
  description?: string;
  category?: string;
  componentType?: string;
};

type ContainerCategory = "zone" | "region" | "environment" | "compute";

const CONTAINER_CONFIGS: Record<ContainerCategory, {
  label: string;
  borderStyle: string;
  borderColor: string;
  bgColor: string;
  minWidth: number;
  minHeight: number;
  innerLabel: string;
  handleColor: string;
  headerBg: string;
}> = {
  zone: {
    label: "Zone",
    borderStyle: "border-[3px] border-solid",
    borderColor: "border-blue-600 dark:border-blue-400",
    bgColor: "bg-blue-50/60 dark:bg-blue-950/40",
    minWidth: CONTAINER_MIN_DIMENSIONS.zone.width,
    minHeight: CONTAINER_MIN_DIMENSIONS.zone.height,
    innerLabel: "Drag regions into this zone",
    handleColor: "border-blue-500 shadow-[0_0_0_3px_rgba(59,130,246,0.22)]",
    headerBg: "bg-blue-100/80 dark:bg-blue-900/60",
  },
  region: {
    label: "Region",
    borderStyle: "border-[2.5px] border-solid",
    borderColor: "border-emerald-600 dark:border-emerald-400",
    bgColor: "bg-emerald-50/60 dark:bg-emerald-950/40",
    minWidth: CONTAINER_MIN_DIMENSIONS.region.width,
    minHeight: CONTAINER_MIN_DIMENSIONS.region.height,
    innerLabel: "Drag environments into this region",
    handleColor: "border-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.22)]",
    headerBg: "bg-emerald-100/80 dark:bg-emerald-900/60",
  },
  environment: {
    label: "Environment",
    borderStyle: "border-2 border-dashed",
    borderColor: "border-purple-500 dark:border-purple-400",
    bgColor: "bg-purple-50/50 dark:bg-purple-950/35",
    minWidth: CONTAINER_MIN_DIMENSIONS.environment.width,
    minHeight: CONTAINER_MIN_DIMENSIONS.environment.height,
    innerLabel: "Drag compute resources into this environment",
    handleColor: "border-purple-500 shadow-[0_0_0_3px_rgba(168,85,247,0.22)]",
    headerBg: "bg-purple-100/80 dark:bg-purple-900/60",
  },
  compute: {
    label: "Compute",
    borderStyle: "border-2 border-dotted",
    borderColor: "border-orange-500 dark:border-orange-400",
    bgColor: "bg-orange-50/50 dark:bg-orange-950/35",
    minWidth: CONTAINER_MIN_DIMENSIONS.compute.width,
    minHeight: CONTAINER_MIN_DIMENSIONS.compute.height,
    innerLabel: "Drag tech components into this compute resource",
    handleColor: "border-orange-500 shadow-[0_0_0_3px_rgba(249,115,22,0.22)]",
    headerBg: "bg-orange-100/80 dark:bg-orange-900/60",
  },
};

const resolveCategory = (
  dataCategory: string | undefined,
  nodeType: string | undefined
): ContainerCategory => {
  if (dataCategory === "zone" || String(nodeType).startsWith("zone-")) return "zone";
  if (dataCategory === "region" || String(nodeType).startsWith("region-")) return "region";
  if (dataCategory === "compute" || String(nodeType).startsWith("compute-")) return "compute";
  return "environment";
};

export const EnvironmentBoxNode = ({ data, id, selected, type }: NodeProps) => {
  const { updateNode } = useReactFlow();
  const { setActiveZoneId, activeZoneId } = useNodeOperations();
  const typedData = (data ?? {}) as EnvironmentBoxData;
  const category = resolveCategory(typedData.category, type);
  const config = CONTAINER_CONFIGS[category];
  const label = typedData.label ?? config.label;

  const handleRename = () => {
    const next = window.prompt(`Rename ${config.label.toLowerCase()}`, label);
    if (!next?.trim()) return;
    updateNode(id, { data: { ...(typedData ?? {}), label: next.trim() } });
  };

  return (
    <>
      <div
        className={`h-full w-full rounded-lg ${config.borderStyle} ${config.borderColor} ${config.bgColor} p-1 ${
          selected || activeZoneId === id ? "ring-2 ring-primary ring-offset-2" : ""
        }`}
        onClick={() => setActiveZoneId(id)}
        role="button"
        tabIndex={0}
      >
        <div className={`mb-0.5 flex items-center justify-between rounded-t px-1 py-0.5 ${config.headerBg}`}>
          <div className="min-w-0 flex-1">
            <p className="text-[7px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {config.label}
            </p>
            <p className="truncate text-[9px] font-semibold text-foreground">{label}</p>
          </div>
          <div className="flex shrink-0 items-center gap-px">
            <button
              className="rounded border border-slate-300 bg-white px-0.5 py-px hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              onClick={(e) => { e.stopPropagation(); handleRename(); }}
              type="button"
            >
              <PencilIcon className="h-1.5 w-1.5 text-slate-600 dark:text-slate-400" />
            </button>
            <button
              className="rounded border border-slate-300 bg-white px-0.5 py-px hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
              onClick={(e) => { e.stopPropagation(); setActiveZoneId(id); }}
              type="button"
            >
              <DoorOpenIcon className="h-1.5 w-1.5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
        </div>

        <div className="h-[calc(100%-1.5rem)] rounded border border-dashed border-slate-200/80 bg-white/30 p-0.5 text-[7px] text-slate-400 dark:border-slate-700 dark:bg-slate-800/30 dark:text-slate-500">
          {config.innerLabel}
        </div>
      </div>
      
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
        lineStyle={{ borderColor: "#ec4899", borderWidth: 1.5 }}
        minWidth={config.minWidth}
        minHeight={config.minHeight}
      />
    </>
  );
};
