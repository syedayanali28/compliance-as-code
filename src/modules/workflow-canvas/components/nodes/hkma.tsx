import type { NodeProps } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import {
  BracesIcon,
  CloudIcon,
  DatabaseIcon,
  FlameIcon,
  GlobeIcon,
  LayersIcon,
  LockIcon,
  NetworkIcon,
  PackageIcon,
  ShieldCheckIcon,
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
  selected?: boolean;
}

const iconByType: Record<string, LucideIcon> = {
  environment: SquareStackIcon,
  "zone-dmz": ShieldIcon,
  "zone-oa": NetworkIcon,
  "zone-internet": GlobeIcon,
  "zone-public": GlobeIcon,
  "zone-box": ShieldIcon,
  "zone-public-network": GlobeIcon,
  "zone-private-network": NetworkIcon,
  "zone-internal": NetworkIcon,
  "zone-aws-private-cloud": CloudIcon,
  "control-firewall": WaypointsIcon,
  "control-proxy": WaypointsIcon,
  "control-proxy-public": ShieldCheckIcon,
  "control-proxy-internal": LockIcon,
  "control-firewall-external": ShieldCheckIcon,
  "control-firewall-internal": LockIcon,
  "resource-app": ServerIcon,
  "resource-db": DatabaseIcon,
  "database-postgres": DatabaseIcon,
  "database-mysql": DatabaseIcon,
  "backend-nodejs": ServerIcon,
  "backend-fastapi": BracesIcon,
  "backend-flask": BracesIcon,
  "backend-dotnet": PackageIcon,
  "frontend-nextjs": LayersIcon,
  "frontend-gradio": LayersIcon,
};

const categoryBadgeClass: Record<string, string> = {
  environment: "border-cyan-300/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-200",
  zone: "border-emerald-300/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  control: "border-amber-300/50 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  resource: "border-violet-300/50 bg-violet-500/10 text-violet-700 dark:text-violet-200",
  backend: "border-indigo-300/50 bg-indigo-500/10 text-indigo-700",
  frontend: "border-pink-300/50 bg-pink-500/10 text-pink-700",
  database: "border-sky-300/50 bg-sky-500/10 text-sky-700",
  integration: "border-slate-300/50 bg-slate-500/10 text-slate-700",
};

const zoneLabel: Record<string, string> = {
  "oa-baremetal": "OA Network - Baremetal",
  "oa-private-cloud": "OA Network - Private Cloud",
  "oa-app-dmz": "OA Network - App DMZ",
  "dmz": "DMZ",
  "aws-landing-zone": "AWS Landing Zone",
  // Legacy zone keys for backwards compatibility
  "oa": "OA / Intranet",
  "internet": "Internet",
  "public-network": "Public Network",
  "internal-network": "Internal Network",
  "private-network": "Private Network (Internal/OA)",
  "aws-private-cloud": "AWS Private Cloud",
};

const MetaPills = ({ data }: { data: HkmaNodeData }) => (
  <div className="flex flex-wrap items-center gap-0.5 text-[7.5px]">
    <span
      className={cn(
        "rounded border px-0.5 py-px font-medium",
        categoryBadgeClass[data.category] ??
          "border-border/50 bg-muted/40 text-foreground"
      )}
    >
      {data.category}
    </span>
    {data.zone ? (
      <span className="rounded border border-primary/30 bg-background/80 px-0.5 py-px font-medium">
        {zoneLabel[data.zone] ?? String(data.zone)}
      </span>
    ) : null}
    {data.componentType ? (
      <span className="rounded border border-border/60 bg-background/80 px-0.5 py-px text-muted-foreground">
        {data.componentType}
      </span>
    ) : null}
    {data.componentKey ? (
      <span
        className="rounded border border-violet-300/50 bg-violet-50/90 px-0.5 py-px font-mono text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
        title="Component key"
      >
        {data.componentKey}
      </span>
    ) : null}
    {data.category !== "zone" && data.environmentLabel ? (
      <span className="rounded border border-fuchsia-300/70 bg-fuchsia-50/90 px-0.5 py-px text-fuchsia-700 dark:border-fuchsia-800 dark:bg-fuchsia-950/50 dark:text-fuchsia-300">
        Env: {data.environmentLabel}
      </span>
    ) : null}
    {data.zoneLabel ? (
      <span className="rounded border border-rose-300/70 bg-rose-50/90 px-0.5 py-px text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
        Zone: {data.zoneLabel}
      </span>
    ) : null}
    {data.category !== "zone" && data.locationSummary ? (
      <span className="max-w-full truncate rounded border border-border/50 bg-muted/40 px-0.5 py-px text-muted-foreground">
        {data.locationSummary}
      </span>
    ) : null}
    {typeof data.instanceNumber === "number" ? (
      <span className="rounded border border-slate-300/70 bg-slate-100/80 px-0.5 py-px text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        #{data.instanceNumber}
      </span>
    ) : null}
  </div>
);

const CustomFields = ({ data }: { data: HkmaNodeData }) => {
  if (!data.customFields || Object.keys(data.customFields).length === 0) {
    return null;
  }

  return (
    <div className="rounded border border-border/60 bg-background/70 p-0.5">
      <p className="mb-px text-[7.5px] font-semibold uppercase text-muted-foreground">
        Custom
      </p>
      <div className="space-y-px text-[7.5px]">
        {Object.entries(data.customFields).map(([key, value]) => (
          <div
            className="flex items-start justify-between gap-0.5 rounded border border-border/40 bg-card px-0.5 py-px"
            key={key}
          >
            <span className="font-medium text-foreground">{key}</span>
            <span className="text-right text-muted-foreground">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/** Pills + custom fields for workload components (not environment/zone chrome). */
const ComponentDetailPills = ({ data }: { data: HkmaNodeData }) => (
  <div className="mt-0.5 space-y-0.5">
    {/* <MetaPills data={data} /> */}
    <CustomFields data={data} />
  </div>
);

export const HkmaNode = ({ id, type, data, selected }: HkmaNodeProps) => {
  const Icon = iconByType[type] ?? SquareStackIcon;
  const isFirewall = type.includes("firewall");
  const isDatabase = data.category === "database" || type.includes("database");
  const isBackend = data.category === "backend";
  const isFrontend = data.category === "frontend";
  const isResource = data.category === "resource";
  const isIntegration = data.category === "integration";

  const isWorkspaceChrome =
    data.category === "environment" || data.category === "zone";

  const renderFirewallNode = () => (
    <>
      <div className="relative h-full w-full overflow-hidden rounded border border-violet-500 bg-white px-1 py-0.5 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-0.5">
          <p className="text-[9px] font-semibold leading-tight text-foreground">{data.label}</p>
          <FlameIcon className="size-1.5 text-rose-600" />
        </div>
        {data.description && (
          <p className="mt-px text-[7.5px] text-muted-foreground">{data.description}</p>
        )}
        <ComponentDetailPills data={data} />
      </div>
      <NodeResizer
        isVisible={selected}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 999,
          border: "1.5px solid #ec4899",
          background: "#ffffff",
          boxShadow: "0 0 0 2px rgba(236, 72, 153, 0.2)",
        }}
        lineStyle={{ borderColor: "#ec4899", borderWidth: 1.5 }}
        minWidth={40}
        minHeight={30}
      />
    </>
  );

  const renderDatabaseNode = () => (
    <>
      <div className="h-full w-full rounded border border-sky-500 bg-white px-1 py-0.5 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-0.5">
          <p className="text-[9px] font-semibold leading-tight text-foreground">{data.label}</p>
          <Icon className="size-1.5 text-sky-600" />
        </div>
        {data.description && (
          <p className="mt-px text-[7.5px] text-muted-foreground">{data.description}</p>
        )}
        <ComponentDetailPills data={data} />
      </div>
      <NodeResizer
        isVisible={selected}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 999,
          border: "1.5px solid #ec4899",
          background: "#ffffff",
          boxShadow: "0 0 0 2px rgba(236, 72, 153, 0.2)",
        }}
        lineStyle={{ borderColor: "#ec4899", borderWidth: 1.5 }}
        minWidth={40}
        minHeight={30}
      />
    </>
  );

  const renderBackendNode = () => (
    <>
      <div className="h-full w-full rounded border border-indigo-500 bg-white px-1 py-0.5 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-0.5">
          <p className="text-[9px] font-semibold leading-tight text-foreground">{data.label}</p>
          <Icon className="size-1.5 text-indigo-600" />
        </div>
        {data.description && (
          <p className="mt-px text-[7.5px] text-muted-foreground">{data.description}</p>
        )}
        <ComponentDetailPills data={data} />
      </div>
      <NodeResizer
        isVisible={selected}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 999,
          border: "1.5px solid #ec4899",
          background: "#ffffff",
          boxShadow: "0 0 0 2px rgba(236, 72, 153, 0.2)",
        }}
        lineStyle={{ borderColor: "#ec4899", borderWidth: 1.5 }}
        minWidth={40}
        minHeight={30}
      />
    </>
  );

  const renderFrontendNode = () => (
    <>
      <div className="h-full w-full rounded border border-pink-500 bg-white px-1 py-0.5 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-0.5">
          <p className="text-[9px] font-semibold leading-tight text-foreground">{data.label}</p>
          <Icon className="size-1.5 text-pink-600" />
        </div>
        {data.description && (
          <p className="mt-px text-[7.5px] text-muted-foreground">{data.description}</p>
        )}
        <ComponentDetailPills data={data} />
      </div>
      <NodeResizer
        isVisible={selected}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 999,
          border: "1.5px solid #ec4899",
          background: "#ffffff",
          boxShadow: "0 0 0 2px rgba(236, 72, 153, 0.2)",
        }}
        lineStyle={{ borderColor: "#ec4899", borderWidth: 1.5 }}
        minWidth={40}
        minHeight={30}
      />
    </>
  );

  const renderResourceNode = () => (
    <>
      <div className="h-full w-full rounded border border-violet-500 bg-white px-1 py-0.5 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-0.5">
          <p className="text-[9px] font-semibold leading-tight text-foreground">{data.label}</p>
          <Icon className="size-1.5 text-violet-600" />
        </div>
        {data.description && (
          <p className="mt-px text-[7.5px] text-muted-foreground">{data.description}</p>
        )}
        <ComponentDetailPills data={data} />
      </div>
      <NodeResizer
        isVisible={selected}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 999,
          border: "1.5px solid #ec4899",
          background: "#ffffff",
          boxShadow: "0 0 0 2px rgba(236, 72, 153, 0.2)",
        }}
        lineStyle={{ borderColor: "#ec4899", borderWidth: 1.5 }}
        minWidth={40}
        minHeight={30}
      />
    </>
  );

  const renderIntegrationNode = () => (
    <>
      <div className="h-full w-full rounded border border-slate-500 bg-white px-1 py-0.5 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-0.5">
          <p className="text-[9px] font-semibold leading-tight text-foreground">{data.label}</p>
          <Icon className="size-1.5 text-slate-600" />
        </div>
        {data.description && (
          <p className="mt-px text-[7.5px] text-muted-foreground">{data.description}</p>
        )}
        <ComponentDetailPills data={data} />
      </div>
      <NodeResizer
        isVisible={selected}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 999,
          border: "1.5px solid #ec4899",
          background: "#ffffff",
          boxShadow: "0 0 0 2px rgba(236, 72, 153, 0.2)",
        }}
        lineStyle={{ borderColor: "#ec4899", borderWidth: 1.5 }}
        minWidth={40}
        minHeight={30}
      />
    </>
  );

  const renderDefaultNode = () => (
    <>
      <div className="h-full w-full rounded border border-slate-300 bg-white px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-0.5">
          <p className="text-[9px] font-semibold leading-tight">{data.label}</p>
          <Icon className="size-1.5 text-slate-600" />
        </div>
        {data.description && (
          <p className="mt-px text-[7.5px] text-muted-foreground">{data.description}</p>
        )}
        {isWorkspaceChrome ? (
          <div className="mt-0.5">
             <MetaPills data={data} />
          </div>
        ) : (
          <ComponentDetailPills data={data} />
        )}
      </div>
      <NodeResizer
        isVisible={selected}
        handleStyle={{
          width: 10,
          height: 10,
          borderRadius: 999,
          border: "1.5px solid #ec4899",
          background: "#ffffff",
          boxShadow: "0 0 0 2px rgba(236, 72, 153, 0.2)",
        }}
        lineStyle={{ borderColor: "#ec4899", borderWidth: 1.5 }}
        minWidth={40}
        minHeight={30}
      />
    </>
  );

  let body = renderDefaultNode();

  if (isFirewall) {
    body = renderFirewallNode();
  } else if (isDatabase) {
    body = renderDatabaseNode();
  } else if (isBackend) {
    body = renderBackendNode();
  } else if (isFrontend) {
    body = renderFrontendNode();
  } else if (isResource) {
    body = renderResourceNode();
  } else if (isIntegration) {
    body = renderIntegrationNode();
  }

  return (
    <NodeLayout
      contentClassName="rounded border-none bg-transparent p-0 ring-0"
      data={data}
      disableDefaultSurface
      id={id}
      title={data.category.toUpperCase()}
      type={type}
    >
      {body}
    </NodeLayout>
  );
};
