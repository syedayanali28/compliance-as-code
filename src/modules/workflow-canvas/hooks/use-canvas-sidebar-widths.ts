"use client";

import { useCallback, useEffect, useState } from "react";

export const LEFT_SIDEBAR_WIDTH_KEY = "workflow-canvas-sidebar-left-w";
export const RIGHT_SIDEBAR_WIDTH_KEY = "workflow-canvas-sidebar-right-w";

export const LEFT_SIDEBAR_MIN = 120;
export const LEFT_SIDEBAR_MAX = 480;
export const RIGHT_SIDEBAR_MIN = 160;
export const RIGHT_SIDEBAR_MAX = 560;

/** Below this width, shape tiles use a 2-column grid; at or above, single-column list rows. */
export const SIDEBAR_COMPACT_BREAKPOINT_PX = 200;

export const DEFAULT_LEFT_SIDEBAR_W = 200;
export const DEFAULT_RIGHT_SIDEBAR_W = 256;

export const SIDEBAR_COLLAPSED_PX = 40;

function readStoredWidth(key: string, fallback: number) {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    if (!raw) {
      return fallback;
    }
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

export function useCanvasSidebarWidths() {
  const [leftWidth, setLeftWidthState] = useState(DEFAULT_LEFT_SIDEBAR_W);
  const [rightWidth, setRightWidthState] = useState(DEFAULT_RIGHT_SIDEBAR_W);
  const [widthsLoaded, setWidthsLoaded] = useState(false);

  useEffect(() => {
    setLeftWidthState(
      readStoredWidth(LEFT_SIDEBAR_WIDTH_KEY, DEFAULT_LEFT_SIDEBAR_W)
    );
    setRightWidthState(
      readStoredWidth(RIGHT_SIDEBAR_WIDTH_KEY, DEFAULT_RIGHT_SIDEBAR_W)
    );
    setWidthsLoaded(true);
  }, []);

  const setLeftWidth = useCallback((w: number) => {
    setLeftWidthState(
      Math.min(LEFT_SIDEBAR_MAX, Math.max(LEFT_SIDEBAR_MIN, Math.round(w)))
    );
  }, []);

  const setRightWidth = useCallback((w: number) => {
    setRightWidthState(
      Math.min(RIGHT_SIDEBAR_MAX, Math.max(RIGHT_SIDEBAR_MIN, Math.round(w)))
    );
  }, []);

  useEffect(() => {
    if (!widthsLoaded) {
      return;
    }
    try {
      globalThis.localStorage?.setItem(LEFT_SIDEBAR_WIDTH_KEY, String(leftWidth));
    } catch {
      /* ignore */
    }
  }, [leftWidth, widthsLoaded]);

  useEffect(() => {
    if (!widthsLoaded) {
      return;
    }
    try {
      globalThis.localStorage?.setItem(RIGHT_SIDEBAR_WIDTH_KEY, String(rightWidth));
    } catch {
      /* ignore */
    }
  }, [rightWidth, widthsLoaded]);

  return { leftWidth, rightWidth, setLeftWidth, setRightWidth };
}
