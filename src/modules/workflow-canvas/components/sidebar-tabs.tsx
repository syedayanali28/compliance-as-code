"use client";

import { useCallback, useState } from "react";
import {
  ChevronsLeftIcon,
  ChevronsRightIcon,
  LayoutIcon,
  PaletteIcon,
  SettingsIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/modules/workflow-canvas/lib/utils";
import {
  RIGHT_SIDEBAR_MAX,
  RIGHT_SIDEBAR_MIN,
  SIDEBAR_COLLAPSED_PX,
} from "@/modules/workflow-canvas/hooks/use-canvas-sidebar-widths";

interface SidebarTabsProps {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  widthPx: number;
  onWidthChange: (nextWidth: number) => void;
  diagramTab: React.ReactNode;
  styleTab: React.ReactNode;
  formatTab?: React.ReactNode;
}

export const SidebarTabs = ({
  isCollapsed,
  onToggleCollapsed,
  widthPx,
  onWidthChange,
  diagramTab,
  styleTab,
  formatTab,
}: SidebarTabsProps) => {
  const [activeTab, setActiveTab] = useState<"diagram" | "style" | "format">("diagram");

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const el = event.currentTarget;
      el.setPointerCapture(event.pointerId);
      const startX = event.clientX;
      const startW = widthPx;

      const onMove = (ev: PointerEvent) => {
        const next = Math.min(
          RIGHT_SIDEBAR_MAX,
          Math.max(RIGHT_SIDEBAR_MIN, Math.round(startW + startX - ev.clientX))
        );
        onWidthChange(next);
      };

      const onUp = (ev: PointerEvent) => {
        try {
          el.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        document.body.style.removeProperty("cursor");
        document.body.style.removeProperty("user-select");
      };

      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
    },
    [onWidthChange, widthPx]
  );

  return (
    <div
      className={cn(
        "fixed right-0 top-10 bottom-0 z-[150] flex flex-col border-l border-border bg-white shadow-sm dark:bg-card",
        isCollapsed ? "p-1" : "p-0"
      )}
      onDoubleClick={(event) => event.stopPropagation()}
      style={{ width: isCollapsed ? SIDEBAR_COLLAPSED_PX : widthPx }}
    >
      {!isCollapsed ? (
        <div
          aria-orientation="vertical"
          aria-valuenow={widthPx}
          className="absolute left-0 top-0 z-20 h-full w-1.5 cursor-col-resize touch-none hover:bg-primary/25 active:bg-primary/35"
          onPointerDown={onResizePointerDown}
          role="separator"
          title="Drag to resize"
        />
      ) : null}

      {/* Tab Headers */}
      {!isCollapsed ? (
        <div className="flex items-center border-b border-border pl-1.5">
          <button
            className={cn(
              "flex flex-1 items-center justify-center gap-1 border-r border-border px-1 py-1.5 text-xs font-medium transition-colors",
              activeTab === "diagram"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50"
            )}
            onClick={() => setActiveTab("diagram")}
            type="button"
          >
            <LayoutIcon size={14} />
            Diagram
          </button>
          <button
            className={cn(
              "flex flex-1 items-center justify-center gap-1 px-1 py-1.5 text-xs font-medium transition-colors",
              activeTab === "style"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50"
            )}
            onClick={() => setActiveTab("style")}
            type="button"
          >
            <PaletteIcon size={14} />
            Style
          </button>
          {formatTab ? (
            <button
              className={cn(
                "flex flex-1 items-center justify-center gap-1 border-l border-border px-1 py-1.5 text-xs font-medium transition-colors",
                activeTab === "format"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
              onClick={() => setActiveTab("format")}
              type="button"
            >
              <SettingsIcon size={14} />
              Format
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Tab Content */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isCollapsed ? (
          <div className="flex justify-center pt-1">
            <Button
              className="h-7 w-7 rounded"
              onClick={onToggleCollapsed}
              size="icon"
              variant="ghost"
              title="Expand"
            >
              <ChevronsLeftIcon size={14} />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-end border-b border-border p-1 pl-2">
              <Button
                className="h-6 w-6 rounded"
                onClick={onToggleCollapsed}
                size="icon"
                variant="ghost"
                title="Collapse"
              >
                <ChevronsRightIcon size={14} />
              </Button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1.5 pl-2">
              {activeTab === "diagram" ? diagramTab : null}
              {activeTab === "style" ? styleTab : null}
              {activeTab === "format" ? formatTab : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
