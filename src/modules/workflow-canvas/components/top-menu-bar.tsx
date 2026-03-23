"use client";

import {
  ChevronDownIcon,
  MinusIcon,
  PlusIcon,
  RedoIcon,
  UndoIcon,
  DownloadIcon,
  SaveIcon,
  FolderOpenIcon,
  GridIcon,
  ShareIcon,
} from "lucide-react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import {
  WORKFLOW_MAX_ZOOM,
  WORKFLOW_MIN_ZOOM,
} from "@/modules/workflow-canvas/components/ai-elements/canvas";
import { AppSiteMenu } from "@/components/ui/app-site-menu";
import { useCanvasPreferences } from "@/modules/workflow-canvas/providers/canvas-preferences";

interface TopMenuBarProps {
  designName: string;
  onDesignNameChange: (name: string) => void;
  onSave: () => void;
  onExport: () => void;
  onOpen: () => void;
  onNew: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

const ZOOM_PRESETS = [25, 50, 75, 100, 125, 150, 200] as const;

export const TopMenuBar = ({
  designName,
  onDesignNameChange,
  onSave,
  onExport,
  onOpen,
  onNew,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
}: TopMenuBarProps) => {
  const { zoomIn, zoomOut, zoomTo, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const { showGrid, setShowGrid } = useCanvasPreferences();
  const zoomPercent = useMemo(() => Math.round(zoom * 100), [zoom]);

  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(designName);

  useEffect(() => {
    setEditedName(designName);
  }, [designName]);

  const clampZoomLevel = (level: number) =>
    Math.min(WORKFLOW_MAX_ZOOM, Math.max(WORKFLOW_MIN_ZOOM, level));

  const handleZoomIn = () => {
    zoomIn({ duration: 150 });
  };

  const handleZoomOut = () => {
    zoomOut({ duration: 150 });
  };

  const handleZoomPreset = (percent: number) => {
    zoomTo(clampZoomLevel(percent / 100), { duration: 200 });
  };

  const handleFitView = () => {
    void fitView({ duration: 220, padding: 0.16 });
  };

  const handleNameSave = () => {
    onDesignNameChange(editedName);
    setIsEditingName(false);
  };

  return (
    <div className="fixed left-0 right-0 top-0 z-[200] flex h-10 items-center border-b border-border bg-white pr-2 pl-2 shadow-sm dark:bg-card">
      {/* Left Section - Menus */}
      <div className="flex min-w-0 shrink items-center gap-0.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-normal">
              File
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={onNew}>
              <PlusIcon size={14} />
              New
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpen}>
              <FolderOpenIcon size={14} />
              Open
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onSave}>
              <SaveIcon size={14} />
              Save
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <DownloadIcon size={14} />
              Export
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-normal">
              Edit
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem disabled={!canUndo} onClick={onUndo}>
              <UndoIcon size={14} />
              Undo
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canRedo} onClick={onRedo}>
              <RedoIcon size={14} />
              Redo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-normal">
              View
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleZoomIn}>
              <PlusIcon size={14} />
              Zoom In
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleZoomOut}>
              <MinusIcon size={14} />
              Zoom Out
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleFitView}>
              Fit view
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowGrid(!showGrid)}>
              <GridIcon size={14} />
              {showGrid ? "Hide" : "Show"} background grid
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-normal">
              Arrange
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>Align Left</DropdownMenuItem>
            <DropdownMenuItem>Align Center</DropdownMenuItem>
            <DropdownMenuItem>Align Right</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs font-normal">
              Help
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>Documentation</DropdownMenuItem>
            <DropdownMenuItem>Keyboard Shortcuts</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>About</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Center Section - Document Title */}
      <div className="flex min-w-0 flex-1 items-center justify-center px-2">
        {isEditingName ? (
          <input
            autoFocus
            className="h-6 max-w-full rounded border border-input bg-background px-2 text-sm"
            onBlur={handleNameSave}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleNameSave();
              } else if (e.key === "Escape") {
                setEditedName(designName);
                setIsEditingName(false);
              }
            }}
            value={editedName}
          />
        ) : (
          <button
            className="max-w-full truncate rounded px-3 py-1 text-sm font-medium hover:bg-muted"
            onClick={() => setIsEditingName(true)}
            title="Rename design"
            type="button"
          >
            {designName}
          </button>
        )}
      </div>

      {/* Right Section - Tools */}
      <div className="flex shrink-0 items-center gap-1">
        <div className="mr-2 flex items-center gap-1">
          <Button
            disabled={!canUndo}
            onClick={onUndo}
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Undo"
          >
            <UndoIcon size={14} />
          </Button>
          <Button
            disabled={!canRedo}
            onClick={onRedo}
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            title="Redo"
          >
            <RedoIcon size={14} />
          </Button>
        </div>

        <div className="flex items-center gap-0.5 rounded border border-border bg-muted/30 px-1">
          <Button
            onClick={handleZoomOut}
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Zoom Out"
            type="button"
          >
            <MinusIcon size={12} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-6 min-w-[3.25rem] px-2 text-xs" type="button">
                {zoomPercent}%
                <ChevronDownIcon size={12} className="ml-0.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
              {ZOOM_PRESETS.map((pct) => (
                <DropdownMenuItem key={pct} onClick={() => handleZoomPreset(pct)}>
                  {pct}%
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleFitView}>Fit view</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            onClick={handleZoomIn}
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Zoom In"
            type="button"
          >
            <PlusIcon size={12} />
          </Button>
        </div>

        <Button
          onClick={onSave}
          size="sm"
          variant="ghost"
          className="ml-2 h-7 gap-1 px-2"
          type="button"
        >
          <ShareIcon size={14} />
          <span className="text-xs">Share</span>
        </Button>

        <AppSiteMenu
          className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border/80 bg-background text-foreground shadow-sm transition hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          zOverlay={260}
        />
      </div>
    </div>
  );
};
