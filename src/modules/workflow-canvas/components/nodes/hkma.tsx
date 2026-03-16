import type { LucideIcon } from "lucide-react";
import {
  DatabaseIcon,
  GlobeIcon,
  NetworkIcon,
  ServerIcon,
  ShieldIcon,
  SquareStackIcon,
  WaypointsIcon,
} from "lucide-react";
import type { HkmaNodeData } from "@/modules/workflow-canvas/lib/hkma-graph";
import { cn } from "@/modules/workflow-canvas/lib/utils";
import { NodeLayout } from "./layout";

interface HkmaNodeProps {
  id: string;
  type: string;
  data: HkmaNodeData;
}

const iconByType: Record<string, LucideIcon> = {
  environment: SquareStackIcon,
  "zone-dmz": ShieldIcon,
  "zone-oa": NetworkIcon,
  "zone-internet": GlobeIcon,
  "control-firewall": WaypointsIcon,
  "control-proxy": WaypointsIcon,
  "resource-app": ServerIcon,
  "resource-db": DatabaseIcon,
};

const categoryBadgeClass: Record<string, string> = {
  environment: "border-cyan-300/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  zone: "border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  control: "border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  resource: "border-violet-300/50 bg-violet-500/10 text-violet-700 dark:text-violet-200",
};

const zoneLabel = {
  dmz: "DMZ",
  oa: "OA / Intranet",
  internet: "Internet",
} as const;

export const HkmaNode = ({ id, type, data }: HkmaNodeProps) => {
  const Icon = iconByType[type] ?? SquareStackIcon;

  return (
    <NodeLayout
      className="w-[22rem]"
      data={data}
      id={id}
      title={data.category.toUpperCase()}
      type={type}
    >
      <div className="flex flex-col gap-3 rounded-3xl border border-border/70 bg-card px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-base leading-tight">{data.label}</p>
            {data.description ? (
              <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                {data.description}
              </p>
            ) : null}
          </div>
          <span className="rounded-xl border border-border/70 bg-muted/60 p-2">
            <Icon className="size-4" />
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span
            className={cn(
              "rounded-full border px-2 py-1 font-medium",
              categoryBadgeClass[data.category] ??
                "border-border/50 bg-muted/40 text-foreground"
            )}
          >
            {data.category}
          </span>
          {data.zone ? (
            <span className="rounded-full border border-border/60 bg-background px-2 py-1 font-medium">
              {zoneLabel[data.zone]}
            </span>
          ) : null}
          {data.componentType ? (
            <span className="rounded-full border border-border/60 bg-background px-2 py-1 text-muted-foreground">
              {data.componentType}
            </span>
          ) : null}
        </div>
      </div>
    </NodeLayout>
  );
};

