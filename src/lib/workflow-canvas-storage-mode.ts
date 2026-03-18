const parseBoolean = (value: string | undefined, fallback: boolean) => {
  if (value === undefined) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return fallback;
};

// Mirrors Supabase writes into local JSON for optional backup/version archive.
export const isWorkflowCanvasLocalMirrorEnabled = () =>
  parseBoolean(process.env.WORKFLOW_CANVAS_LOCAL_MIRROR_ENABLED, true);

// Allows reading local JSON when Supabase is unavailable.
// Keep false by default so product does not rely on local storage.
export const isWorkflowCanvasLocalFallbackEnabled = () =>
  parseBoolean(process.env.WORKFLOW_CANVAS_LOCAL_FALLBACK_ENABLED, false);
