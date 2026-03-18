import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface LocalDesignRecord {
  id: string;
  design_id?: string;
  master_id: string;
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

const toComparableRecord = (
  record: Omit<LocalDesignRecord, "created_at" | "updated_at"> | LocalDesignRecord
) => ({
  id: record.id,
  design_id: record.design_id ?? "",
  master_id: record.master_id,
  user_id: record.user_id,
  name: record.name,
  nodes: record.nodes,
  edges: record.edges,
  team_slug: record.team_slug,
  project_code: record.project_code,
  design_key: record.design_key,
  version: record.version,
  gitlab_path: record.gitlab_path,
});

const isEquivalentRecord = (
  a: Omit<LocalDesignRecord, "created_at" | "updated_at"> | LocalDesignRecord,
  b: Omit<LocalDesignRecord, "created_at" | "updated_at"> | LocalDesignRecord
) => {
  return JSON.stringify(toComparableRecord(a)) === JSON.stringify(toComparableRecord(b));
};

export const listLocalDesignMasters = async (ownerId: string) => {
  const records = await readRecords();
  const owned = records.filter((record) => record.user_id === ownerId);
  const byMaster = new Map<string, LocalDesignRecord>();

  for (const record of owned) {
    const current = byMaster.get(record.master_id);
    if (!current || record.version > current.version) {
      byMaster.set(record.master_id, record);
    }
  }

  return [...byMaster.values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
};

export const listLocalVersions = async (ownerId: string, masterId: string) => {
  const records = await readRecords();
  return records
    .filter((record) => record.user_id === ownerId && record.master_id === masterId)
    .sort((a, b) => b.version - a.version)
    .map((record) => ({
      id: record.id,
      design_id: record.design_id,
      master_id: record.master_id,
      version: record.version,
      created_at: record.created_at,
      updated_at: record.updated_at,
      name: record.name,
    }));
};

export const searchLocalDesigns = async (
  ownerId: string,
  filters: {
    name?: string;
    teamSlug?: string;
    projectCode?: string;
    version?: number;
  }
) => {
  const records = await readRecords();
  const nameFilter = (filters.name ?? "").trim().toLowerCase();
  const teamFilter = (filters.teamSlug ?? "").trim().toLowerCase();
  const projectFilter = (filters.projectCode ?? "").trim().toLowerCase();

  return records
    .filter((record) => record.user_id === ownerId)
    .filter((record) => {
      if (nameFilter && !record.name.toLowerCase().includes(nameFilter)) {
        return false;
      }

      if (teamFilter && !record.team_slug.toLowerCase().includes(teamFilter)) {
        return false;
      }

      if (projectFilter && !record.project_code.toLowerCase().includes(projectFilter)) {
        return false;
      }

      if (typeof filters.version === "number" && Number.isFinite(filters.version)) {
        return record.version === filters.version;
      }

      return true;
    })
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
};

export const getLocalLatestDesignByMaster = async (ownerId: string, masterId: string) => {
  const records = await readRecords();
  const versions = records
    .filter((record) => record.user_id === ownerId && record.master_id === masterId)
    .sort((a, b) => b.version - a.version);

  return versions[0] ?? null;
};

export const getLocalDesign = async (
  ownerId: string,
  masterId: string,
  version?: number
) => {
  const design =
    typeof version === "number"
      ? (await readRecords())
          .filter((record) =>
            record.user_id === ownerId &&
            record.master_id === masterId &&
            record.version === version
          )
          .sort((a, b) => b.version - a.version)[0] ?? null
      : await getLocalLatestDesignByMaster(ownerId, masterId);

  const versions = await listLocalVersions(ownerId, masterId);
  return { design, versions };
};

export const getLocalDesignByDesignId = async (
  ownerId: string,
  masterId: string,
  designId: string
) => {
  const records = await readRecords();
  const design =
    records.find(
      (record) =>
        record.user_id === ownerId &&
        record.master_id === masterId &&
        (record.design_id === designId || record.id === designId)
    ) ?? null;

  const versions = await listLocalVersions(ownerId, masterId);
  return { design, versions };
};

export const getLocalDesignVersion = async (
  ownerId: string,
  masterId: string,
  versionId: string
) => {
  const records = await readRecords();
  return (
    records.find(
      (record) =>
        record.user_id === ownerId &&
        record.master_id === masterId &&
        record.id === versionId
    ) ?? null
  );
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

export const saveLocalDesign = async (
  record: Omit<LocalDesignRecord, "created_at" | "updated_at">
) => {
  return createLocalDesign(record);
};

export const mirrorLocalDesign = async (
  record: Omit<LocalDesignRecord, "created_at" | "updated_at">
) => {
  const records = await readRecords();
  const now = new Date().toISOString();
  const index = records.findIndex((existing) => existing.id === record.id);

  if (index >= 0) {
    if (isEquivalentRecord(records[index], record)) {
      return records[index];
    }

    records[index] = {
      ...record,
      created_at: records[index].created_at,
      updated_at: now,
    };
    await writeRecords(records);
    return records[index];
  }

  const created: LocalDesignRecord = {
    ...record,
    created_at: now,
    updated_at: now,
  };

  records.push(created);
  await writeRecords(records);
  return created;
};

export const syncLocalDesignFromRemote = async (
  record: Omit<LocalDesignRecord, "created_at" | "updated_at">
) => {
  const records = await readRecords();
  const index = records.findIndex((existing) => existing.id === record.id);
  const now = new Date().toISOString();

  if (index >= 0 && isEquivalentRecord(records[index], record)) {
    return {
      changed: false,
      design: records[index],
    };
  }

  if (index >= 0) {
    records[index] = {
      ...record,
      created_at: records[index].created_at,
      updated_at: now,
    };
    await writeRecords(records);
    return {
      changed: true,
      design: records[index],
    };
  }

  const created: LocalDesignRecord = {
    ...record,
    created_at: now,
    updated_at: now,
  };
  records.push(created);
  await writeRecords(records);

  return {
    changed: true,
    design: created,
  };
};

export const getLatestLocalVersionByMaster = async (ownerId: string, masterId: string) => {
  const records = await readRecords();
  return records
    .filter((record) => record.user_id === ownerId && record.master_id === masterId)
    .reduce((max, record) => Math.max(max, record.version), 0);
};

export const deleteLocalMaster = async (ownerId: string, masterId: string) => {
  const records = await readRecords();
  const next = records.filter(
    (record) => !(record.user_id === ownerId && record.master_id === masterId)
  );

  if (next.length === records.length) {
    return false;
  }

  await writeRecords(next);
  return true;
};
