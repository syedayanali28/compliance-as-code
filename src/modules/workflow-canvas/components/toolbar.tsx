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
  Trash2Icon,
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
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

interface DesignSummary {
  id: string;
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
  master_id: string;
  version: number;
  created_at?: string;
  updated_at?: string;
  name?: string;
}

interface DesignPayload {
  id: string;
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

type SidebarTab = "add" | "design" | "export";

interface SidebarRailProps {
  activeTab: SidebarTab;
  onSelect: (tab: SidebarTab) => void;
}

const SidebarRail = ({ activeTab, onSelect }: SidebarRailProps) => (
  <div className="space-y-2">
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="h-10 w-10 rounded-xl"
          onClick={() => onSelect("add")}
          size="icon"
          variant={activeTab === "add" ? "default" : "outline"}
        >
          <BoxesIcon size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Add Boxes</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="h-10 w-10 rounded-xl"
          onClick={() => onSelect("design")}
          size="icon"
          variant={activeTab === "design" ? "default" : "outline"}
        >
          <FolderOpenIcon size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Save and Load</TooltipContent>
    </Tooltip>
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          className="h-10 w-10 rounded-xl"
          onClick={() => onSelect("export")}
          size="icon"
          variant={activeTab === "export" ? "default" : "outline"}
        >
          <UploadIcon size={16} />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Export</TooltipContent>
    </Tooltip>
  </div>
);

interface AddTabProps {
  onAddNode: (selector: string, options?: Record<string, unknown>) => void;
  onOpenCreateBox: () => void;
  groupedButtons: Array<{
    family: string;
    label: string;
    icon: LucideIcon;
    options: Array<{
      id: string;
      label: string;
      data: Record<string, unknown>;
    }>;
  }>;
}

const AddTab = ({ onAddNode, onOpenCreateBox, groupedButtons }: AddTabProps) => {
  const [selectedByFamily, setSelectedByFamily] = useState<Record<string, string>>({});

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Add one high-level component, then choose its subtype.
      </p>
      <div className="space-y-2">
        {groupedButtons.map((group) => {
          const selected = selectedByFamily[group.family] ?? group.options[0]?.id ?? "";
          const selectedOption =
            group.options.find((option) => option.id === selected) ?? group.options[0];

          return (
            <div className="rounded-xl border border-border p-2" key={group.family}>
              <div className="mb-2 flex items-center gap-2">
                <group.icon size={14} />
                <p className="text-xs font-semibold text-foreground">{group.label}</p>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <select
                  className="h-9 rounded-lg border border-input bg-background px-2 text-xs"
                  onChange={(event) =>
                    setSelectedByFamily((current) => ({
                      ...current,
                      [group.family]: event.target.value,
                    }))
                  }
                  value={selected}
                >
                  {group.options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <Button
                  className="h-9 rounded-lg"
                  onClick={() => {
                    if (!selectedOption) {
                      return;
                    }
                    onAddNode(selectedOption.id, {
                      data: selectedOption.data,
                    });
                  }}
                  size="sm"
                  variant="outline"
                >
                  Add
                </Button>
              </div>
            </div>
          );
        })}
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

interface DesignTabProps {
  activeDesignId: string;
  selectedVersionId: string;
  designName: string;
  teamSlug: string;
  projectCode: string;
  activeVersion: number;
  gitlabPath: string;
  designs: DesignSummary[];
  versions: VersionSummary[];
  metadataLocked: boolean;
  onDesignNameChange: (name: string) => void;
  onTeamSlugChange: (value: string) => void;
  onProjectCodeChange: (value: string) => void;
  onVersionChange: (versionId: string) => Promise<void>;
  onCreateDesign: () => Promise<void>;
  onSaveSupabase: () => Promise<void>;
  onUploadGitlab: () => Promise<void>;
  onSaveLocal: () => void;
  onLoadDesign: (id: string) => Promise<void>;
}

const DesignTab = ({
  activeDesignId,
  selectedVersionId,
  designName,
  teamSlug,
  projectCode,
  activeVersion,
  gitlabPath,
  designs,
  versions,
  metadataLocked,
  onDesignNameChange,
  onTeamSlugChange,
  onProjectCodeChange,
  onVersionChange,
  onCreateDesign,
  onSaveSupabase,
  onUploadGitlab,
  onSaveLocal,
  onLoadDesign,
}: DesignTabProps) => (
  <div className="space-y-3">
    <Textarea
      className="min-h-10 rounded-xl"
      disabled={metadataLocked}
      onChange={(event) => onDesignNameChange(event.target.value)}
      placeholder="Design name"
      value={designName}
    />

    <div className="grid grid-cols-2 gap-2">
      <input
        className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        disabled={metadataLocked}
        onChange={(event) => onTeamSlugChange(event.target.value)}
        placeholder="Team"
        value={teamSlug}
      />
      <input
        className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        disabled={metadataLocked}
        onChange={(event) => onProjectCodeChange(event.target.value)}
        placeholder="Project"
        value={projectCode}
      />
    </div>

    {metadataLocked ? (
      <p className="text-[11px] text-muted-foreground">Metadata locked after first version creation.</p>
    ) : null}

    <div className="rounded-xl border border-border bg-muted/35 p-2 text-[11px] text-muted-foreground">
      <p>Version: v{Math.max(activeVersion, 1)}</p>
      <p className="truncate">Path: {gitlabPath || "(set after first cloud save)"}</p>
    </div>

    <div className="grid grid-cols-[1fr_auto] gap-2">
      <select
        className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        onChange={async (event) => {
          const id = event.target.value;
          if (!id) return;
          await onLoadDesign(id).catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Failed to load design";
            toast.error(message);
          });
        }}
        value={activeDesignId}
      >
        <option value="">Select saved design</option>
        {designs.map((design) => (
          <option key={design.id} value={design.id}>
            {design.name} {design.version ? `(v${design.version})` : ""}
          </option>
        ))}
      </select>
      <Button
        className="h-10 rounded-xl"
        disabled
        title="Immutable history: delete is disabled"
        variant="outline"
      >
        <Trash2Icon size={16} />
      </Button>
    </div>

    <select
      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
      disabled={!activeDesignId || versions.length === 0}
      onChange={async (event) => {
        const versionId = event.target.value;
        if (!activeDesignId) return;
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
        <option key={version.id} value={version.id}>
          v{version.version}
        </option>
      ))}
    </select>

    <div className="grid grid-cols-2 gap-2">
      <Button
        className="h-10 rounded-xl"
        onClick={onSaveLocal}
        variant="secondary"
      >
        <DownloadIcon size={16} />
        Save Local
      </Button>
      <Button
        className="h-10 rounded-xl"
        onClick={() => {
          void onSaveSupabase().catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Failed to save to Supabase";
            toast.error(message);
          });
        }}
      >
        <UploadIcon size={16} />
        Save Supabase
      </Button>
      <Button
        className="h-10 rounded-xl"
        disabled={!activeDesignId}
        onClick={() => {
          void onUploadGitlab().catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Failed to upload to GitLab";
            toast.error(message);
          });
        }}
        variant="outline"
      >
        <UploadIcon size={16} />
        Upload GitLab (Optional)
      </Button>
      <Button
        className="h-10 rounded-xl"
        onClick={() => {
          void onCreateDesign().catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Failed to create design";
            toast.error(message);
          });
        }}
        variant="outline"
      >
        <PlusCircleIcon size={16} />
        New
      </Button>
    </div>
  </div>
);

interface ExportTabProps {
  onExportMachineExcel: () => void;
  onExportIdacTemplate: () => void;
  onExportPng: () => void;
  onExportJpeg: () => void;
}

const ExportTab = ({
  onExportMachineExcel,
  onExportIdacTemplate,
  onExportPng,
  onExportJpeg,
}: ExportTabProps) => (
  <div className="grid grid-cols-2 gap-2">
    <Button className="h-10 rounded-xl" onClick={onExportMachineExcel} variant="outline">
      <FileSpreadsheetIcon size={16} />
      Nodes/Edges
    </Button>
    <Button className="h-10 rounded-xl" onClick={onExportIdacTemplate} variant="outline">
      <FileSpreadsheetIcon size={16} />
      IDaC Template
    </Button>
    <Button className="h-10 rounded-xl" onClick={onExportPng} variant="outline">
      <DownloadIcon size={16} />
      PNG
    </Button>
    <Button className="h-10 rounded-xl" onClick={onExportJpeg} variant="outline">
      <DownloadIcon size={16} />
      JPEG
    </Button>
  </div>
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
  const [activeTab, setActiveTab] = useState<SidebarTab>("add");
  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [activeDesignId, setActiveDesignId] = useState<string>("");
  const [selectedVersionId, setSelectedVersionId] = useState<string>("");
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [designName, setDesignName] = useState("Untitled design");
  const [teamSlug, setTeamSlug] = useState("default-team");
  const [projectCode, setProjectCode] = useState("default-project");
  const [activeVersion, setActiveVersion] = useState(1);
  const [gitlabPath, setGitlabPath] = useState("");
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
    const existing = window.localStorage.getItem(WORKFLOW_CANVAS_OWNER_STORAGE_KEY);
    if (existing) {
      return existing;
    }

    const created = crypto.randomUUID();
    window.localStorage.setItem(WORKFLOW_CANVAS_OWNER_STORAGE_KEY, created);
    return created;
  }, []);

  const buildOwnerHeaders = useCallback(() => {
    const ownerId = getOwnerId();
    return {
      [WORKFLOW_CANVAS_OWNER_HEADER]: ownerId,
    };
  }, [getOwnerId]);

  const fetchDesigns = useCallback(async () => {
    const response = await fetch("/api/workflow-canvas/designs", {
      method: "GET",
      cache: "no-store",
      headers: {
        ...buildOwnerHeaders(),
      },
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { designs: DesignSummary[] };
    const normalized = (payload.designs ?? []).map((design) => ({
      ...design,
      id: design.master_id ?? design.id,
    }));
    setDesigns(normalized);
  }, [buildOwnerHeaders]);

  const normalizeHierarchySegment = useCallback((value: string, fallback: string) => {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return normalized || fallback;
  }, []);

  const parseApiError = async (response: Response, fallback: string) => {
    try {
      const payload = (await response.json()) as { error?: string; details?: string };
      if (payload.error && payload.details) {
        return `${payload.error}: ${payload.details}`;
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
    fetchDesigns();
  }, [fetchDesigns]);

  useEffect(() => {
    if (!nodeButtons.length) {
      return;
    }

    if (!nodeButtons.some((button) => button.id === newNodeType)) {
      setNewNodeType(nodeButtons[0].id);
    }
  }, [nodeButtons, newNodeType]);

  const groupedButtons = useMemo(() => {
    const familyLabels: Record<string, string> = {
      environment: "Environment",
      zone: "Zone",
      firewall: "Firewall",
      database: "Database",
      backend: "Backend",
      frontend: "Frontend",
      integration: "Integration",
      control: "Control",
    };
    const familyOrder = [
      "environment",
      "zone",
      "firewall",
      "database",
      "backend",
      "frontend",
      "integration",
      "control",
    ];

    const groupMap = new Map<
      string,
      {
        family: string;
        label: string;
        icon: LucideIcon;
        options: Array<{
          id: string;
          label: string;
          data: Record<string, unknown>;
        }>;
      }
    >();

    for (const button of nodeButtons) {
      const rawFamily = String(
        (button.data.componentFamily as string | undefined) ??
          (button.data.category as string | undefined) ??
          "component"
      );
      const family = rawFamily.trim().toLowerCase();
      if (family === "drop") {
        continue;
      }

      if (!groupMap.has(family)) {
        groupMap.set(family, {
          family,
          label: familyLabels[family] ?? family.replace("-", " "),
          icon: button.icon,
          options: [],
        });
      }

      groupMap.get(family)?.options.push({
        id: button.id,
        label: button.label,
        data: button.data,
      });
    }

    return [...groupMap.values()]
      .sort(
        (a, b) =>
          familyOrder.indexOf(a.family) - familyOrder.indexOf(b.family)
      )
      .map((group) => ({
        ...group,
        options: group.options.sort((a, b) => a.label.localeCompare(b.label)),
      }));
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
    setSelectedVersionId(payload.design.id);
    setVersions(payload.versions ?? []);
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
        setSelectedVersionId(payload.design.id);
        setVersions(payload.versions ?? []);
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

  const uploadToGitlab = async () => {
    if (!activeDesignId) {
      throw new Error("Create and save the design to Supabase first.");
    }

    const response = await fetch(`/api/workflow-canvas/designs/${activeDesignId}/gitlab`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...buildOwnerHeaders(),
      },
      body: JSON.stringify({
        versionId: selectedVersionId || undefined,
      }),
    });

    if (!response.ok) {
      throw new Error(await parseApiError(response, "Failed to upload to GitLab"));
    }

    const payload = (await response.json()) as {
      commitSha?: string;
      webUrl?: string;
      version?: number;
    };

    if (payload.version) {
      toast.success(`Uploaded v${payload.version} to GitLab`);
    } else {
      toast.success("Uploaded to GitLab");
    }
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
    setSelectedVersionId(payload.design.id);
    setVersions(payload.versions ?? []);
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

      const reversePolicy = validateConnectionByPolicies(target, source, policyCatalog);
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
          isCollapsed ? "w-16 p-2" : "w-[20rem] p-3"
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
            <SidebarRail
              activeTab={activeTab}
              onSelect={(tab) => {
                setActiveTab(tab);
                setIsCollapsed(false);
              }}
            />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  className="h-10 rounded-xl text-xs"
                  onClick={() => setActiveTab("add")}
                  variant={activeTab === "add" ? "default" : "outline"}
                >
                  <BoxesIcon size={14} />
                  Add
                </Button>
                <Button
                  className="h-10 rounded-xl text-xs"
                  onClick={() => setActiveTab("design")}
                  variant={activeTab === "design" ? "default" : "outline"}
                >
                  <FolderOpenIcon size={14} />
                  Design
                </Button>
                <Button
                  className="h-10 rounded-xl text-xs"
                  onClick={() => setActiveTab("export")}
                  variant={activeTab === "export" ? "default" : "outline"}
                >
                  <UploadIcon size={14} />
                  Export
                </Button>
              </div>

              {activeTab === "add" ? (
                <AddTab
                  groupedButtons={groupedButtons}
                  onAddNode={handleAddNode}
                  onOpenCreateBox={() => setDialogOpen(true)}
                />
              ) : null}

              {activeTab === "add" ? (
                <div className="rounded-xl border border-primary/30 bg-primary/5 p-2 text-xs">
                  <p className="font-medium text-primary">
                    {activeZoneId
                      ? `Placing components inside selected zone (${activeZoneId.slice(0, 8)}...)`
                      : "Select an environment/zone box to place components inside it."}
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
              ) : null}

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

              {activeTab === "design" ? (
                <DesignTab
                  activeDesignId={activeDesignId}
                  activeVersion={activeVersion}
                  designName={designName}
                  designs={designs}
                  gitlabPath={gitlabPath}
                  metadataLocked={Boolean(activeDesignId)}
                  onCreateDesign={createDesign}
                  onDesignNameChange={setDesignName}
                  onLoadDesign={loadDesign}
                  onProjectCodeChange={setProjectCode}
                  onSaveSupabase={saveToSupabase}
                  onUploadGitlab={uploadToGitlab}
                  onSaveLocal={() => {
                    saveDesignToDevice(activeVersion);
                    toast.success("Design saved locally");
                  }}
                  onTeamSlugChange={setTeamSlug}
                  onVersionChange={async (versionId) => {
                    await loadDesign(activeDesignId, versionId);
                  }}
                  projectCode={projectCode}
                  selectedVersionId={selectedVersionId}
                  teamSlug={teamSlug}
                  versions={versions}
                />
              ) : null}

              {activeTab === "export" ? (
                <ExportTab
                  onExportIdacTemplate={() =>
                    exportCanvasAsIdacTemplateExcel(withGraph(), exportBase)
                  }
                  onExportMachineExcel={() =>
                    exportCanvasAsExcel(withGraph(), `${exportBase}-machine`)
                  }
                  onExportJpeg={() => exportCanvasAsJpeg(withGraph(), exportBase)}
                  onExportPng={() => exportCanvasAsPng(withGraph(), exportBase)}
                />
              ) : null}
            </>
          )}
        </div>
      </Panel>

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
    </>
  );
};

export const Toolbar = memo(ToolbarInner);

