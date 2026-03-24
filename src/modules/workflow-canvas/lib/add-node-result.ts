export type AddNodeResult =
  | { ok: true; nodeId: string }
  | { ok: false; level: "error" | "warning"; title: string; message: string };

export const addNodeSuccess = (nodeId: string): AddNodeResult => ({
  ok: true,
  nodeId,
});

export const addNodeFailure = (
  level: "error" | "warning",
  title: string,
  message: string
): AddNodeResult => ({
  ok: false,
  level,
  title,
  message,
});

/** Human-readable labels for hierarchy levels shown in toasts and dialogs. */
export const hierarchyCategoryLabel = (category: string): string => {
  const labels: Record<string, string> = {
    zone: "Zone",
    region: "Region",
    environment: "Environment",
    compute: "Compute",
  };
  return labels[category] ?? category;
};
