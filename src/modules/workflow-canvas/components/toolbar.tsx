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
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  PlusCircleIcon,
  SaveIcon,
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
  exportCanvasAsImage,
  exportCanvasAsJpeg,
  exportCanvasAsPdf,
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
  name: string;
  team_slug?: string;
  project_code?: string;
  design_key?: string;
  version?: number;
  gitlab_path?: string | null;
  created_at: string;
  updated_at: string;
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
  designName: string;
  teamSlug: string;
  projectCode: string;
  activeVersion: number;
  gitlabPath: string;
  designs: DesignSummary[];
  onDesignNameChange: (name: string) => void;
  onTeamSlugChange: (value: string) => void;
  onProjectCodeChange: (value: string) => void;
  onCreateDesign: () => Promise<void>;
  onSaveDesign: () => Promise<void>;
  onSaveLocal: () => void;
  onLoadDesign: (id: string) => Promise<void>;
  onDeleteDesign: () => Promise<void>;
}

const DesignTab = ({
  activeDesignId,
  designName,
  teamSlug,
  projectCode,
  activeVersion,
  gitlabPath,
  designs,
  onDesignNameChange,
  onTeamSlugChange,
  onProjectCodeChange,
  onCreateDesign,
  onSaveDesign,
  onSaveLocal,
  onLoadDesign,
  onDeleteDesign,
}: DesignTabProps) => (
  <div className="space-y-3">
    <Textarea
      className="min-h-10 rounded-xl"
      onChange={(event) => onDesignNameChange(event.target.value)}
      placeholder="Design name"
      value={designName}
    />

    <div className="grid grid-cols-2 gap-2">
      <input
        className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        onChange={(event) => onTeamSlugChange(event.target.value)}
        placeholder="Team"
        value={teamSlug}
      />
      <input
        className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        onChange={(event) => onProjectCodeChange(event.target.value)}
        placeholder="Project"
        value={projectCode}
      />
    </div>

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
        disabled={!activeDesignId}
        onClick={() => {
          void onDeleteDesign().catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Failed to delete design";
            toast.error(message);
          });
        }}
        variant="destructive"
      >
        <Trash2Icon size={16} />
      </Button>
    </div>

    <div className="grid grid-cols-3 gap-2">
      <Button
        className="h-10 rounded-xl"
        onClick={() => {
          void onSaveDesign().catch((error: unknown) => {
            const message =
              error instanceof Error ? error.message : "Failed to save design";
            toast.error(message);
          });
        }}
      >
        <SaveIcon size={16} />
        Save
      </Button>
      <Button className="h-10 rounded-xl" onClick={onSaveLocal} variant="secondary">
        <DownloadIcon size={16} />
        Local
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
  onExportPdf: () => Promise<void>;
  onExportImage: () => void;
  onExportPng: () => void;
  onExportJpeg: () => void;
}

const ExportTab = ({
  onExportMachineExcel,
  onExportIdacTemplate,
  onExportPdf,
  onExportImage,
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
    <Button
      className="h-10 rounded-xl"
      onClick={() => {
        void onExportPdf();
      }}
      variant="outline"
    >
      <FileTextIcon size={16} />
      PDF
    </Button>
    <Button className="h-10 rounded-xl" onClick={onExportImage} variant="outline">
      <FileImageIcon size={16} />
      Image
    </Button>
    <Button className="h-10 rounded-xl" onClick={onExportPng} variant="outline">
      <DownloadIcon size={16} />
      PNG
    </Button>
    <Button className="col-span-2 h-10 rounded-xl" onClick={onExportJpeg} variant="outline">
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

  const navigateToCanvasRoot = useCallback(() => {
    if (pathname !== "/workflow-canvas") {
      router.replace("/workflow-canvas");
    }
  }, [pathname, router]);

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
    setDesigns(payload.designs ?? []);
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

    const payload = (await response.json()) as { design: DesignPayload };
    setActiveDesignId(payload.design.id);
    navigateToDesign(payload.design.id);
    setDesignName(payload.design.name);
    setTeamSlug(payload.design.team_slug ?? normalizedTeam);
    setProjectCode(payload.design.project_code ?? normalizedProject);
    setActiveVersion(payload.design.version ?? 1);
    setGitlabPath(payload.design.gitlab_path ?? "");
    await fetchDesigns();
    saveDesignToDevice(payload.design.version ?? 1);
    toast.success("Design created");
  };

  const saveDesign = async () => {
    if (!activeDesignId) {
      await createDesign();
      return;
    }

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

      const payload = (await response.json()) as { design: DesignPayload };
      setActiveDesignId(payload.design.id);
      navigateToDesign(payload.design.id);
      setDesignName(payload.design.name);
      setTeamSlug(payload.design.team_slug ?? teamSlug);
      setProjectCode(payload.design.project_code ?? projectCode);
      setActiveVersion(payload.design.version ?? activeVersion + 1);
      setGitlabPath(payload.design.gitlab_path ?? "");

    await fetchDesigns();
      saveDesignToDevice(payload.design.version ?? activeVersion + 1);
    toast.success("Design saved");
  };

  const loadDesign = useCallback(async (designId: string) => {
    const response = await fetch(`/api/workflow-canvas/designs/${designId}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        ...buildOwnerHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error("Failed to load design");
    }

    const payload = (await response.json()) as { design: DesignPayload };
    setNodes(payload.design.nodes ?? []);
    setEdges(payload.design.edges ?? []);
    setActiveDesignId(payload.design.id);
    navigateToDesign(payload.design.id);
    setDesignName(payload.design.name);
    setTeamSlug(payload.design.team_slug ?? "default-team");
    setProjectCode(payload.design.project_code ?? "default-project");
    setActiveVersion(payload.design.version ?? 1);
    setGitlabPath(payload.design.gitlab_path ?? "");

    setTimeout(() => {
      fitView({ duration: 400, padding: 0.15 });
    }, 50);

    toast.success("Design loaded");
  }, [buildOwnerHeaders, fitView, navigateToDesign, setEdges, setNodes]);

  const deleteDesign = async () => {
    if (!activeDesignId) return;

    const response = await fetch(`/api/workflow-canvas/designs/${activeDesignId}`, {
      method: "DELETE",
      headers: {
        ...buildOwnerHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error("Failed to delete design");
    }

    setActiveDesignId("");
    setDesignName("Untitled design");
    setActiveVersion(1);
    setGitlabPath("");
    navigateToCanvasRoot();
    await fetchDesigns();
    toast.success("Design deleted");
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
                    <label className="text-muted-foreground">Direction</label>
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
                    <label className="text-muted-foreground">Line style</label>
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
                  </div>
                  <div className="grid gap-1">
                    <label className="text-muted-foreground">Connection type</label>
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
                  onCreateDesign={createDesign}
                  onDeleteDesign={deleteDesign}
                  onDesignNameChange={setDesignName}
                  onLoadDesign={loadDesign}
                  onProjectCodeChange={setProjectCode}
                  onSaveDesign={saveDesign}
                  onSaveLocal={() => {
                    saveDesignToDevice(activeVersion);
                    toast.success("Design saved locally");
                  }}
                  onTeamSlugChange={setTeamSlug}
                  projectCode={projectCode}
                  teamSlug={teamSlug}
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
                  onExportImage={() => exportCanvasAsImage(withGraph(), exportBase)}
                  onExportJpeg={() => exportCanvasAsJpeg(withGraph(), exportBase)}
                  onExportPdf={() => exportCanvasAsPdf(withGraph(), exportBase)}
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

