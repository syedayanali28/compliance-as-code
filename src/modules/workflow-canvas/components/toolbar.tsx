"use client";

import type { Edge, Node } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
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
import { memo, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { nodeButtons } from "@/modules/workflow-canvas/lib/node-buttons";
import {
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
  created_at: string;
  updated_at: string;
}

interface DesignPayload {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
}

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
  onAddNode: (type: string, options?: Record<string, unknown>) => void;
  onOpenCreateBox: () => void;
}

const AddTab = ({ onAddNode, onOpenCreateBox }: AddTabProps) => (
  <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2">
      {nodeButtons.map((button) => (
        <Tooltip key={button.id}>
          <TooltipTrigger asChild>
            <Button
              className="h-10 justify-start gap-2 rounded-xl"
              onClick={() =>
                onAddNode(button.id, {
                  data: button.data,
                })
              }
              variant="outline"
            >
              <button.icon size={14} />
              <span className="truncate text-xs">{button.label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{button.label}</TooltipContent>
        </Tooltip>
      ))}
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

interface DesignTabProps {
  activeDesignId: string;
  designName: string;
  designs: DesignSummary[];
  onDesignNameChange: (name: string) => void;
  onCreateDesign: () => Promise<void>;
  onSaveDesign: () => Promise<void>;
  onLoadDesign: (id: string) => Promise<void>;
  onDeleteDesign: () => Promise<void>;
}

const DesignTab = ({
  activeDesignId,
  designName,
  designs,
  onDesignNameChange,
  onCreateDesign,
  onSaveDesign,
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

    <div className="grid grid-cols-[1fr_auto] gap-2">
      <select
        className="h-10 rounded-xl border border-input bg-background px-3 text-sm"
        onChange={async (event) => {
          const id = event.target.value;
          if (!id) return;
          await onLoadDesign(id);
        }}
        value={activeDesignId}
      >
        <option value="">Select saved design</option>
        {designs.map((design) => (
          <option key={design.id} value={design.id}>
            {design.name}
          </option>
        ))}
      </select>
      <Button
        className="h-10 rounded-xl"
        disabled={!activeDesignId}
        onClick={() => {
          void onDeleteDesign();
        }}
        variant="destructive"
      >
        <Trash2Icon size={16} />
      </Button>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <Button
        className="h-10 rounded-xl"
        onClick={() => {
          void onSaveDesign();
        }}
      >
        <SaveIcon size={16} />
        Save
      </Button>
      <Button
        className="h-10 rounded-xl"
        onClick={() => {
          void onCreateDesign();
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
  onExportExcel: () => void;
  onExportPdf: () => Promise<void>;
  onExportImage: () => void;
  onExportPng: () => void;
  onExportJpeg: () => void;
}

const ExportTab = ({
  onExportExcel,
  onExportPdf,
  onExportImage,
  onExportPng,
  onExportJpeg,
}: ExportTabProps) => (
  <div className="grid grid-cols-2 gap-2">
    <Button className="h-10 rounded-xl" onClick={onExportExcel} variant="outline">
      <FileSpreadsheetIcon size={16} />
      XLSX
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

export const ToolbarInner = () => {
  const { getViewport, getNodes, getEdges, setNodes, setEdges, fitView } =
    useReactFlow();
  const { addNode } = useNodeOperations();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>("add");
  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [activeDesignId, setActiveDesignId] = useState<string>("");
  const [designName, setDesignName] = useState("Untitled design");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newNodeType, setNewNodeType] = useState(nodeButtons[0]?.id ?? "environment");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeDescription, setNewNodeDescription] = useState("");
  const [newNodeFields, setNewNodeFields] = useState("{}");

  const fetchDesigns = useCallback(async () => {
    const response = await fetch("/api/workflow-canvas/designs", {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as { designs: DesignSummary[] };
    setDesigns(payload.designs ?? []);
  }, []);

  useEffect(() => {
    fetchDesigns();
  }, [fetchDesigns]);

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
    const response = await fetch("/api/workflow-canvas/designs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: designName,
        nodes: getNodes(),
        edges: getEdges(),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create design");
    }

    const payload = (await response.json()) as { design: DesignPayload };
    setActiveDesignId(payload.design.id);
    setDesignName(payload.design.name);
    await fetchDesigns();
    toast.success("Design created");
  };

  const saveDesign = async () => {
    if (!activeDesignId) {
      await createDesign();
      return;
    }

    const response = await fetch(`/api/workflow-canvas/designs/${activeDesignId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: designName,
        nodes: getNodes(),
        edges: getEdges(),
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to save design");
    }

    await fetchDesigns();
    toast.success("Design saved");
  };

  const loadDesign = async (designId: string) => {
    const response = await fetch(`/api/workflow-canvas/designs/${designId}`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Failed to load design");
    }

    const payload = (await response.json()) as { design: DesignPayload };
    setNodes(payload.design.nodes ?? []);
    setEdges(payload.design.edges ?? []);
    setActiveDesignId(payload.design.id);
    setDesignName(payload.design.name);

    setTimeout(() => {
      fitView({ duration: 400, padding: 0.15 });
    }, 50);

    toast.success("Design loaded");
  };

  const deleteDesign = async () => {
    if (!activeDesignId) return;

    const response = await fetch(`/api/workflow-canvas/designs/${activeDesignId}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error("Failed to delete design");
    }

    setActiveDesignId("");
    setDesignName("Untitled design");
    await fetchDesigns();
    toast.success("Design deleted");
  };

  const withGraph = () => ({
    nodes: getNodes(),
    edges: getEdges(),
  });

  const exportBase =
    designName.trim().replaceAll(" ", "-").toLowerCase() || "workflow-design";

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
                  onAddNode={handleAddNode}
                  onOpenCreateBox={() => setDialogOpen(true)}
                />
              ) : null}

              {activeTab === "design" ? (
                <DesignTab
                  activeDesignId={activeDesignId}
                  designName={designName}
                  designs={designs}
                  onCreateDesign={createDesign}
                  onDeleteDesign={deleteDesign}
                  onDesignNameChange={setDesignName}
                  onLoadDesign={loadDesign}
                  onSaveDesign={saveDesign}
                />
              ) : null}

              {activeTab === "export" ? (
                <ExportTab
                  onExportExcel={() => exportCanvasAsExcel(withGraph(), exportBase)}
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

