"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const GRID_KEY = "workflow-canvas-show-grid";

type CanvasPreferencesValue = {
  showGrid: boolean;
  setShowGrid: (value: boolean) => void;
};

const CanvasPreferencesContext = createContext<CanvasPreferencesValue | null>(
  null
);

export function CanvasPreferencesProvider({ children }: { children: ReactNode }) {
  const [showGrid, setShowGridState] = useState(true);

  useEffect(() => {
    try {
      const raw = globalThis.localStorage?.getItem(GRID_KEY);
      if (raw === "false") {
        setShowGridState(false);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const setShowGrid = useCallback((value: boolean) => {
    setShowGridState(value);
    try {
      globalThis.localStorage?.setItem(GRID_KEY, String(value));
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ showGrid, setShowGrid }),
    [showGrid, setShowGrid]
  );

  return (
    <CanvasPreferencesContext.Provider value={value}>
      {children}
    </CanvasPreferencesContext.Provider>
  );
}

export function useCanvasPreferences() {
  const ctx = useContext(CanvasPreferencesContext);
  if (!ctx) {
    throw new Error("useCanvasPreferences must be used within CanvasPreferencesProvider");
  }
  return ctx;
}
