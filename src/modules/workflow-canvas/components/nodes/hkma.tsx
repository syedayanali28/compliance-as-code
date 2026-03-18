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

const zoneLabel = {
  dmz: "DMZ",
  oa: "OA / Intranet",
  internet: "Internet",
  "public-network": "Public Network",
  "internal-network": "Internal Network",
  "private-network": "Private Network (Internal/OA)",
  "aws-private-cloud": "AWS Private Cloud",
} as const;

const MetaPills = ({ data }: { data: HkmaNodeData }) => (
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
      <span className="rounded-full border border-primary/30 bg-background/80 px-2 py-1 font-medium">
        {zoneLabel[data.zone]}
      </span>
    ) : null}
    {data.componentType ? (
      <span className="rounded-full border border-border/60 bg-background/80 px-2 py-1 text-muted-foreground">
        {data.componentType}
      </span>
    ) : null}
    {data.environmentLabel ? (
      <span className="rounded-full border border-fuchsia-300/70 bg-fuchsia-50/90 px-2 py-1 text-fuchsia-700">
        Env: {data.environmentLabel}
      </span>
    ) : null}
    {data.zoneLabel ? (
      <span className="rounded-full border border-rose-300/70 bg-rose-50/90 px-2 py-1 text-rose-700">
        Zone: {data.zoneLabel}
      </span>
    ) : null}
    {typeof data.instanceNumber === "number" ? (
      <span className="rounded-full border border-slate-300/70 bg-slate-100/80 px-2 py-1 text-slate-700">
        Instance #{data.instanceNumber}
      </span>
    ) : null}
  </div>
);

const CustomFields = ({ data }: { data: HkmaNodeData }) => {
  if (!data.customFields || Object.keys(data.customFields).length === 0) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-2">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Custom Fields
      </p>
      <div className="space-y-1 text-xs">
        {Object.entries(data.customFields).map(([key, value]) => (
          <div
            className="flex items-start justify-between gap-2 rounded-md border border-border/40 bg-card px-2 py-1"
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

const NodeSummary = ({
  data,
  accentClass,
}: {
  data: HkmaNodeData;
  accentClass: string;
}) => (
  <>
    {data.description ? (
      <p className={cn("mb-3 text-xs leading-relaxed", accentClass)}>{data.description}</p>
    ) : null}
    <MetaPills data={data} />
    <div className="mt-3">
      <CustomFields data={data} />
    </div>
  </>
);

export const HkmaNode = ({ id, type, data }: HkmaNodeProps) => {
  const Icon = iconByType[type] ?? SquareStackIcon;
  const isFirewall = type.includes("firewall");
  const isDatabase = data.category === "database" || type.includes("database");
  const isBackend = data.category === "backend";
  const isFrontend = data.category === "frontend";
  const isResource = data.category === "resource";
  const isIntegration = data.category === "integration";

  const renderFirewallNode = () => (
    <div
      className="relative overflow-hidden border border-violet-300/70 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 px-4 py-4 shadow-[0_10px_28px_-18px_rgba(124,58,237,0.8)]"
      style={{ clipPath: "polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)" }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm leading-tight text-violet-950">{data.label}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-violet-700/80">Security Control</p>
        </div>
        <span className="inline-flex flex-col items-center gap-1 rounded-lg border border-violet-300 bg-white/80 p-2 text-violet-700">
          <span className="grid grid-cols-3 gap-[2px]">
            <span className="h-1.5 w-2 rounded-[2px] bg-violet-600" />
            <span className="h-1.5 w-2 rounded-[2px] bg-violet-700" />
            <span className="h-1.5 w-2 rounded-[2px] bg-violet-600" />
            <span className="h-1.5 w-2 rounded-[2px] bg-violet-700" />
            <span className="h-1.5 w-2 rounded-[2px] bg-violet-600" />
            <span className="h-1.5 w-2 rounded-[2px] bg-violet-700" />
          </span>
          <FlameIcon className="size-3.5 text-rose-600" />
        </span>
      </div>
      <NodeSummary accentClass="text-violet-950/80" data={data} />
    </div>
  );

  const renderDatabaseNode = () => (
    <div className="flex flex-col gap-2 px-2 py-2">
      <div className="mx-auto h-6 w-[88%] rounded-full border border-sky-300/70 bg-sky-100/80" />
      <div className="-mt-5 rounded-2xl border border-sky-300/70 bg-gradient-to-b from-sky-50 to-white px-4 pb-4 pt-6 shadow-[0_10px_24px_-18px_rgba(2,132,199,0.75)]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-sm leading-tight text-sky-900">{data.label}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.12em] text-sky-700/80">Data Store</p>
          </div>
          <span className="rounded-full border border-sky-300 bg-white/90 p-2 text-sky-700">
            <Icon className="size-4" />
          </span>
        </div>
        <NodeSummary accentClass="text-sky-900/80" data={data} />
      </div>
      <div className="mx-auto -mt-4 h-6 w-[88%] rounded-full border border-sky-300/70 bg-sky-100/80" />
    </div>
  );

  const renderBackendNode = () => (
    <div
      className="relative overflow-hidden border border-indigo-300/65 bg-gradient-to-br from-indigo-50 via-white to-blue-50 px-4 py-4 shadow-[0_14px_24px_-20px_rgba(79,70,229,0.8)]"
      style={{ clipPath: "polygon(8% 0%, 92% 0%, 100% 14%, 100% 86%, 92% 100%, 8% 100%, 0% 86%, 0% 14%)" }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm leading-tight text-indigo-950">{data.label}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-indigo-700/80">Backend Service</p>
        </div>
        <span className="rounded-md border border-indigo-300 bg-white/90 p-2 text-indigo-700">
          <Icon className="size-4" />
        </span>
      </div>
      <NodeSummary accentClass="text-indigo-950/80" data={data} />
    </div>
  );

  const renderFrontendNode = () => (
    <div className="relative rounded-[22px] border border-pink-300/65 bg-gradient-to-br from-pink-50 via-white to-rose-50 px-4 py-4 shadow-[0_14px_24px_-20px_rgba(219,39,119,0.8)]">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm leading-tight text-pink-950">{data.label}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-pink-700/80">Frontend Surface</p>
        </div>
        <span className="rounded-md border border-pink-300 bg-white/90 p-2 text-pink-700">
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mb-3 rounded-xl border border-pink-300/60 bg-white/80 p-2">
        <div className="h-1.5 w-12 rounded-full bg-pink-300/80" />
        <div className="mt-2 h-10 rounded-md border border-pink-200 bg-pink-50/70" />
      </div>
      <NodeSummary accentClass="text-pink-950/80" data={data} />
    </div>
  );

  const renderResourceNode = () => (
    <div className="relative overflow-hidden border border-violet-300/65 bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 px-4 py-4 shadow-[0_14px_24px_-20px_rgba(124,58,237,0.8)]">
      <div className="absolute right-0 top-0 h-8 w-8 border-b border-l border-violet-300/70 bg-violet-100/80" />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm leading-tight text-violet-950">{data.label}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-violet-700/80">Runtime Resource</p>
        </div>
        <span className="rounded-md border border-violet-300 bg-white/90 p-2 text-violet-700">
          <Icon className="size-4" />
        </span>
      </div>
      <NodeSummary accentClass="text-violet-950/80" data={data} />
    </div>
  );

  const renderIntegrationNode = () => (
    <div className="relative rounded-3xl border border-slate-300/70 bg-gradient-to-br from-slate-100 via-white to-cyan-50 px-4 py-4 shadow-[0_14px_24px_-20px_rgba(51,65,85,0.75)]">
      <div className="pointer-events-none absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-slate-400/70 bg-slate-200" />
      <div className="pointer-events-none absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border border-slate-400/70 bg-slate-200" />
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm leading-tight text-slate-900">{data.label}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.12em] text-slate-700/80">Integration Hub</p>
        </div>
        <span className="rounded-full border border-slate-300 bg-white/90 p-2 text-slate-700">
          <Icon className="size-4" />
        </span>
      </div>
      <NodeSummary accentClass="text-slate-900/80" data={data} />
    </div>
  );

  const renderDefaultNode = () => (
    <div className="flex flex-col gap-3 rounded-3xl border border-primary/35 bg-white px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-sm leading-tight">{data.label}</p>
          {data.description ? (
            <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
              {data.description}
            </p>
          ) : null}
        </div>
        <span className="rounded-xl border border-primary/40 bg-primary/10 p-2 text-primary">
          <Icon className="size-4" />
        </span>
      </div>
      <MetaPills data={data} />
      <CustomFields data={data} />
    </div>
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
      className="w-[18rem]"
      contentClassName="rounded-[20px] border-none bg-transparent p-0 ring-0"
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

