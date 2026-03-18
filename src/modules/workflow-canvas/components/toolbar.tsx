"use client";

import type { Edge, Node } from "@xyflow/react";
import { useEdges, useReactFlow } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import {
  BoxesIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  FolderOpenIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  PlusCircleIcon,
  UploadIcon,
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
import { validateConnectionByPolicies } from "@/modules/workflow-canvas/lib/policy-catalog";
import {
  exportCanvasAsIdacTemplateExcel,
  exportCanvasAsExcel,
  exportCanvasAsJpeg,
  exportCanvasAsPng,
} from "@/modules/workflow-canvas/lib/export";
import { useNodeOperations } from "@/modules/workflow-canvas/providers/node-operations";
import { Panel } from "./ai-elements/panel";
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

interface AddTabProps {
  onAddNode: (selector: string, options?: Record<string, unknown>) => void;
  onOpenCreateBox: () => void;
  environmentOptions: Array<{
    id: string;
    label: string;
    icon: LucideIcon;
    data: Record<string, unknown>;
  }>;
  zoneOptions: Array<{
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

type ComponentGroupId = "database" | "backend" | "frontend";

const AddTab = ({
  onAddNode,
  onOpenCreateBox,
  environmentOptions,
  zoneOptions,
  componentGroups,
  onAddWildcard,
}: AddTabProps) => {
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState("");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [activeComponentGroup, setActiveComponentGroup] = useState<ComponentGroupId>("database");
  const [componentSearch, setComponentSearch] = useState("");
  const [selectedComponentByGroup, setSelectedComponentByGroup] = useState<Record<string, string>>({});
  const [selectedSearchComponentId, setSelectedSearchComponentId] = useState("");
  const [recentComponentIds, setRecentComponentIds] = useState<string[]>([]);
  const [wildcardLabel, setWildcardLabel] = useState("");
  const [wildcardDescription, setWildcardDescription] = useState("");

  useEffect(() => {
    if (!selectedEnvironmentId && environmentOptions[0]) {
      setSelectedEnvironmentId(environmentOptions[0].id);
    }
  }, [environmentOptions, selectedEnvironmentId]);

  useEffect(() => {
    if (!selectedZoneId && zoneOptions[0]) {
      setSelectedZoneId(zoneOptions[0].id);
    }
  }, [zoneOptions, selectedZoneId]);

  const currentComponentGroup =
    componentGroups.find((group) => group.id === activeComponentGroup) ??
    componentGroups[0];

  const allComponentOptions = componentGroups.flatMap((group) => group.options);
  const normalizedSearch = componentSearch.trim().toLowerCase();
  const searchMode = normalizedSearch.length > 0;

  const filteredComponentOptions = useMemo(() => {
    if (!searchMode) {
      return currentComponentGroup?.options ?? [];
    }

    return allComponentOptions.filter((option) => {
      const text = `${option.label} ${option.id}`.toLowerCase();
      return text.includes(normalizedSearch);
    });
  }, [allComponentOptions, currentComponentGroup, normalizedSearch, searchMode]);

  useEffect(() => {
    if (!searchMode) {
      setSelectedSearchComponentId("");
      return;
    }

    if (!selectedSearchComponentId && filteredComponentOptions[0]) {
      setSelectedSearchComponentId(filteredComponentOptions[0].id);
      return;
    }

    if (
      selectedSearchComponentId &&
      !filteredComponentOptions.some((option) => option.id === selectedSearchComponentId)
    ) {
      setSelectedSearchComponentId(filteredComponentOptions[0]?.id ?? "");
    }
  }, [filteredComponentOptions, searchMode, selectedSearchComponentId]);

  const selectedComponentId = searchMode
    ? selectedSearchComponentId || filteredComponentOptions[0]?.id || ""
    : selectedComponentByGroup[currentComponentGroup?.id ?? ""] ??
      filteredComponentOptions[0]?.id ??
      currentComponentGroup?.options[0]?.id ??
      "";

  const selectedComponentOption =
    filteredComponentOptions.find((option) => option.id === selectedComponentId) ??
    currentComponentGroup?.options.find((option) => option.id === selectedComponentId) ??
    filteredComponentOptions[0] ??
    currentComponentGroup?.options[0];

  const recentComponentOptions = recentComponentIds
    .map((id) =>
      allComponentOptions.find((option) => option.id === id)
    )
    .filter((option): option is NonNullable<typeof option> => Boolean(option));

  const findGroupByOptionId = (optionId: string) =>
    componentGroups.find((candidate) =>
      candidate.options.some((entry) => entry.id === optionId)
    );

  const addRecentComponent = (id: string) => {
    setRecentComponentIds((current) => [id, ...current.filter((entry) => entry !== id)].slice(0, 6));
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Follow hierarchy: Environment -&gt; Zone -&gt; Components.
      </p>

      <div className="rounded-xl border border-border p-2">
        <p className="mb-2 text-xs font-semibold text-foreground">1. Environment</p>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
            onChange={(event) => setSelectedEnvironmentId(event.target.value)}
            value={selectedEnvironmentId}
          >
            {environmentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            className="h-9 rounded-lg"
            onClick={() => {
              const selected = environmentOptions.find((option) => option.id === selectedEnvironmentId);
              if (!selected) {
                return;
              }
              onAddNode(selected.id, {
                data: selected.data,
              });
            }}
            size="sm"
            variant="outline"
          >
            Add
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border p-2">
        <p className="mb-2 text-xs font-semibold text-foreground">2. Zone</p>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
            onChange={(event) => setSelectedZoneId(event.target.value)}
            value={selectedZoneId}
          >
            {zoneOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            className="h-9 rounded-lg"
            onClick={() => {
              const selected = zoneOptions.find((option) => option.id === selectedZoneId);
              if (!selected) {
                return;
              }
              onAddNode(selected.id, {
                data: selected.data,
              });
            }}
            size="sm"
            variant="outline"
          >
            Add
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border p-2">
        <p className="mb-2 text-xs font-semibold text-foreground">3. Components</p>

        <div className="mb-2 grid grid-cols-3 gap-1">
          {componentGroups.map((group) => (
            <Button
              className="h-8 rounded-lg text-xs"
              key={group.id}
              onClick={() => setActiveComponentGroup(group.id)}
              size="sm"
              variant={activeComponentGroup === group.id ? "default" : "outline"}
            >
              {group.label}
            </Button>
          ))}
        </div>

        <input
          className="mb-2 h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"
          onChange={(event) => setComponentSearch(event.target.value)}
          placeholder="Search any component..."
          value={componentSearch}
        />

        {recentComponentOptions.length > 0 ? (
          <div className="mb-2 rounded-lg border border-border/70 bg-muted/30 p-2">
            <p className="mb-1 text-[11px] font-semibold text-muted-foreground">Recent</p>
            <div className="flex flex-wrap gap-1">
              {recentComponentOptions.map((option) => (
                <button
                  className="rounded-md border border-input bg-background px-2 py-1 text-[11px] hover:bg-accent"
                  key={option.id}
                  onClick={() => {
                    const group = findGroupByOptionId(option.id);
                    if (!group) {
                      return;
                    }
                    setActiveComponentGroup(group.id);
                    setSelectedComponentByGroup((current) => ({
                      ...current,
                      [group.id]: option.id,
                    }));
                  }}
                  type="button"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
            onChange={(event) => {
              const nextId = event.target.value;
              if (searchMode) {
                setSelectedSearchComponentId(nextId);
                return;
              }

              setSelectedComponentByGroup((current) => ({
                ...current,
                [currentComponentGroup?.id ?? ""]: nextId,
              }));
            }}
            value={selectedComponentId}
          >
            {filteredComponentOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <Button
            className="h-9 rounded-lg"
            onClick={() => {
              if (!selectedComponentOption) {
                return;
              }
              onAddNode(selectedComponentOption.id, {
                data: selectedComponentOption.data,
              });
              addRecentComponent(selectedComponentOption.id);
            }}
            size="sm"
            variant="outline"
          >
            Add
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border p-2">
        <p className="mb-2 text-xs font-semibold text-foreground">Wildcard Box (Standalone)</p>
        <p className="mb-2 text-[11px] text-muted-foreground">
          Add a generic component outside hierarchy while schema is still evolving.
        </p>
        <div className="space-y-2">
          <input
            className="h-9 w-full rounded-lg border border-input bg-background px-2 text-xs"
            onChange={(event) => setWildcardLabel(event.target.value)}
            placeholder="Component label"
            value={wildcardLabel}
          />
          <Textarea
            className="min-h-16 rounded-lg text-xs"
            onChange={(event) => setWildcardDescription(event.target.value)}
            placeholder="Description (optional)"
            value={wildcardDescription}
          />
          <Button
            className="h-9 w-full rounded-lg"
            onClick={() => {
              const label = wildcardLabel.trim();
              if (!label) {
                toast.error("Wildcard label is required.");
                return;
              }
              onAddWildcard(label, wildcardDescription.trim());
              setWildcardLabel("");
              setWildcardDescription("");
            }}
            variant="outline"
          >
            <PlusCircleIcon size={14} />
            Add Wildcard Box
          </Button>
        </div>
      </div>

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
  <Panel
    className={`rounded-2xl border border-primary/35 glass-lite p-3 shadow-lg transition-all duration-150 ${
      isCollapsed ? "w-16" : "w-[22rem]"
    }`}
    onDoubleClick={(event) => event.stopPropagation()}
    position="top-right"
  >
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        {isCollapsed ? null : <p className="font-semibold text-sm text-foreground">Workspace</p>}
        <Button className="h-9 w-9 rounded-xl" onClick={onToggleCollapsed} size="icon" variant="outline">
          {isCollapsed ? <ChevronsLeftIcon size={16} /> : <ChevronsRightIcon size={16} />}
        </Button>
      </div>

      {isCollapsed ? (
        <div className="space-y-2">
          <Button className="h-10 w-10 rounded-xl" onClick={onOpen} size="icon" variant="outline">
            <FolderOpenIcon size={16} />
          </Button>
          <Button className="h-10 w-10 rounded-xl" onClick={onNew} size="icon" variant="outline">
            <PlusCircleIcon size={16} />
          </Button>
          <Button className="h-10 w-10 rounded-xl" onClick={onSaveSupabase} size="icon">
            <UploadIcon size={16} />
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2 rounded-xl border border-border p-2">
            <p className="text-xs font-semibold text-foreground">File</p>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-9 rounded-lg" onClick={onOpen} variant="outline">
                <FolderOpenIcon size={14} />
                Open
              </Button>
              <Button className="h-9 rounded-lg" onClick={onNew} variant="outline">
                <PlusCircleIcon size={14} />
                New
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-2">
            <p className="text-xs font-semibold text-foreground">Design</p>
            <Textarea
              className="min-h-10 rounded-xl"
              disabled={metadataLocked}
              onChange={(event) => onDesignNameChange(event.target.value)}
              placeholder="Design name"
              value={designName}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                disabled={metadataLocked}
                onChange={(event) => onTeamSlugChange(event.target.value)}
                placeholder="Team"
                value={teamSlug}
              />
              <input
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
                disabled={metadataLocked}
                onChange={(event) => onProjectCodeChange(event.target.value)}
                placeholder="Project"
                value={projectCode}
              />
            </div>
            {metadataLocked ? (
              <p className="text-[11px] text-muted-foreground">Metadata locked after first version creation.</p>
            ) : null}
            <div className="rounded-lg border border-border bg-muted/35 p-2 text-[11px] text-muted-foreground">
              <p>Version: v{Math.max(activeVersion, 1)}</p>
              <p className="truncate">Path: {gitlabPath || "(set after first cloud save)"}</p>
            </div>
            <select
              className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
              disabled={!activeDesignId || versions.length === 0}
              onChange={async (event) => {
                const versionId = event.target.value;
                if (!activeDesignId) {
                  return;
                }

                if (!versionId) {
                  await onLoadDesign(activeDesignId).catch((error: unknown) => {
                    const message = error instanceof Error ? error.message : "Failed to load design";
                    toast.error(message);
                  });
                  return;
                }

                await onVersionChange(versionId).catch((error: unknown) => {
                  const message = error instanceof Error ? error.message : "Failed to load version";
                  toast.error(message);
                });
              }}
              value={selectedVersionId}
            >
              <option value="">Latest version</option>
              {versions.map((version) => (
                <option key={version.id} value={version.design_id ?? version.id}>
                  v{version.version}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-2">
            <p className="text-xs font-semibold text-foreground">Save</p>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-9 rounded-lg" onClick={onSaveSupabase}>
                <UploadIcon size={14} />
                Save
              </Button>
              <Button className="h-9 rounded-lg" onClick={onSaveLocal} variant="outline">
                <DownloadIcon size={14} />
                Save Local
              </Button>
            </div>
          </div>

          <div className="space-y-2 rounded-xl border border-border p-2">
            <p className="text-xs font-semibold text-foreground">Export</p>
            <div className="grid grid-cols-2 gap-2">
              <Button className="h-9 rounded-lg" onClick={onExportMachineExcel} variant="outline">
                <FileSpreadsheetIcon size={14} />
                Nodes/Edges
              </Button>
              <Button className="h-9 rounded-lg" onClick={onExportIdacTemplate} variant="outline">
                <FileSpreadsheetIcon size={14} />
                IDaC
              </Button>
              <Button className="h-9 rounded-lg" onClick={onExportPng} variant="outline">
                <DownloadIcon size={14} />
                PNG
              </Button>
              <Button className="h-9 rounded-lg" onClick={onExportJpeg} variant="outline">
                <DownloadIcon size={14} />
                JPEG
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  </Panel>
);

interface ToolbarInnerProps {
  initialDesignId?: string;
}

export const ToolbarInner = ({ initialDesignId }: ToolbarInnerProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const { getViewport, getNodes, getEdges, setNodes, setEdges, fitView } =
    useReactFlow();
  const { addNode, activeZoneId, setActiveZoneId, nodeButtons, policyCatalog } = useNodeOperations();
  const edgesState = useEdges();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRightToolbarCollapsed, setIsRightToolbarCollapsed] = useState(false);
  const [activeDesignId, setActiveDesignId] = useState<string>("");
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [designName, setDesignName] = useState("Untitled design");
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
  const [newNodeType, setNewNodeType] = useState(nodeButtons[0]?.id ?? "environment-box");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeDescription, setNewNodeDescription] = useState("");
  const [newNodeFields, setNewNodeFields] = useState("{}");
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

  useEffect(() => {
    if (!nodeButtons.length) {
      return;
    }

    if (!nodeButtons.some((button) => button.id === newNodeType)) {
      setNewNodeType(nodeButtons[0].id);
    }
  }, [nodeButtons, newNodeType]);

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

    const matchesTokens = (valueA: string, valueB: string, tokens: string[]) =>
      tokens.some((token) => valueA.includes(token) || valueB.includes(token));

    const findOptionByTokens = (tokens: string[]) =>
      normalizedButtons.find(
        (button) =>
          button.category !== "" &&
          matchesTokens(button.id.toLowerCase(), button.label.toLowerCase(), tokens)
      );

    const mergePreferredWithAll = <T extends { id: string }>(
      preferred: T[],
      all: T[]
    ) => {
      const seen = new Set<string>();
      const ordered: T[] = [];

      for (const item of preferred) {
        if (seen.has(item.id)) {
          continue;
        }
        seen.add(item.id);
        ordered.push(item);
      }

      for (const item of all) {
        if (seen.has(item.id)) {
          continue;
        }
        seen.add(item.id);
        ordered.push(item);
      }

      return ordered;
    };

    const preferredEnvironmentOptions = [
      findOptionByTokens(["environment-prod", "production"]),
      findOptionByTokens(["environment-pre", "pre-production"]),
      findOptionByTokens(["environment-uat", "uat"]),
      findOptionByTokens(["environment-dev", "development"]),
    ]
      .filter((option): option is NonNullable<typeof option> => Boolean(option))
      .map((option) => ({
        ...option,
        label: option.label
          .replace("Environment", "")
          .trim()
          .replace("Pre-Production", "PRE")
          .replace("Production", "PROD")
          .replace("Development", "DEV")
          .replace("UAT", "UAT"),
      }));
    const allEnvironmentOptions = normalizedButtons
      .filter((button) => button.category === "environment")
      .toSorted((a, b) => a.label.localeCompare(b.label));
    const environmentOptions = mergePreferredWithAll(
      preferredEnvironmentOptions,
      allEnvironmentOptions
    );

    const zoneCandidates = normalizedButtons.filter((button) => button.category === "zone");
    const pickZone = (tokens: string[]) =>
      zoneCandidates.find(
        (button) =>
          matchesTokens(button.id.toLowerCase(), button.label.toLowerCase(), tokens)
      );

    const preferredZoneOptions = [
      pickZone(["public-network", "public network"]),
      pickZone(["dmz"]),
      pickZone(["private-network", "oa"]),
      pickZone(["intranet", "internal"]),
      pickZone(["aws-private-cloud", "aws landing", "landing zone"]),
      pickZone(["zone-box", "default"]),
    ]
      .filter((option): option is NonNullable<typeof option> => Boolean(option))
      .map((option) => {
        if (option.id.includes("zone-box")) {
          return {
            ...option,
            label: "Default Zone",
          };
        }
        return option;
      });
    const allZoneOptions = zoneCandidates.toSorted((a, b) => a.label.localeCompare(b.label));
    const zoneOptions = mergePreferredWithAll(preferredZoneOptions, allZoneOptions);

    const grouped = {
      database: normalizedButtons
        .filter((button) => button.category === "database")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      backend: normalizedButtons
        .filter((button) => button.category === "backend")
        .toSorted((a, b) => a.label.localeCompare(b.label)),
      frontend: normalizedButtons
        .filter((button) => button.category === "frontend")
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
      { id: "database", label: "DB", options: grouped.database },
      { id: "backend", label: "Backend", options: grouped.backend },
      { id: "frontend", label: "Frontend", options: grouped.frontend },
    ];

    return {
      environmentOptions,
      zoneOptions,
      componentGroups,
    };
  }, [nodeButtons]);

  const handleAddNode = (type: string, options?: Record<string, unknown>) => {
    // Get the current viewport
    const viewport = getViewport();

    // Calculate the center of the current viewport
    const centerX =
      -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom;
    const centerY =
      -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom;

    const position = { x: centerX, y: centerY };
    const { data: nodeData, ...rest } = options ?? {};

    addNode(type, {
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

    handleAddNode("resource-app", {
      data: {
        label,
        description,
        category: "integration",
        componentType: "custom:wildcard",
        componentKey: `wildcard-${slug || crypto.randomUUID()}`,
        standalone: true,
      },
    });

    toast.success("Wildcard box added");
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
    const template =
      nodeButtons.find((button) => button.id === newNodeType) ?? nodeButtons[0];
    if (!template) return;

    try {
      const customFields = parseCustomFields();
      handleAddNode(template.id, {
        data: {
          ...template.data,
          label: newNodeLabel.trim() || template.data.label,
          description: newNodeDescription.trim() || template.data.description,
          customFields,
        },
      });
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
      <Panel
        className={`max-h-[72vh] overflow-y-auto rounded-2xl border border-primary/35 glass-lite shadow-lg transition-all duration-150 ${
          isCollapsed ? "w-16 p-2" : "w-[24rem] p-3"
        }`}
        onDoubleClick={(e) => e.stopPropagation()}
        position="top-left"
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            {isCollapsed ? null : (
              <p className="font-semibold text-sm text-foreground">Canvas Actions</p>
            )}
            <Button
              className="h-9 w-9 rounded-xl"
              onClick={() => setIsCollapsed((current) => !current)}
              size="icon"
              variant="outline"
            >
              {isCollapsed ? <ChevronsRightIcon size={16} /> : <ChevronsLeftIcon size={16} />}
            </Button>
          </div>

          {isCollapsed ? (
            <div className="space-y-2">
              <Button
                className="h-10 w-10 rounded-xl"
                onClick={() => setIsCollapsed(false)}
                size="icon"
                variant="default"
              >
                <BoxesIcon size={16} />
              </Button>
            </div>
          ) : (
            <>
              <AddTab
                componentGroups={canvasActionOptions.componentGroups}
                environmentOptions={canvasActionOptions.environmentOptions}
                onAddNode={handleAddNode}
                onAddWildcard={handleAddWildcardNode}
                onOpenCreateBox={() => setDialogOpen(true)}
                zoneOptions={canvasActionOptions.zoneOptions}
              />

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-2 text-xs">
                <p className="font-medium text-primary">
                  Hierarchy: environment -&gt; zone -&gt; vm/group -&gt; app/database resources.
                </p>
                {activeZoneId ? (
                  <Button
                    className="mt-2 h-8 w-full"
                    onClick={() => setActiveZoneId(undefined)}
                    variant="outline"
                  >
                    Exit Zone
                  </Button>
                ) : null}
              </div>

              <div className="rounded-xl border border-pink-200 bg-pink-50/65 p-2 text-xs text-pink-800">
                <p className="font-medium">Edge styles</p>
                <p>Solid line: enforced and currently active traffic path.</p>
                <p>Dotted line: planned, optional, or conditional traffic path.</p>
              </div>

              {selectedEdge ? (
                <div className="rounded-xl border border-border p-2 text-xs space-y-2">
                  <p className="font-semibold text-foreground">Selected Edge</p>
                  <div className="grid gap-1">
                    <p className="text-muted-foreground">Direction</p>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2"
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
                  <div className="grid gap-1">
                    <p className="text-muted-foreground">Line style</p>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2"
                      onChange={(event) =>
                        updateSelectedEdgeMetadata({
                          lineStyle: event.target.value as EdgeLineStyle,
                        })
                      }
                      value={selectedEdgeMetadata.lineStyle}
                    >
                      <option value="solid">Solid</option>
                      <option value="dotted">Dotted</option>
                    </select>
                    <p className="text-[11px] text-muted-foreground">
                      Solid = enforced/active traffic path. Dotted = optional, planned, or conditional path.
                    </p>
                  </div>
                  <div className="grid gap-1">
                    <p className="text-muted-foreground">Connection type</p>
                    <select
                      className="h-8 rounded-md border border-input bg-background px-2"
                      onChange={(event) =>
                        updateSelectedEdgeMetadata({
                          connectionType: event.target.value as EdgeConnectionType,
                        })
                      }
                      value={selectedEdgeMetadata.connectionType}
                    >
                      <option value="firewall-request">Firewall Request</option>
                      <option value="data-flow">Data Flow</option>
                      <option value="management">Management</option>
                      <option value="replication">Replication</option>
                    </select>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </Panel>

      <RightToolbar
        activeDesignId={activeDesignId}
        activeVersion={activeVersion}
        designName={designName}
        gitlabPath={gitlabPath}
        isCollapsed={isRightToolbarCollapsed}
        metadataLocked={Boolean(activeDesignId)}
        onDesignNameChange={setDesignName}
        onExportIdacTemplate={() => exportCanvasAsIdacTemplateExcel(withGraph(), exportBase)}
        onExportJpeg={() => exportCanvasAsJpeg(withGraph(), exportBase)}
        onExportMachineExcel={() => exportCanvasAsExcel(withGraph(), `${exportBase}-machine`)}
        onExportPng={() => exportCanvasAsPng(withGraph(), exportBase)}
        onLoadDesign={loadDesign}
        onNew={handleNewDesign}
        onOpen={() => {
          void handleOpenDialog().catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Failed to open dialog";
            toast.error(message);
          });
        }}
        onProjectCodeChange={setProjectCode}
        onSaveLocal={() => {
          saveDesignToDevice(activeVersion);
          toast.success("Design saved locally");
        }}
        onSaveSupabase={() => {
          void saveToSupabase().catch((error: unknown) => {
            const message = error instanceof Error ? error.message : "Failed to save to Supabase";
            toast.error(message);
          });
        }}
        onTeamSlugChange={setTeamSlug}
        onToggleCollapsed={() => setIsRightToolbarCollapsed((current) => !current)}
        onVersionChange={async (versionId) => {
          await loadDesign(activeDesignId, versionId);
        }}
        projectCode={projectCode}
        selectedVersionId={selectedVersionId}
        teamSlug={teamSlug}
        versions={versions}
      />

      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Create Box</DialogTitle>
            <DialogDescription>
              Set node type and add any custom fields as JSON.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <select
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              onChange={(event) => setNewNodeType(event.target.value)}
              value={newNodeType}
            >
              {nodeButtons.map((button) => (
                <option key={button.id} value={button.id}>
                  {button.label}
                </option>
              ))}
            </select>

            <Textarea
              className="min-h-10"
              onChange={(event) => setNewNodeLabel(event.target.value)}
              placeholder="Label"
              value={newNodeLabel}
            />

            <Textarea
              className="min-h-14"
              onChange={(event) => setNewNodeDescription(event.target.value)}
              placeholder="Description"
              value={newNodeDescription}
            />

            <Textarea
              className="min-h-24 font-mono"
              onChange={(event) => setNewNodeFields(event.target.value)}
              placeholder='{"owner":"ITIS","criticality":"high"}'
              value={newNodeFields}
            />
          </div>

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
    </>
  );
};

export const Toolbar = memo(ToolbarInner);

