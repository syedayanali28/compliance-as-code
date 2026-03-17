import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface LocalDesignRecord {
  id: string;
  user_id: string;
  name: string;
  nodes: unknown[];
  edges: unknown[];
  team_slug: string;
  project_code: string;
  design_key: string;
  version: number;
  gitlab_path: string;
  created_at: string;
  updated_at: string;
}

const STORAGE_FILE = path.join(process.cwd(), "data", "workflow-canvas-designs.local.json");

const ensureStorageDir = async () => {
  await mkdir(path.dirname(STORAGE_FILE), { recursive: true });
};

const readRecords = async (): Promise<LocalDesignRecord[]> => {
  try {
    const content = await readFile(STORAGE_FILE, "utf8");
    const parsed = JSON.parse(content) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as LocalDesignRecord[];
  } catch {
    return [];
  }
};

const writeRecords = async (records: LocalDesignRecord[]) => {
  await ensureStorageDir();
  await writeFile(STORAGE_FILE, JSON.stringify(records, null, 2), "utf8");
};

export const listLocalDesigns = async (ownerId: string) => {
  const records = await readRecords();
  return records
    .filter((record) => record.user_id === ownerId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
};

export const getLocalDesign = async (ownerId: string, designId: string) => {
  const records = await readRecords();
  return records.find((record) => record.user_id === ownerId && record.id === designId) ?? null;
};

export const createLocalDesign = async (
  record: Omit<LocalDesignRecord, "created_at" | "updated_at">
) => {
  const records = await readRecords();
  const now = new Date().toISOString();
  const created: LocalDesignRecord = {
    ...record,
    created_at: now,
    updated_at: now,
  };

  records.push(created);
  await writeRecords(records);
  return created;
};

export const getLatestLocalVersion = async (
  ownerId: string,
  teamSlug: string,
  projectCode: string,
  designKey: string
) => {
  const records = await readRecords();
  return records
    .filter(
      (record) =>
        record.user_id === ownerId &&
        record.team_slug === teamSlug &&
        record.project_code === projectCode &&
        record.design_key === designKey
    )
    .reduce((max, record) => Math.max(max, record.version), 0);
};

export const deleteLocalDesign = async (ownerId: string, designId: string) => {
  const records = await readRecords();
  const next = records.filter(
    (record) => !(record.user_id === ownerId && record.id === designId)
  );

  if (next.length === records.length) {
    return false;
  }

  await writeRecords(next);
  return true;
};
