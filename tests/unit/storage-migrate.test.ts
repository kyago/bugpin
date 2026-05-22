import { describe, it, expect } from 'vitest';
import { migrateStorage } from '@/lib/storage-migrate';

describe('migrateStorage', () => {
  it('returns initial schema when storage is empty', () => {
    const result = migrateStorage(undefined);
    expect(result).toEqual({ schemaVersion: 1, mappings: [] });
  });

  it('returns initial schema when raw is null', () => {
    expect(migrateStorage(null)).toEqual({ schemaVersion: 1, mappings: [] });
  });

  it('passes through valid v1', () => {
    const v1 = {
      schemaVersion: 1,
      mappings: [{
        id: 'a', name: 'A', urlPatterns: ['x.com'], repo: 'o/r',
        token: 't', lastVerifiedAt: null, createdAt: 1,
      }],
    };
    expect(migrateStorage(v1)).toEqual(v1);
  });

  it('discards unknown schemaVersion and re-initializes', () => {
    const result = migrateStorage({ schemaVersion: 99, mappings: [] });
    expect(result).toEqual({ schemaVersion: 1, mappings: [] });
  });

  it('initializes when shape is wrong', () => {
    expect(migrateStorage({ random: 'data' })).toEqual({ schemaVersion: 1, mappings: [] });
  });
});
