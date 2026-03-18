"use client";

import { memo } from "react";
import { Controls as ControlsPrimitive } from "./ai-elements/controls";
import { ThemeSwitcher } from "./theme-switcher";

export const ControlsInner = () => (
  // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Prevents ReactFlow double-click zoom
  <div className="pointer-events-none" onDoubleClick={(e) => e.stopPropagation()} role="toolbar">
    <ControlsPrimitive
      className="pointer-events-auto rounded-2xl [&>button]:size-11"
      orientation="horizontal"
      position="top-center"
      showInteractive={false}
    >
      <ThemeSwitcher />
    </ControlsPrimitive>
  </div>
);

export const Controls = memo(ControlsInner);

