"use client";

import { useCallback, useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  PlusCircleIcon,
  SearchIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/modules/workflow-canvas/lib/utils";
import {
  LEFT_SIDEBAR_MAX,
  LEFT_SIDEBAR_MIN,
  SIDEBAR_COLLAPSED_PX,
  SIDEBAR_COMPACT_BREAKPOINT_PX,
} from "@/modules/workflow-canvas/hooks/use-canvas-sidebar-widths";

interface ComponentOption {
  id: string;
  label: string;
  icon: LucideIcon;
  data: Record<string, unknown>;
}

interface ComponentGroup {
  id: string;
  label: string;
  options: ComponentOption[];
}

interface LeftSidebarProps {
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  /** Pixel width when expanded; collapsed rail uses a fixed narrow width from parent. */
  widthPx: number;
  onWidthChange: (nextWidth: number) => void;
  environmentOptions: ComponentOption[];
  zoneOptions: ComponentOption[];
  componentGroups: ComponentGroup[];
  onAddNode: (selector: string, options?: Record<string, unknown>) => void;
  onOpenCreateBox: () => void;
}

export const LeftSidebar = ({
  isCollapsed,
  onToggleCollapsed,
  widthPx,
  onWidthChange,
  environmentOptions,
  zoneOptions,
  componentGroups,
  onAddNode,
  onOpenCreateBox,
}: LeftSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["environments", "zones", "components"])
  );

  const compact = !isCollapsed && widthPx < SIDEBAR_COMPACT_BREAKPOINT_PX;

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
          LEFT_SIDEBAR_MAX,
          Math.max(LEFT_SIDEBAR_MIN, Math.round(startW + ev.clientX - startX))
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

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const allComponents = componentGroups.flatMap((group) => group.options);
  const filteredComponents = searchQuery.trim()
    ? allComponents.filter((opt) =>
        opt.label.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const tileGridClass = compact ? "grid grid-cols-2 gap-1" : "flex flex-col gap-1";
  const envZoneButtonCompact =
    "flex flex-col items-center gap-0.5 rounded px-1 py-1 text-center text-xs hover:bg-accent";
  const envZoneButtonWide =
    "flex w-full flex-row items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-accent";
  const componentTileCompact =
    "flex flex-col items-center gap-0.5 rounded border border-border bg-background p-1 hover:bg-accent";
  const componentTileWide =
    "flex w-full flex-row items-center gap-2 rounded border border-border bg-background px-2 py-1.5 hover:bg-accent";

  return (
    <div
      className={cn(
        "fixed left-0 top-10 bottom-0 z-[150] flex flex-col border-r border-border bg-white shadow-sm dark:bg-card",
        isCollapsed ? "p-1" : "p-0"
      )}
      onDoubleClick={(e) => e.stopPropagation()}
      style={{ width: isCollapsed ? SIDEBAR_COLLAPSED_PX : widthPx }}
    >
      {isCollapsed ? (
        <div className="flex w-10 justify-center pt-1">
          <Button
            className="h-7 w-7 rounded"
            onClick={onToggleCollapsed}
            size="icon"
            variant="ghost"
            title="Expand shape library"
          >
            <ChevronsRightIcon size={14} />
          </Button>
        </div>
      ) : (
        <>
          <div
            aria-orientation="vertical"
            aria-valuenow={widthPx}
            className="absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize touch-none hover:bg-primary/25 active:bg-primary/35"
            onPointerDown={onResizePointerDown}
            role="separator"
            title="Drag to resize"
          />

          {/* Search Bar */}
          <div className="border-b border-border p-1 pr-2">
            <div className="relative">
              <SearchIcon className="absolute left-1.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-7 w-full rounded border border-input bg-background pl-7 pr-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Type / to search"
                value={searchQuery}
              />
            </div>
            {searchQuery && filteredComponents.length > 0 ? (
              <div
                className={cn(
                  "mt-2 max-h-60 overflow-y-auto rounded border border-border bg-muted/30 p-1",
                  compact ? "grid grid-cols-2 gap-1" : "space-y-1"
                )}
              >
                {filteredComponents.map((opt) => (
                  <button
                    className={cn(
                      "flex rounded px-1 py-1 text-left text-xs hover:bg-accent",
                      compact ? "flex-col items-center gap-0.5 text-center" : "items-center gap-2"
                    )}
                    key={opt.id}
                    onClick={() => {
                      onAddNode(opt.id, { data: opt.data });
                      setSearchQuery("");
                    }}
                    type="button"
                  >
                    <opt.icon size={14} className="shrink-0 text-muted-foreground" />
                    <span className={cn(compact && "line-clamp-2 text-[10px] leading-tight")}>
                      {opt.label}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {/* Scrollable Content */}
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-1.5">
            {/* Environments Section */}
            <div className="border-b border-border">
              <button
                className="flex w-full items-center justify-between px-1.5 py-1.5 text-xs font-semibold hover:bg-muted/50"
                onClick={() => toggleSection("environments")}
                type="button"
              >
                <span>Environments</span>
                {expandedSections.has("environments") ? (
                  <ChevronDownIcon size={14} />
                ) : (
                  <ChevronRightIcon size={14} />
                )}
              </button>
              {expandedSections.has("environments") ? (
                <div className={cn(tileGridClass, "px-1 pb-2")}>
                  {environmentOptions.map((opt) => (
                    <button
                      className={compact ? envZoneButtonCompact : envZoneButtonWide}
                      key={opt.id}
                      onClick={() => onAddNode(opt.id, { data: opt.data })}
                      type="button"
                    >
                      <div
                        className={cn(
                          "flex shrink-0 items-center justify-center rounded border border-border bg-background",
                          compact ? "h-6 w-6" : "h-7 w-7"
                        )}
                      >
                        <opt.icon
                          className="text-muted-foreground"
                          size={compact ? 12 : 14}
                        />
                      </div>
                      <span
                        className={cn(
                          compact
                            ? "w-full truncate text-[10px] leading-tight"
                            : "min-w-0 flex-1 truncate"
                        )}
                      >
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Zones Section */}
            <div className="border-b border-border">
              <button
                className="flex w-full items-center justify-between px-1.5 py-1.5 text-xs font-semibold hover:bg-muted/50"
                onClick={() => toggleSection("zones")}
                type="button"
              >
                <span>Zones</span>
                {expandedSections.has("zones") ? (
                  <ChevronDownIcon size={14} />
                ) : (
                  <ChevronRightIcon size={14} />
                )}
              </button>
              {expandedSections.has("zones") ? (
                <div className={cn(tileGridClass, "px-1 pb-2")}>
                  {zoneOptions.map((opt) => (
                    <button
                      className={compact ? envZoneButtonCompact : envZoneButtonWide}
                      key={opt.id}
                      onClick={() => onAddNode(opt.id, { data: opt.data })}
                      type="button"
                    >
                      <div
                        className={cn(
                          "flex shrink-0 items-center justify-center rounded border border-border bg-background",
                          compact ? "h-6 w-6" : "h-7 w-7"
                        )}
                      >
                        <opt.icon
                          className="text-muted-foreground"
                          size={compact ? 12 : 14}
                        />
                      </div>
                      <span
                        className={cn(
                          compact
                            ? "w-full truncate text-[10px] leading-tight"
                            : "min-w-0 flex-1 truncate"
                        )}
                      >
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Component Groups */}
            {componentGroups.map((group) => (
              <div className="border-b border-border" key={group.id}>
                <button
                  className="flex w-full items-center justify-between px-1.5 py-1.5 text-xs font-semibold hover:bg-muted/50"
                  onClick={() => toggleSection(group.id)}
                  type="button"
                >
                  <span>{group.label}</span>
                  {expandedSections.has(group.id) ? (
                    <ChevronDownIcon size={14} />
                  ) : (
                    <ChevronRightIcon size={14} />
                  )}
                </button>
                {expandedSections.has(group.id) ? (
                  <div className={cn(tileGridClass, "px-1 pb-2")}>
                    {group.options.map((opt) => (
                      <button
                        className={compact ? componentTileCompact : componentTileWide}
                        key={opt.id}
                        onClick={() => onAddNode(opt.id, { data: opt.data })}
                        title={opt.label}
                        type="button"
                      >
                        <opt.icon
                          className="shrink-0 text-muted-foreground"
                          size={compact ? 14 : 16}
                        />
                        <span
                          className={cn(
                            "truncate",
                            compact
                              ? "w-full text-center text-[10px] leading-tight"
                              : "min-w-0 flex-1 text-xs"
                          )}
                        >
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="space-y-1 border-t border-border p-1 pr-2">
            <Button
              className="h-7 w-full justify-start gap-1 px-1 text-xs"
              onClick={onOpenCreateBox}
              size="sm"
              type="button"
              variant="secondary"
            >
              <PlusCircleIcon size={14} />
              Create custom box
            </Button>
            <Button
              className="h-7 w-full justify-start gap-1 px-1 text-xs"
              onClick={onToggleCollapsed}
              size="sm"
              type="button"
              variant="ghost"
            >
              <ChevronsLeftIcon size={14} />
              Collapse
            </Button>
          </div>
        </>
      )}
    </div>
  );
};
