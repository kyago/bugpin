import type { Mapping, StorageSchema } from '@/shared/types';
import { migrateStorage } from '@/lib/storage-migrate';

const STORAGE_KEY = 'qaExt';

async function readSchema(): Promise<StorageSchema> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  return migrateStorage(raw?.[STORAGE_KEY]);
}

async function writeSchema(schema: StorageSchema): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: schema });
}

export async function loadMappings(): Promise<Mapping[]> {
  return (await readSchema()).mappings;
}

export async function saveMapping(mapping: Mapping): Promise<void> {
  const schema = await readSchema();
  const idx = schema.mappings.findIndex(m => m.id === mapping.id);
  if (idx >= 0) schema.mappings[idx] = mapping;
  else schema.mappings.push(mapping);
  await writeSchema(schema);
}

export async function deleteMapping(id: string): Promise<void> {
  const schema = await readSchema();
  schema.mappings = schema.mappings.filter(m => m.id !== id);
  await writeSchema(schema);
}

export async function getMapping(id: string): Promise<Mapping | null> {
  const schema = await readSchema();
  return schema.mappings.find(m => m.id === id) ?? null;
}

export async function touchVerified(id: string, ts: number): Promise<void> {
  const schema = await readSchema();
  const m = schema.mappings.find(m => m.id === id);
  if (m) {
    m.lastVerifiedAt = ts;
    await writeSchema(schema);
  }
}
