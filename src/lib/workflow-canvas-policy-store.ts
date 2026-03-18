import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RuntimePolicyCatalog } from "@/modules/workflow-canvas/lib/policy-catalog";

const STORAGE_FILE = path.join(process.cwd(), "data", "workflow-canvas-policies.local.json");

const ensureStorageDir = async () => {
  await mkdir(path.dirname(STORAGE_FILE), { recursive: true });
};

const normalizeCatalog = (catalog: RuntimePolicyCatalog): RuntimePolicyCatalog => ({
  components: [...catalog.components].sort((a, b) =>
    a.componentKey.localeCompare(b.componentKey)
  ),
  rules: [...catalog.rules].sort((a, b) => a.policyId.localeCompare(b.policyId)),
});

const toComparablePayload = (catalog: RuntimePolicyCatalog) =>
  JSON.stringify(normalizeCatalog(catalog));

export const readLocalPolicyCatalog = async (): Promise<RuntimePolicyCatalog | null> => {
  try {
    const content = await readFile(STORAGE_FILE, "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const value = parsed as RuntimePolicyCatalog;
    if (!Array.isArray(value.components) || !Array.isArray(value.rules)) {
      return null;
    }

    return normalizeCatalog(value);
  } catch {
    return null;
  }
};

export const writeLocalPolicyCatalog = async (catalog: RuntimePolicyCatalog) => {
  await ensureStorageDir();
  await writeFile(
    STORAGE_FILE,
    JSON.stringify(normalizeCatalog(catalog), null, 2),
    "utf8"
  );
};

export const syncLocalPolicyCatalog = async (catalog: RuntimePolicyCatalog) => {
  const local = await readLocalPolicyCatalog();
  const nextComparable = toComparablePayload(catalog);
  const localComparable = local ? toComparablePayload(local) : null;

  if (localComparable === nextComparable) {
    return {
      changed: false,
      catalog: local,
    };
  }

  const normalized = normalizeCatalog(catalog);
  await writeLocalPolicyCatalog(normalized);
  return {
    changed: true,
    catalog: normalized,
  };
};
