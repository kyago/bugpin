import type { StorageSchema } from '@/shared/types';

const EMPTY: StorageSchema = { schemaVersion: 1, mappings: [] };

export function migrateStorage(raw: unknown): StorageSchema {
  if (raw == null || typeof raw !== 'object') return EMPTY;
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion === 1 && Array.isArray(obj.mappings)) {
    return { schemaVersion: 1, mappings: obj.mappings as StorageSchema['mappings'] };
  }
  return EMPTY;
}
