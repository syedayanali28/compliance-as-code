"use client";

import type { Edge, Node } from "@xyflow/react";
import { useEdges, useNodes, useReactFlow } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  BoxesIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  FolderOpenIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  FlameIcon,
  LayoutGrid,
  Maximize2,
  PlusCircleIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DEFAULT_EDGE_METADATA,
  getEdgeMetadata,
  type EdgeConnectionType,
  type EdgeDirectionality,
  type EdgeLineStyle,
} from "@/modules/workflow-canvas/lib/edge-metadata";
import type { AddNodeResult } from "@/modules/workflow-canvas/lib/add-node-result";
import {
  validateConnectionByPolicies,
  type ComponentCategory,
} from "@/modules/workflow-canvas/lib/policy-catalog";
import {
  exportCanvasAsIdacTemplateExcel,
  exportCanvasAsExcel,
  exportCanvasAsJpeg,
  exportCanvasAsPng,
} from "@/modules/workflow-canvas/lib/export";
import {
  extractFirewallRequests,
  type FirewallRequestRow,
} from "@/modules/workflow-canvas/lib/firewall-requests";
import { useCanvasSidebarWidths } from "@/modules/workflow-canvas/hooks/use-canvas-sidebar-widths";
import { useCanvasPreferences } from "@/modules/workflow-canvas/providers/canvas-preferences";
import { useNodeOperations } from "@/modules/workflow-canvas/providers/node-operations";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import { LeftSidebar } from "./left-sidebar";
import { SidebarTabs } from "./sidebar-tabs";
import { TopMenuBar } from "./top-menu-bar";

interface DesignSummary {
  id: string;
  design_id?: string;
  master_id?: string;
  name: string;
  team_slug?: string;
  project_code?: string;
  design_key?: string;
  version?: number;
  gitlab_path?: string | null;
  created_at: string;
  updated_at: string;
}

interface VersionSummary {
  id: string;
  design_id?: string;
  master_id: string;
  version: number;
  created_at?: string;
  updated_at?: string;
  name?: string;
}

interface DesignPayload {
  id: string;
  design_id?: string;
  name: string;
  team_slug?: string;
  project_code?: string;
  design_key?: string;
  version?: number;
  gitlab_path?: string | null;
  nodes: Node[];
  edges: Edge[];
}

const WORKFLOW_CANVAS_OWNER_STORAGE_KEY = "workflow-canvas-owner-id";
const WORKFLOW_CANVAS_OWNER_HEADER = "x-workflow-canvas-owner-id";

type CreateBoxKind = "component" | "container";

type ContainerTier = "zone" | "region" | "environment" | "compute";

const CREATE_BOX_KIND_OPTIONS: { value: CreateBoxKind; label: string }[] = [
  { value: "component", label: "Component (tech node)" },
  { value: "container", label: "Container (zone / region / environment / compute)" },
];

/** Catalog selectors used only to pick React Flow node type + default sizing; labels/metadata are overridden. */
const CONTAINER_TEMPLATE_BY_TIER: Record<ContainerTier, string> = {
  zone: "zone-oa-baremetal",
  region: "region-ifc",
  environment: "environment-prod",
  compute: "compute-vm",
};

const CREATE_BOX_COMPONENT_CATEGORIES: {
  value: ComponentCategory;
  label: string;
}[] = [
  { value: "iam", label: "IAM" },
  { value: "orchestration", label: "Orchestration" },
  { value: "ai", label: "AI/ML" },
  { value: "security", label: "Security" },
  { value: "monitoring", label: "Monitoring" },
  { value: "storage", label: "Storage" },
  { value: "cicd", label: "CI/CD" },
  { value: "database", label: "Database" },
  { value: "backend", label: "Backend" },
  { value: "frontend", label: "Frontend" },
  { value: "integration", label: "Integration" },
];

const CREATE_BOX_CONTAINER_TIERS: { value: ContainerTier; label: string }[] = [
  { value: "zone", label: "Zone" },
  { value: "region", label: "Region" },
  { value: "environment", label: "Environment" },
  { value: "compute", label: "Compute" },
];

const slugifyLabel = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9-]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-|-$/g, "");

interface AddTabProps {
  onAddNode: (selector: string, options?: Record<string, unknown>) => AddNodeResult;
  onOpenCreateBox: () => void;
  zoneOptions: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    data: Record<string, unknown>;
  }>;
  regionOptions: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    data: Record<string, unknown>;
  }>;
  environmentOptions: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    data: Record<string, unknown>;
  }>;
  computeOptions: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    data: Record<string, unknown>;
  }>;
  componentGroups: Array<{
    id: ComponentGroupId;
    label: string;
    options: Array<{
      id: string;
      label: string;
      icon: LucideIcon;
      data: Record<string, unknown>;
    }>;
  }>;
  onAddWildcard: (label: string, description: string) => void;
}

type ComponentGroupId = "iam" | "orchestration" | "ai" | "security" | "monitoring" | "storage" | "cicd" | "database" | "backend" | "frontend" | "integration";

const AddTab = ({
  onAddNode,
  onOpenCreateBox,
  environmentOptions,
  zoneOptions,
  regionOptions,
  computeOptions,
  componentGroups,
  onAddWildcard,
}: AddTabProps) => {
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [selectedRegionId, setSelectedRegionId] = useState("");
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");
  const [selectedComputeId, setSelectedComputeId] = useState("");
  const [activeComponentGroup, setActiveComponentGroup] = useState<ComponentGroupId>("database");
  const [componentSearch, setComponentSearch] = useState("");
  const [selectedComponentByGroup, setSelectedComponentByGroup] = useState<Record<string, string>>({});
  const [selectedSearchComponentId, setSelectedSearchComponentId] = useState("");
  const [recentComponentIds, setRecentComponentIds] = useState<string[]>([]);
  const [wildcardLabel, setWildcardLabel] = useState("");
  const [wildcardDescription, setWildcardDescription] = useState("");
  const [diagramPaletteFeedback, setDiagramPaletteFeedback] = useState<{
    level: "error" | "warning";
    title: string;
    message: string;
  } | null>(null);

  const runDiagramAdd = useCallback(
    (selector: string, options?: Record<string, unknown>) => {
      const result = onAddNode(selector, options);
      if (!result.ok) {
        setDiagramPaletteFeedback({
          level: result.level,
          title: result.title,
          message: result.message,
        });
      } else {
        setDiagramPaletteFeedback(null);
      }
      return result;
    },
    [onAddNode]
  );

  useEffect(() => {
    if (!selectedZoneId && zoneOptions[0]) setSelectedZoneId(zoneOptions[0].id);
  }, [zoneOptions, selectedZoneId]);

  useEffect(() => {
    if (!selectedRegionId && regionOptions[0]) setSelectedRegionId(regionOptions[0].id);
  }, [regionOptions, selectedRegionId]);

  useEffect(() => {
    if (!selectedEnvironmentId && environmentOptions[0]) setSelectedEnvironmentId(environmentOptions[0].id);
  }, [environmentOptions, selectedEnvironmentId]);

  useEffect(() => {
    if (!selectedComputeId && computeOptions[0]) setSelectedComputeId(computeOptions[0].id);
  }, [computeOptions, selectedComputeId]);

  const currentComponentGroup =
    componentGroups.find((group) => group.id === activeComponentGroup) ??
    componentGroups[0];

  const allComponentOptions = componentGroups.flatMap((group) => group.options);
  const normalizedSearch = componentSearch.trim().toLowerCase();
  const searchMode = normalizedSearch.length > 0;

  const filteredComponentOptions = useMemo(() => {
    if (!searchMode) return currentComponentGroup?.options ?? [];
    return allComponentOptions.filter((option) =>
      `${option.label} ${option.id}`.toLowerCase().includes(normalizedSearch)
    );
  }, [allComponentOptions, currentComponentGroup, normalizedSearch, searchMode]);

  useEffect(() => {
    if (!searchMode) { setSelectedSearchComponentId(""); return; }
    if (!selectedSearchComponentId && filteredComponentOptions[0]) {
      setSelectedSearchComponentId(filteredComponentOptions[0].id);
      return;
    }
    if (selectedSearchComponentId && !filteredComponentOptions.some((o) => o.id === selectedSearchComponentId)) {
      setSelectedSearchComponentId(filteredComponentOptions[0]?.id ?? "");
    }
  }, [filteredComponentOptions, searchMode, selectedSearchComponentId]);

  const selectedComponentId = searchMode
    ? selectedSearchComponentId || filteredComponentOptions[0]?.id || ""
    : selectedComponentByGroup[currentComponentGroup?.id ?? ""] ??
      filteredComponentOptions[0]?.id ??
      currentComponentGroup?.options[0]?.id ?? "";

  const selectedComponentOption =
    filteredComponentOptions.find((o) => o.id === selectedComponentId) ??
    currentComponentGroup?.options.find((o) => o.id === selectedComponentId) ??
    filteredComponentOptions[0] ?? currentComponentGroup?.options[0];

  const recentComponentOptions = recentComponentIds
    .map((id) => allComponentOptions.find((o) => o.id === id))
    .filter((o): o is NonNullable<typeof o> => Boolean(o));

  const findGroupByOptionId = (optionId: string) =>
    componentGroups.find((c) => c.options.some((e) => e.id === optionId));

  const addRecentComponent = (id: string) => {
    setRecentComponentIds((c) => [id, ...c.filter((e) => e !== id)].slice(0, 6));
  };

  const hierarchySteps: Array<{
    num: number;
    label: string;
    options: typeof zoneOptions;
    selectedId: string;
    setSelectedId: (id: string) => void;
    addLabel: string;
  }> = [
    { num: 1, label: "Zone", options: zoneOptions, selectedId: selectedZoneId, setSelectedId: setSelectedZoneId, addLabel: "Add Zone" },
    { num: 2, label: "Region", options: regionOptions, selectedId: selectedRegionId, setSelectedId: setSelectedRegionId, addLabel: "Add Region" },
    { num: 3, label: "Environment", options: environmentOptions, selectedId: selectedEnvironmentId, setSelectedId: setSelectedEnvironmentId, addLabel: "Add Environment" },
    { num: 4, label: "Compute", options: computeOptions, selectedId: selectedComputeId, setSelectedId: setSelectedComputeId, addLabel: "Add Compute" },
  ];

  return (
    <div className="space-y-1.5">
      <p className="text-[9px] text-muted-foreground">
        Zone → Region → Environment → Compute → Tech Components
      </p>

      {diagramPaletteFeedback ? (
        <div
          aria-live="polite"
          className={
            diagramPaletteFeedback.level === "error"
              ? "flex gap-1.5 rounded-md border border-destructive/60 bg-destructive/10 px-2 py-1.5 text-[10px] text-destructive"
              : "flex gap-1.5 rounded-md border border-amber-500/55 bg-amber-500/10 px-2 py-1.5 text-[10px] text-amber-950 dark:border-amber-400/50 dark:bg-amber-400/10 dark:text-amber-50"
          }
          role="alert"
        >
          {diagramPaletteFeedback.level === "error" ? (
            <AlertCircleIcon aria-hidden className="mt-0.5 size-3 shrink-0" />
          ) : (
            <AlertTriangleIcon aria-hidden className="mt-0.5 size-3 shrink-0" />
          )}
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{diagramPaletteFeedback.title}</p>
            <p className="mt-0.5 leading-snug opacity-90">{diagramPaletteFeedback.message}</p>
          </div>
          <button
            aria-label="Dismiss"
            className="shrink-0 rounded p-0.5 hover:bg-background/60"
            onClick={() => setDiagramPaletteFeedback(null)}
            type="button"
          >
            <XIcon className="size-3 opacity-70" />
          </button>
        </div>
      ) : null}

      {hierarchySteps.map((step) => (
        <details className="rounded border border-border bg-muted/30" key={step.num} open={step.num <= 2}>
          <summary className="cursor-pointer px-1.5 py-1 text-[10px] font-medium hover:bg-muted/50">
            {step.num}. {step.label}
          </summary>
          <div className="space-y-1 p-1.5 pt-0">
            <select
              className="h-6 w-full rounded border border-input bg-background px-1 text-[10px]"
              onChange={(e) => step.setSelectedId(e.target.value)}
              value={step.selectedId}
            >
              {step.options.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <Button
              className="h-6 w-full rounded text-[10px]"
              onClick={() => {
                const sel = step.options.find((o) => o.id === step.selectedId);
                if (sel) runDiagramAdd(sel.id, { data: sel.data });
              }}
              size="sm"
              variant="ghost"
            >
              {step.addLabel}
            </Button>
          </div>
        </details>
      ))}

      <details className="rounded border border-border bg-muted/30" open>
        <summary className="cursor-pointer px-1.5 py-1 text-[10px] font-medium hover:bg-muted/50">
          5. Tech Components
        </summary>
        <div className="space-y-1 p-1.5 pt-0">
          <div className="grid grid-cols-2 gap-0.5">
            {componentGroups.map((group) => (
              <Button
                className="h-6 rounded text-[9px] px-1"
                key={group.id}
                onClick={() => setActiveComponentGroup(group.id)}
                size="sm"
                variant={activeComponentGroup === group.id ? "default" : "ghost"}
              >
                {group.label}
              </Button>
            ))}
          </div>

          <input
            className="h-6 w-full rounded border border-input bg-background px-1.5 text-[10px]"
            onChange={(e) => setComponentSearch(e.target.value)}
            placeholder="Search..."
            value={componentSearch}
          />

          {recentComponentOptions.length > 0 ? (
            <div className="rounded border border-border/70 bg-muted/30 p-1">
              <p className="mb-0.5 text-[9px] font-semibold text-muted-foreground">Recent</p>
              <div className="flex flex-wrap gap-0.5">
                {recentComponentOptions.map((option) => (
                  <button
                    className="rounded border border-input bg-background px-1 py-0.5 text-[9px] hover:bg-accent"
                    key={option.id}
                    onClick={() => {
                      const group = findGroupByOptionId(option.id);
                      if (!group) return;
                      setActiveComponentGroup(group.id);
                      setSelectedComponentByGroup((c) => ({ ...c, [group.id]: option.id }));
                    }}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-[1fr_auto] gap-1">
            <select
              className="h-6 rounded border border-input bg-background px-1 text-[10px]"
              onChange={(e) => {
                const nextId = e.target.value;
                if (searchMode) { setSelectedSearchComponentId(nextId); return; }
                setSelectedComponentByGroup((c) => ({ ...c, [currentComponentGroup?.id ?? ""]: nextId }));
              }}
              value={selectedComponentId}
            >
              {filteredComponentOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            <Button
              className="h-6 rounded text-[10px]"
              onClick={() => {
                if (!selectedComponentOption) return;
                const r = runDiagramAdd(selectedComponentOption.id, {
                  data: selectedComponentOption.data,
                });
                if (r.ok) {
                  addRecentComponent(selectedComponentOption.id);
                }
              }}
              size="sm"
              variant="ghost"
            >
              Add
            </Button>
          </div>
        </div>
      </details>

      <details className="rounded border border-border bg-muted/30">
        <summary className="cursor-pointer px-1.5 py-1 text-[10px] font-medium hover:bg-muted/50">
          Wildcard Box
        </summary>
        <div className="space-y-1 p-1.5 pt-0">
          <p className="text-[9px] text-muted-foreground">
            Generic component outside hierarchy
          </p>
          <input
            className="h-6 w-full rounded border border-input bg-background px-1.5 text-[10px]"
            onChange={(e) => setWildcardLabel(e.target.value)}
            placeholder="Component label"
            value={wildcardLabel}
          />
          <Textarea
            className="min-h-12 rounded text-[10px]"
            onChange={(e) => setWildcardDescription(e.target.value)}
            placeholder="Description (optional)"
            value={wildcardDescription}
          />
          <Button
            className="h-6 w-full rounded text-[10px]"
            onClick={() => {
              const label = wildcardLabel.trim();
              if (!label) { toast.error("Wildcard label is required."); return; }
              onAddWildcard(label, wildcardDescription.trim());
              setWildcardLabel("");
              setWildcardDescription("");
            }}
            variant="ghost"
          >
            <PlusCircleIcon size={10} className="mr-0.5" />
            Add Wildcard
          </Button>
        </div>
      </details>

      <Button
        className="h-10 w-full rounded-xl"
        onClick={onOpenCreateBox}
        variant="secondary"
      >
        <PlusCircleIcon size={16} />
        Create Box
      </Button>
    </div>
  );
};

interface RightToolbarProps {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  activeDesignId: string;
  selectedVersionId: string;
  designName: string;
  teamSlug: string;
  projectCode: string;
  activeVersion: number;
  gitlabPath: string;
  versions: VersionSummary[];
  metadataLocked: boolean;
  onDesignNameChange: (name: string) => void;
  onTeamSlugChange: (value: string) => void;
  onProjectCodeChange: (value: string) => void;
  onVersionChange: (versionId: string) => Promise<void>;
  onLoadDesign: (id: string, versionId?: string) => Promise<void>;
  onOpen: () => void;
  onNew: () => void;
  onSaveSupabase: () => void;
  onSaveLocal: () => void;
  onExportMachineExcel: () => void;
  onExportIdacTemplate: () => void;
  onExportPng: () => void;
  onExportJpeg: () => void;
}

const RightToolbar = ({
  isCollapsed,
  onToggleCollapsed,
  activeDesignId,
  selectedVersionId,
  designName,
  teamSlug,
  projectCode,
  activeVersion,
  gitlabPath,
  versions,
  metadataLocked,
  onDesignNameChange,
  onTeamSlugChange,
  onProjectCodeChange,
  onVersionChange,
  onLoadDesign,
  onOpen,
  onNew,
  onSaveSupabase,
  onSaveLocal,
  onExportMachineExcel,
  onExportIdacTemplate,
  onExportPng,
  onExportJpeg,
}: RightToolbarProps) => (
  <div
    className={`fixed right-0 top-10 bottom-0 z-[150] overflow-y-auto border-l border-border bg-card p-2 shadow-sm transition-all duration-150 ${
      isCollapsed ? "w-10" : "w-28"
    }`}
    onDoubleClick={(event) => event.stopPropagation()}
  >
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-1">
            {isCollapsed ? null : <p className="text-xs font-medium text-foreground">Workspace</p>}
            <Button className="h-7 w-7 rounded" onClick={onToggleCollapsed} size="icon" variant="ghost">
              {isCollapsed ? <ChevronsLeftIcon size={14} /> : <ChevronsRightIcon size={14} />}
            </Button>
          </div>

          {isCollapsed ? (
            <div className="space-y-1">
              <Button className="h-8 w-8 rounded" onClick={onOpen} size="icon" variant="ghost" title="Open">
                <FolderOpenIcon size={14} />
              </Button>
              <Button className="h-8 w-8 rounded" onClick={onNew} size="icon" variant="ghost" title="New">
                <PlusCircleIcon size={14} />
              </Button>
              <Button className="h-8 w-8 rounded" onClick={onSaveSupabase} size="icon" title="Save">
                <UploadIcon size={14} />
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-1.5 rounded border border-border bg-muted/30 p-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">File</p>
                <div className="grid grid-cols-2 gap-1">
                  <Button className="h-7 rounded text-[10px]" onClick={onOpen} size="sm" variant="ghost">
                    <FolderOpenIcon size={12} />
                    Open
                  </Button>
                  <Button className="h-7 rounded text-[10px]" onClick={onNew} size="sm" variant="ghost">
                    <PlusCircleIcon size={12} />
                    New
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 rounded border border-border bg-muted/30 p-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">Design</p>
                <Textarea
                  className="min-h-8 rounded text-xs"
                  disabled={metadataLocked}
                  onChange={(event) => onDesignNameChange(event.target.value)}
                  placeholder="Design name"
                  value={designName}
                />
                <div className="grid grid-cols-2 gap-1">
                  <input
                    className="h-7 rounded border border-input bg-background px-2 text-[10px]"
                    disabled={metadataLocked}
                    onChange={(event) => onTeamSlugChange(event.target.value)}
                    placeholder="Team"
                    value={teamSlug}
                  />
                  <input
                    className="h-7 rounded border border-input bg-background px-2 text-[10px]"
                    disabled={metadataLocked}
                    onChange={(event) => onProjectCodeChange(event.target.value)}
                    placeholder="Project"
                    value={projectCode}
                  />
                </div>
                {metadataLocked ? (
                  <p className="text-[9px] text-muted-foreground">Metadata locked</p>
                ) : null}
                <div className="rounded border border-border bg-muted/50 p-1.5 text-[9px] text-muted-foreground">
                  <p>v{Math.max(activeVersion, 1)}</p>
                  <p className="truncate">{gitlabPath || "(not saved)"}</p>
                </div>
              </div>

              <div className="space-y-1.5 rounded border border-border bg-muted/30 p-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">Save</p>
                <div className="grid grid-cols-2 gap-1">
                  <Button className="h-7 rounded text-[10px]" onClick={onSaveSupabase} size="sm">
                    <UploadIcon size={12} />
                    Save
                  </Button>
                  <Button className="h-7 rounded text-[10px]" onClick={onSaveLocal} size="sm" variant="ghost">
                    <DownloadIcon size={12} />
                    Local
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5 rounded border border-border bg-muted/30 p-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">Export</p>
                <div className="grid grid-cols-2 gap-1">
                  <Button className="h-7 rounded text-[10px]" onClick={onExportMachineExcel} size="sm" variant="ghost">
                    <FileSpreadsheetIcon size={12} />
                    Excel
                  </Button>
                  <Button className="h-7 rounded text-[10px]" onClick={onExportIdacTemplate} size="sm" variant="ghost">
                    <FileSpreadsheetIcon size={12} />
                    IDaC
                  </Button>
                  <Button className="h-7 rounded text-[10px]" onClick={onExportPng} size="sm" variant="ghost">
                    <DownloadIcon size={12} />
                    PNG
                  </Button>
                  <Button className="h-7 rounded text-[10px]" onClick={onExportJpeg} size="sm" variant="ghost">
                    <DownloadIcon size={12} />
                    JPEG
                  </Button>
                </div>
              </div>
            </>
      )}
    </div>
  </div>
);

// ---------------------------------------------------------------------------
// Firewall Requests live panel
// ---------------------------------------------------------------------------

const firewallTypeLabel: Record<string, string> = {
  external: "External",
  internal: "Internal",
};

const FirewallRequestsPanel = ({
  rows,
}: {
  rows: FirewallRequestRow[];
}) => {
  if (rows.length === 0) {
    return (
      <p className="text-[9px] text-muted-foreground">
        No cross-zone connections. Draw connections between components in different zones.
      </p>
    );
  }

  return (
    <div className="space-y-1">
      {rows.map((row, index) => (
        <div
          className="rounded border border-violet-200/70 bg-violet-50/60 p-1 text-[9px] dark:border-violet-800/70 dark:bg-violet-950/60"
          key={`${row.originalEdgeId}-${index}`}
        >
          <div className="mb-0.5 flex items-center gap-1 font-semibold text-violet-900 dark:text-violet-200">
            <FlameIcon className="size-2.5 text-rose-500" />
            <span className="text-[9px]">{firewallTypeLabel[row.firewallType] ?? row.firewallType}</span>
            <span className="ml-auto rounded-full bg-violet-100 px-1 py-0.5 text-[8px] font-medium text-violet-700 dark:bg-violet-900 dark:text-violet-200">
              {row.environment}
            </span>
          </div>
          <div className="text-[9px] text-muted-foreground">
            <span className="font-medium text-foreground">{row.sourceComponent}</span>
            <span> ({row.sourceZone})</span>
            <span className="mx-0.5">→</span>
            <span className="font-medium text-violet-800 dark:text-violet-400">{row.firewallComponent}</span>
            <span className="mx-0.5">→</span>
            <span className="font-medium text-foreground">{row.destComponent}</span>
            <span> ({row.destZone})</span>
          </div>
          <div className="mt-0.5 flex flex-wrap gap-0.5">
            <span className="rounded border border-border/50 bg-background px-1 py-0.5 text-[8px]">
              {row.protocol}
            </span>
            <span className="rounded border border-border/50 bg-background px-1 py-0.5 text-[8px]">
              {row.ports}
            </span>
            <span className="rounded border border-border/50 bg-background px-1 py-0.5 text-[8px]">
              {row.direction}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

interface ToolbarInnerProps {
  initialDesignId?: string;
}

export const ToolbarInner = ({ initialDesignId }: ToolbarInnerProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { getViewport, getNodes, getEdges, setNodes, setEdges, fitView } =
    useReactFlow();
  const { showGrid, setShowGrid } = useCanvasPreferences();
  const { addNode, activeZoneId, setActiveZoneId, nodeButtons, policyCatalog } = useNodeOperations();
  const edgesState = useEdges();
  const nodesState = useNodes();
  const [firewallPanelOpen, setFirewallPanelOpen] = useState(false);
  const { leftWidth, rightWidth, setLeftWidth, setRightWidth } =
    useCanvasSidebarWidths();

  const firewallRequests = useMemo(
    () => extractFirewallRequests(nodesState, edgesState),
    [nodesState, edgesState]
  );
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isRightToolbarCollapsed, setIsRightToolbarCollapsed] = useState(false);
  const [activeDesignId, setActiveDesignId] = useState<string>("");
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [designName, setDesignName] = useState("Untitled Diagram");
  const [teamSlug, setTeamSlug] = useState("default-team");
  const [projectCode, setProjectCode] = useState("default-project");
  const [activeVersion, setActiveVersion] = useState(1);
  const [gitlabPath, setGitlabPath] = useState("");
  const [searchName, setSearchName] = useState("");
  const [searchTeam, setSearchTeam] = useState("");
  const [searchProject, setSearchProject] = useState("");
  const [searchVersion, setSearchVersion] = useState("");
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [openResults, setOpenResults] = useState<DesignSummary[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createBoxKind, setCreateBoxKind] = useState<CreateBoxKind>("component");
  const [createBoxComponentCategory, setCreateBoxComponentCategory] =
    useState<ComponentCategory>("database");
  const [createBoxContainerTier, setCreateBoxContainerTier] =
    useState<ContainerTier>("zone");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeDescription, setNewNodeDescription] = useState("");
  const [newNodeFields, setNewNodeFields] = useState("{}");
  const [createBoxFeedback, setCreateBoxFeedback] = useState<{
    level: "error" | "warning";
    title: string;
    message: string;
  } | null>(null);
  const initialLoadHandled = useRef(false);

  const navigateToDesign = useCallback(
    (designId: string) => {
      if (!designId) {
        return;
      }

      const targetPath = `/workflow-canvas/${designId}`;
      if (pathname !== targetPath) {
        router.replace(targetPath);
      }
    },
    [pathname, router]
  );

  const getOwnerId = useCallback(() => {
    const existing = globalThis.localStorage.getItem(WORKFLOW_CANVAS_OWNER_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const created = crypto.randomUUID();
    globalThis.localStorage.setItem(WORKFLOW_CANVAS_OWNER_STORAGE_KEY, created);
    return created;
  }, []);

  const buildOwnerHeaders = useCallback(() => {
    const ownerId = getOwnerId();
    return {
      [WORKFLOW_CANVAS_OWNER_HEADER]: ownerId,
    };
  }, [getOwnerId]);

  const fetchDesigns = useCallback(async (filters?: {
    name?: string;
    teamSlug?: string;
    projectCode?: string;
    version?: string;
  }) => {
    const params = new URLSearchParams();
    if (filters?.name?.trim()) {
      params.set("name", filters.name.trim());
    }

    if (filters?.teamSlug?.trim()) {
      params.set("teamSlug", filters.teamSlug.trim());
    }

    if (filters?.projectCode?.trim()) {
      params.set("projectCode", filters.projectCode.trim());
    }

    if (filters?.version?.trim()) {
      params.set("version", filters.version.trim());
    }

    const hasFilters = params.toString().length > 0;
    const endpoint = hasFilters
      ? `/api/workflow-canvas/designs/search?${params.toString()}`
      : "/api/workflow-canvas/designs";

    const response = await fetch(endpoint, {
      method: "GET",
      cache: "no-store",
      headers: {
        ...buildOwnerHeaders(),
      },
    });

    if (!response.ok) {
      return [] as DesignSummary[];
    }

    const payload = (await response.json()) as {
      designs?: DesignSummary[];
      results?: DesignSummary[];
    };
    const sourceDesigns = hasFilters ? payload.results ?? [] : payload.designs ?? [];
    const normalized = sourceDesigns.map((design) => ({
      ...design,
      id: design.master_id ?? design.id,
    }));
    return normalized;
  }, [buildOwnerHeaders]);

  const normalizeHierarchySegment = useCallback((value: string, fallback: string) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9-]+/g, "-")
      .replaceAll(/-+/g, "-")
      .replaceAll(/^-|-$/g, "");

    return normalized || fallback;
  }, []);

  const parseApiError = async (response: Response, fallback: string) => {
    try {
      const payload = (await response.json()) as {
        error?: string;
        details?: string;
        remediation?: string;
        requestId?: string;
        phase?: string;
      };

      if (payload.error && payload.details) {
        const context = [payload.phase ? `phase=${payload.phase}` : null, payload.requestId ? `requestId=${payload.requestId}` : null]
          .filter(Boolean)
          .join(" ");

        const message = context
          ? `${payload.error}: ${payload.details} (${context})`
          : `${payload.error}: ${payload.details}`;

        return payload.remediation ? `${message} Hint: ${payload.remediation}` : message;
      }

      return payload.error ?? fallback;
    } catch {
      return fallback;
    }
  };

  const fetchLatestVersionNumber = useCallback(
    async (masterId: string) => {
      if (!masterId) {
        return 0;
      }

      const response = await fetch(`/api/workflow-canvas/designs/${masterId}/version`, {
        method: "GET",
        cache: "no-store",
        headers: {
          ...buildOwnerHeaders(),
        },
      });

      if (!response.ok) {
        throw new Error(await parseApiError(response, "Failed to fetch latest version"));
      }

      const payload = (await response.json()) as { latestVersion?: number };
      return Math.max(0, payload.latestVersion ?? 0);
    },
    [buildOwnerHeaders]
  );

  const saveDesignToDevice = useCallback(
    (version: number) => {
      const normalizedTeam = normalizeHierarchySegment(teamSlug, "default-team");
      const normalizedProject = normalizeHierarchySegment(projectCode, "default-project");
      const normalizedDesign = normalizeHierarchySegment(designName, "untitled-design");
      const payload = {
        metadata: {
          team: normalizedTeam,
          project: normalizedProject,
          design: normalizedDesign,
          version,
          savedAt: new Date().toISOString(),
        },
        graph: {
          nodes: getNodes(),
          edges: getEdges(),
        },
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });

      const filename = `${normalizedTeam}-${normalizedProject}-${normalizedDesign}-v${Math.max(version, 1)}.json`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    },
    [designName, getEdges, getNodes, normalizeHierarchySegment, projectCode, teamSlug]
  );

  useEffect(() => {
    void fetchDesigns();
  }, [fetchDesigns]);

  const canvasActionOptions = useMemo(() => {
    const normalizedButtons = nodeButtons
      .filter((button) => button.id !== "drop")
      .map((button) => ({
        id: button.id,
        label: button.label,
        icon: button.icon,
        data: button.data as Record<string, unknown>,
        category:
          typeof (button.data as Record<string, unknown>).category === "string"
            ? ((button.data as Record<string, unknown>).category as string).toLowerCase()
            : "",
      }));

    // Zone options
    const zoneOptions = normalizedButtons
      .filter((button) => button.category === "zone")
      .toSorted((a, b) => a.label.localeCompare(b.label));

    // Region options
    const regionOptions = normalizedButtons
      .filter((button) => button.category === "region")
      .toSorted((a, b) => a.label.localeCompare(b.label));

    // Environment options
    const environmentOptions = normalizedButtons
      .filter((button) => button.category === "environment")
      .toSorted((a, b) => a.label.localeCompare(b.label));

    // Compute options
    const computeOptions = normalizedButtons
      .filter((button) => button.category === "compute")
      .toSorted((a, b) => a.label.localeCompare(b.label));

    // Tech component groups
    const grouped = {
      iam: normalizedButtons
        .filter((button) => button.category === "iam")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      orchestration: normalizedButtons
        .filter((button) => button.category === "orchestration")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      ai: normalizedButtons
        .filter((button) => button.category === "ai")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      security: normalizedButtons
        .filter((button) => button.category === "security")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      monitoring: normalizedButtons
        .filter((button) => button.category === "monitoring")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      storage: normalizedButtons
        .filter((button) => button.category === "storage")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      cicd: normalizedButtons
        .filter((button) => button.category === "cicd")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      database: normalizedButtons
        .filter((button) => button.category === "database")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      backend: normalizedButtons
        .filter((button) => button.category === "backend")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      frontend: normalizedButtons
        .filter((button) => button.category === "frontend")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      integration: normalizedButtons
        .filter((button) => button.category === "integration")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
    };

    const componentGroups: Array<{
      id: ComponentGroupId;
      label: string;
      options: Array<{
        id: string;
        label: string;
        icon: LucideIcon;
        data: Record<string, unknown>;
      }>;
    }> = [
      { id: "iam", label: "IAM", options: grouped.iam },
      { id: "orchestration", label: "Orchestration", options: grouped.orchestration },
      { id: "ai", label: "AI/ML", options: grouped.ai },
      { id: "security", label: "Security", options: grouped.security },
      { id: "monitoring", label: "Monitoring", options: grouped.monitoring },
      { id: "storage", label: "Storage", options: grouped.storage },
      { id: "cicd", label: "CI/CD", options: grouped.cicd },
      { id: "database", label: "Database", options: grouped.database },
      { id: "backend", label: "Backend", options: grouped.backend },
      { id: "frontend", label: "Frontend", options: grouped.frontend },
      { id: "integration", label: "Integration", options: grouped.integration },
    ].filter((group) => group.options.length > 0);

    return {
      zoneOptions,
      regionOptions,
      environmentOptions,
      computeOptions,
      componentGroups,
    };
  }, [nodeButtons]);

  const handleAddNode = (
    type: string,
    options?: Record<string, unknown>
  ): AddNodeResult => {
    // Get the current viewport
    const viewport = getViewport();

    // Calculate the center of the current viewport
    const centerX =
      -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom;
    const centerY =
      -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom;

    const position = { x: centerX, y: centerY };
    const { data: nodeData, ...rest } = options ?? {};

    return addNode(type, {
      position,
      ...(nodeData ? { data: nodeData } : {}),
      ...rest,
    });
  };

  const handleAddWildcardNode = (label: string, description: string) => {
    const slug = label
      .trim()
      .toLowerCase()
      .replaceAll(/[^a-z0-9-]+/g, "-")
      .replaceAll(/-+/g, "-")
      .replaceAll(/^-|-$/g, "");

    const wildResult = handleAddNode("resource-app", {
      data: {
        label,
        description,
        category: "integration",
        componentType: "custom:wildcard",
        componentKey: `wildcard-${slug || crypto.randomUUID()}`,
        standalone: true,
      },
    });

    if (wildResult.ok) {
      toast.success("Wildcard box added");
    }
  };

  const parseCustomFields = () => {
    const raw = newNodeFields.trim();
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Custom fields must be a JSON object.");
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([key, value]) => [key, String(value)])
    );
  };

  const handleCreateBox = () => {
    const label = newNodeLabel.trim();
    if (!label) {
      toast.error("Enter a label.");
      return;
    }

    try {
      const customFields = parseCustomFields();
      const slug = slugifyLabel(label);
      const idSuffix = crypto.randomUUID().slice(0, 8);

      let createResult: AddNodeResult;
      if (createBoxKind === "component") {
        createResult = handleAddNode("resource-app", {
          data: {
            label,
            description: newNodeDescription.trim(),
            category: createBoxComponentCategory,
            componentKey: `custom-${createBoxComponentCategory}-${slug || idSuffix}-${idSuffix}`,
            componentType: `custom:${createBoxComponentCategory}:${slug || "component"}`,
            customFields,
          },
        });
      } else {
        const tier = createBoxContainerTier;
        const templateId = CONTAINER_TEMPLATE_BY_TIER[tier];
        createResult = handleAddNode(templateId, {
          data: {
            label,
            description: newNodeDescription.trim(),
            category: tier,
            componentKey: `custom-${tier}-${slug || idSuffix}-${idSuffix}`,
            componentType: `custom:${tier}:${slug || tier}`,
            customFields,
          },
        });
      }

      if (!createResult.ok) {
        setCreateBoxFeedback({
          level: createResult.level,
          title: createResult.title,
          message: createResult.message,
        });
        return;
      }

      setCreateBoxFeedback(null);
      setDialogOpen(false);
      setNewNodeLabel("");
      setNewNodeDescription("");
      setNewNodeFields("{}");
      toast.success("Box created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Invalid fields");
    }
  };

  const createDesign = async () => {
    const normalizedTeam = normalizeHierarchySegment(teamSlug, "default-team");
    const normalizedProject = normalizeHierarchySegment(projectCode, "default-project");
    const normalizedDesign = normalizeHierarchySegment(designName, "untitled-design");
    const designId = crypto.randomUUID();

    const response = await fetch("/api/workflow-canvas/designs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildOwnerHeaders(),
      },
      body: JSON.stringify({
        id: designId,
        name: designName,
        teamSlug: normalizedTeam,
        projectCode: normalizedProject,
        designKey: normalizedDesign,
        nodes: getNodes(),
        edges: getEdges(),
      }),
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, "Failed to create design"));
    }

    const payload = (await response.json()) as {
      design: DesignPayload & { master_id?: string };
      versions?: VersionSummary[];
      storage?: "supabase" | "local-fallback";
    };
    const masterId = payload.design.master_id ?? payload.design.id;
    setActiveDesignId(masterId);
    setSelectedVersionId(payload.design.design_id ?? payload.design.id);
    setVersions((payload.versions ?? []).map((version) => ({
      ...version,
      design_id: version.design_id ?? version.id,
    })));
    navigateToDesign(masterId);
    setDesignName(payload.design.name);
    setTeamSlug(payload.design.team_slug ?? normalizedTeam);
    setProjectCode(payload.design.project_code ?? normalizedProject);
    setActiveVersion(payload.design.version ?? 1);
    setGitlabPath(payload.design.gitlab_path ?? "");
    await fetchDesigns();
    saveDesignToDevice(payload.design.version ?? 1);
    if (payload.storage === "local-fallback") {
      toast("Design saved locally only (Supabase unavailable)");
    } else {
      toast.success("Design created");
    }
  };

  const saveDesign = async () => {
    if (!activeDesignId) {
      await createDesign();
      return;
    }

    const latestVersion = await fetchLatestVersionNumber(activeDesignId);

    const response = await fetch(`/api/workflow-canvas/designs/${activeDesignId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...buildOwnerHeaders(),
      },
      body: JSON.stringify({
        name: designName,
          teamSlug: normalizeHierarchySegment(teamSlug, "default-team"),
          projectCode: normalizeHierarchySegment(projectCode, "default-project"),
          designKey: normalizeHierarchySegment(designName, "untitled-design"),
        nodes: getNodes(),
        edges: getEdges(),
      }),
    });

    if (!response.ok) {
        throw new Error(await parseApiError(response, "Failed to save design"));
    }

      const payload = (await response.json()) as {
        design: DesignPayload & { master_id?: string };
        versions?: VersionSummary[];
        storage?: "supabase" | "local-fallback";
      };
        const masterId = payload.design.master_id ?? activeDesignId;
        setActiveDesignId(masterId);
        setSelectedVersionId(payload.design.design_id ?? payload.design.id);
        setVersions((payload.versions ?? []).map((version) => ({
          ...version,
          design_id: version.design_id ?? version.id,
        })));
        navigateToDesign(masterId);
      setDesignName(payload.design.name);
      setTeamSlug(payload.design.team_slug ?? teamSlug);
      setProjectCode(payload.design.project_code ?? projectCode);
      setActiveVersion(payload.design.version ?? latestVersion + 1);
      setGitlabPath(payload.design.gitlab_path ?? "");

    await fetchDesigns();
      saveDesignToDevice(payload.design.version ?? latestVersion + 1);
    if (payload.storage === "local-fallback") {
      toast("Saved locally only (Supabase unavailable)");
    } else {
      toast.success("Design saved");
    }
  };

  const saveToSupabase = async () => {
    await saveDesign();
    toast.success("Saved to Supabase");
  };

  const loadDesign = useCallback(async (designId: string, versionId?: string) => {
    const url = versionId
      ? `/api/workflow-canvas/designs/${designId}?versionId=${encodeURIComponent(versionId)}`
      : `/api/workflow-canvas/designs/${designId}`;

    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        ...buildOwnerHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load design");
    }

    const payload = (await response.json()) as {
      design: DesignPayload & { master_id?: string };
      versions?: VersionSummary[];
      storage?: "supabase" | "local-fallback";
    };
    const masterId = payload.design.master_id ?? designId;
    setNodes(payload.design.nodes ?? []);
    setEdges(payload.design.edges ?? []);
    setActiveDesignId(masterId);
    setSelectedVersionId(payload.design.design_id ?? payload.design.id);
    setVersions((payload.versions ?? []).map((version) => ({
      ...version,
      design_id: version.design_id ?? version.id,
    })));
    navigateToDesign(masterId);
    setDesignName(payload.design.name);
    setTeamSlug(payload.design.team_slug ?? "default-team");
    setProjectCode(payload.design.project_code ?? "default-project");
    setActiveVersion(payload.design.version ?? 1);
    setGitlabPath(payload.design.gitlab_path ?? "");

    setTimeout(() => {
      fitView({ duration: 400, padding: 0.15 });
    }, 50);

    if (payload.storage === "local-fallback") {
      toast("Loaded from local fallback store");
    } else {
      toast.success("Design loaded");
    }
  }, [buildOwnerHeaders, fitView, navigateToDesign, setEdges, setNodes]);

  const applySearchFilters = async () => {
    const matches = await fetchDesigns({
      name: searchName,
      teamSlug: searchTeam,
      projectCode: searchProject,
      version: searchVersion,
    });

    setOpenResults(matches);

    if (!searchVersion.trim() || matches.length !== 1) {
      return;
    }

    const target = matches[0];
    await loadDesign(target.master_id ?? target.id, target.design_id ?? target.id);
  };

  const resetSearchFilters = async () => {
    setSearchName("");
    setSearchTeam("");
    setSearchProject("");
    setSearchVersion("");
    const all = await fetchDesigns();
    setOpenResults(all);
  };

  const handleOpenDialog = async () => {
    setOpenDialogOpen(true);
    const all = await fetchDesigns();
    setOpenResults(all);
  };

  const handleOpenResult = async (design: DesignSummary) => {
    await loadDesign(design.master_id ?? design.id, design.design_id ?? design.id);
    setOpenDialogOpen(false);
  };

  const handleNewDesign = () => {
    setActiveDesignId("");
    setSelectedVersionId("");
    setVersions([]);
    setDesignName("Untitled design");
    setTeamSlug("default-team");
    setProjectCode("default-project");
    setActiveVersion(1);
    setGitlabPath("");
    setNodes([]);
    setEdges([]);
    router.replace("/workflow-canvas");
    toast.success("Started new design");
  };

  useEffect(() => {
    if (!initialDesignId || initialLoadHandled.current) {
      return;
    }

    initialLoadHandled.current = true;
    void loadDesign(initialDesignId).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to load design";
      toast.error(message);
    });
  }, [initialDesignId, loadDesign]);

  const withGraph = () => ({
    nodes: getNodes(),
    edges: getEdges(),
  });

  const exportBase =
    designName.trim().replaceAll(" ", "-").toLowerCase() || "workflow-design";

  const selectedNodes = useMemo(
    () => nodesState.filter((node) => node.selected),
    [nodesState]
  );
  const primarySelectedNode =
    selectedNodes.length === 1 ? selectedNodes[0] : undefined;

  const selectedEdge = edgesState.find((edge) => edge.selected);
  const selectedEdgeMetadata = selectedEdge
    ? getEdgeMetadata(selectedEdge)
    : DEFAULT_EDGE_METADATA;

  const updateSelectedEdgeMetadata = (
    patch: Partial<{
      directionality: EdgeDirectionality;
      lineStyle: EdgeLineStyle;
      connectionType: EdgeConnectionType;
    }>
  ) => {
    if (!selectedEdge) {
      toast.error("Select an edge first.");
      return;
    }

    const nextMeta = {
      ...selectedEdgeMetadata,
      ...patch,
    };

    if (nextMeta.directionality === "two-way") {
      const nodes = getNodes();
      const source = nodes.find((node) => node.id === selectedEdge.source);
      const target = nodes.find((node) => node.id === selectedEdge.target);
      if (!(source && target)) {
        toast.error("Unable to validate bidirectional connection.");
        return;
      }

      const reverseSource = target;
      const reverseTarget = source;
      const reversePolicy = validateConnectionByPolicies(
        reverseSource,
        reverseTarget,
        policyCatalog
      );
      if (!reversePolicy.allowed) {
        toast.error(reversePolicy.reason ?? "Reverse direction blocked by policy.");
        return;
      }
    }

    setEdges((current) =>
      current.map((edge) =>
        edge.id === selectedEdge.id
          ? {
              ...edge,
              data: {
                ...getEdgeMetadata(edge),
                ...nextMeta,
              },
            }
          : edge
      )
    );
  };

  return (
    <>
      {/* Import at top of file */}
      <LeftSidebar
        isCollapsed={isCollapsed}
        onToggleCollapsed={() => setIsCollapsed((current) => !current)}
        widthPx={leftWidth}
        onWidthChange={setLeftWidth}
        zoneOptions={canvasActionOptions.zoneOptions}
        regionOptions={canvasActionOptions.regionOptions}
        environmentOptions={canvasActionOptions.environmentOptions}
        computeOptions={canvasActionOptions.computeOptions}
        componentGroups={canvasActionOptions.componentGroups}
        onAddNode={handleAddNode}
        onOpenCreateBox={() => {
          setCreateBoxFeedback(null);
          setDialogOpen(true);
        }}
      />

      <SidebarTabs
        isCollapsed={isRightToolbarCollapsed}
        onToggleCollapsed={() => setIsRightToolbarCollapsed((current) => !current)}
        widthPx={rightWidth}
        onWidthChange={setRightWidth}
        diagramTab={
          <div className="space-y-4">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Design
              </p>
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
                <p className="font-medium text-foreground">{designName}</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  v{Math.max(activeVersion, 1)}
                  {gitlabPath ? (
                    <span className="block truncate" title={gitlabPath}>
                      {gitlabPath}
                    </span>
                  ) : (
                    <span className="block">Not saved to GitLab yet</span>
                  )}
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Graph
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-border bg-background px-2 py-2 text-center">
                  <p className="text-lg font-semibold tabular-nums">{nodesState.length}</p>
                  <p className="text-[10px] text-muted-foreground">Nodes</p>
                </div>
                <div className="rounded-lg border border-border bg-background px-2 py-2 text-center">
                  <p className="text-lg font-semibold tabular-nums">{edgesState.length}</p>
                  <p className="text-[10px] text-muted-foreground">Edges</p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Canvas
              </p>
              <div className="flex flex-col gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-2 py-1.5 text-xs">
                  <input
                    checked={showGrid}
                    className="rounded border-input"
                    onChange={(event) => setShowGrid(event.target.checked)}
                    type="checkbox"
                  />
                  <LayoutGrid className="size-3.5 shrink-0 text-muted-foreground" />
                  Show background grid
                </label>
                <Button
                  className="h-8 w-full justify-start gap-2 text-xs"
                  onClick={() => fitView({ duration: 220, padding: 0.16 })}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Maximize2 className="size-3.5" />
                  Fit entire graph to view
                </Button>
              </div>
            </div>

            <div className="rounded-lg border border-primary/25 bg-primary/5 px-3 py-2 text-[10px] leading-relaxed text-foreground">
              <p className="font-semibold text-primary">Placement order</p>
              <p className="mt-1 text-muted-foreground">
                Add <strong>Zone</strong> → <strong>Region</strong> → <strong>Environment</strong> → <strong>Compute</strong> → <strong>Tech Components</strong> (apps, DBs, services). Draw edges for data flows.
              </p>
              {activeZoneId ? (
                <Button
                  className="mt-2 h-7 w-full text-[10px]"
                  onClick={() => setActiveZoneId(undefined)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  Exit zone placement mode
                </Button>
              ) : null}
            </div>

            <div className="rounded border border-violet-200 bg-violet-50/50 p-2 dark:border-violet-800 dark:bg-violet-950/30">
              <button
                className="flex w-full items-center justify-between text-[10px] font-semibold text-violet-900 dark:text-violet-200"
                onClick={() => setFirewallPanelOpen((open) => !open)}
                type="button"
              >
                <span className="flex items-center gap-1">
                  <FlameIcon className="size-3 text-rose-500" />
                  Firewall Requests
                  {firewallRequests.length > 0 && (
                    <span className="rounded-full bg-violet-700 px-1 py-0.5 text-[9px] text-white">
                      {firewallRequests.length}
                    </span>
                  )}
                </span>
                <span className="text-violet-600 dark:text-violet-400">{firewallPanelOpen ? "▲" : "▼"}</span>
              </button>
              {firewallPanelOpen && (
                <div className="mt-1">
                  <FirewallRequestsPanel rows={firewallRequests} />
                </div>
              )}
            </div>
          </div>
        }
        styleTab={
          <div className="space-y-4">
            <p className="text-[10px] text-muted-foreground">
              Edit connection and component metadata for compliance review and exports.
            </p>

            {selectedEdge ? (
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Selected connection
                </p>
                <div className="rounded-lg border border-border bg-muted/30 px-2 py-1.5 font-mono text-[10px] text-muted-foreground">
                  {selectedEdge.source} → {selectedEdge.target}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground">
                    Direction
                  </label>
                  <select
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                    onChange={(event) =>
                      updateSelectedEdgeMetadata({
                        directionality: event.target.value as EdgeDirectionality,
                      })
                    }
                    value={selectedEdgeMetadata.directionality}
                  >
                    <option value="one-way">One-way</option>
                    <option value="two-way">Two-way</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground">
                    Line style
                  </label>
                  <select
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                    onChange={(event) =>
                      updateSelectedEdgeMetadata({
                        lineStyle: event.target.value as EdgeLineStyle,
                      })
                    }
                    value={selectedEdgeMetadata.lineStyle}
                  >
                    <option value="solid">Solid (enforced / in production)</option>
                    <option value="dotted">Dotted (planned / conditional)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground">
                    Connection type
                  </label>
                  <select
                    className="h-8 w-full rounded border border-input bg-background px-2 text-xs"
                    onChange={(event) =>
                      updateSelectedEdgeMetadata({
                        connectionType: event.target.value as EdgeConnectionType,
                      })
                    }
                    value={selectedEdgeMetadata.connectionType}
                  >
                    <option value="firewall-request">Firewall request</option>
                    <option value="data-flow">Data flow</option>
                    <option value="management">Management</option>
                    <option value="replication">Replication</option>
                  </select>
                </div>
              </div>
            ) : null}

            {!selectedEdge && primarySelectedNode ? (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Selected component
                </p>
                <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                  <p className="font-medium">
                    {String(
                      (primarySelectedNode.data as Record<string, unknown> | undefined)?.label ??
                        primarySelectedNode.id
                    )}
                  </p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    Type: <span className="font-mono">{primarySelectedNode.type}</span>
                  </p>
                  {typeof (primarySelectedNode.data as Record<string, unknown> | undefined)
                    ?.category === "string" ? (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      Category:{" "}
                      <span className="font-medium text-foreground">
                        {String((primarySelectedNode.data as Record<string, unknown>).category)}
                      </span>
                    </p>
                  ) : null}
                  {typeof (primarySelectedNode.data as Record<string, unknown> | undefined)
                    ?.componentKey === "string" ? (
                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground" title={String(
                      (primarySelectedNode.data as Record<string, unknown>).componentKey
                    )}>
                      Key:{" "}
                      <span className="font-mono">
                        {String((primarySelectedNode.data as Record<string, unknown>).componentKey)}
                      </span>
                    </p>
                  ) : null}
                </div>
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Use the node header menu or right-click for duplicate, focus, and delete. Labels are edited on the canvas.
                </p>
              </div>
            ) : null}

            {!selectedEdge && !primarySelectedNode && selectedNodes.length > 1 ? (
              <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
                <p className="font-medium">{selectedNodes.length} nodes selected</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Select a single node or one edge to see editable properties here.
                </p>
              </div>
            ) : null}

            {!selectedEdge && !primarySelectedNode && selectedNodes.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-[11px] text-muted-foreground">
                <p className="font-medium text-foreground">Nothing selected</p>
                <p className="mt-2 leading-relaxed">
                  Click a <strong>connection</strong> to set direction, line style, and flow type. Click a{" "}
                  <strong>component</strong> to see its type and policy metadata.
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-background px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">
              <p className="font-semibold text-foreground">Line style meaning</p>
              <p className="mt-1">
                <strong>Solid</strong> — approved or in-scope flows. <strong>Dotted</strong> — proposed or
                conditional paths.
              </p>
            </div>
          </div>
        }
      />

      <Dialog
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (open) {
            setCreateBoxFeedback(null);
          }
        }}
        open={dialogOpen}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Box</DialogTitle>
            <DialogDescription>
              Choose a generic component (IAM, database, etc.) or a hierarchy container. Components are
              placed inside the matching parent (e.g. compute). Containers follow zone → region →
              environment → compute unless you add a zone at the root.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">What are you adding?</p>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => {
                  setCreateBoxFeedback(null);
                  setCreateBoxKind(event.target.value as CreateBoxKind);
                }}
                value={createBoxKind}
              >
                {CREATE_BOX_KIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {createBoxKind === "component" ? (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Component category</p>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => {
                    setCreateBoxFeedback(null);
                    setCreateBoxComponentCategory(
                      event.target.value as ComponentCategory
                    );
                  }}
                  value={createBoxComponentCategory}
                >
                  {CREATE_BOX_COMPONENT_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-foreground">Container level</p>
                <select
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  onChange={(event) => {
                    setCreateBoxFeedback(null);
                    setCreateBoxContainerTier(event.target.value as ContainerTier);
                  }}
                  value={createBoxContainerTier}
                >
                  {CREATE_BOX_CONTAINER_TIERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Nested containers need the parent on the canvas (e.g. a region requires a zone).
                </p>
              </div>
            )}

            <Textarea
              className="min-h-10"
              onChange={(event) => {
                setCreateBoxFeedback(null);
                setNewNodeLabel(event.target.value);
              }}
              placeholder="Label (required)"
              value={newNodeLabel}
            />

            <Textarea
              className="min-h-14"
              onChange={(event) => {
                setCreateBoxFeedback(null);
                setNewNodeDescription(event.target.value);
              }}
              placeholder="Description — purpose, owner, data class, etc."
              value={newNodeDescription}
            />

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-foreground">Custom fields (JSON object, optional)</p>
              <Textarea
                className="min-h-24 font-mono"
                onChange={(event) => {
                  setCreateBoxFeedback(null);
                  setNewNodeFields(event.target.value);
                }}
                placeholder='{"owner":"ITIS","criticality":"high"}'
                value={newNodeFields}
              />
            </div>
          </div>

          {createBoxFeedback ? (
            <div
              aria-live="polite"
              className={
                createBoxFeedback.level === "error"
                  ? "flex gap-2 rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
                  : "flex gap-2 rounded-md border border-amber-500/55 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-400/50 dark:bg-amber-400/10 dark:text-amber-50"
              }
              role="alert"
            >
              {createBoxFeedback.level === "error" ? (
                <AlertCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              ) : (
                <AlertTriangleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              )}
              <div>
                <p className="font-semibold leading-tight">{createBoxFeedback.title}</p>
                <p className="mt-1 text-xs leading-relaxed opacity-90">
                  {createBoxFeedback.message}
                </p>
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Cancel
            </Button>
            <Button onClick={handleCreateBox}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setOpenDialogOpen} open={openDialogOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Open Design</DialogTitle>
            <DialogDescription>
              Filter by name, team, project, and version. Select a result to load that exact version.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <input
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => setSearchName(event.target.value)}
              placeholder="Design name"
              value={searchName}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => setSearchTeam(event.target.value)}
                placeholder="Team"
                value={searchTeam}
              />
              <input
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                onChange={(event) => setSearchProject(event.target.value)}
                placeholder="Project"
                value={searchProject}
              />
            </div>
            <input
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => setSearchVersion(event.target.value)}
              placeholder="Version (optional, e.g. 3)"
              value={searchVersion}
            />

            <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-border p-2">
              {openResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching designs found.</p>
              ) : (
                openResults.map((design) => (
                  <button
                    className="w-full rounded-md border border-border p-2 text-left hover:bg-muted"
                    key={`${design.master_id ?? design.id}-${design.design_id ?? design.id}`}
                    onClick={() => {
                      void handleOpenResult(design).catch((error: unknown) => {
                        const message = error instanceof Error ? error.message : "Failed to open design";
                        toast.error(message);
                      });
                    }}
                    type="button"
                  >
                    <p className="text-sm font-medium text-foreground">{design.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Team: {design.team_slug ?? "-"} | Project: {design.project_code ?? "-"} | Version: v{design.version ?? 1}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                void resetSearchFilters().catch((error: unknown) => {
                  const message = error instanceof Error ? error.message : "Failed to reset filters";
                  toast.error(message);
                });
              }}
              variant="outline"
            >
              Reset
            </Button>
            <Button
              onClick={() => {
                void applySearchFilters().catch((error: unknown) => {
                  const message = error instanceof Error ? error.message : "Failed to apply filters";
                  toast.error(message);
                });
              }}
            >
              Search
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Top Menu Bar - Fixed at very top */}
      <TopMenuBar
        designName={designName}
        onDesignNameChange={setDesignName}
        onSave={() => {
          void saveToSupabase().catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Failed to save";
            toast.error(message);
          });
        }}
        onExport={() => exportCanvasAsPng(withGraph(), exportBase)}
        onOpen={() => {
          void handleOpenDialog().catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Failed to open dialog";
            toast.error(message);
          });
        }}
        onNew={handleNewDesign}
      />
    </>
  );
};

export const Toolbar = memo(ToolbarInner);

