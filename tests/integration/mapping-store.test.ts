import { describe, it, expect, beforeEach } from 'vitest';
import chrome from 'sinon-chrome';
import { loadMappings, saveMapping, deleteMapping } from '@/background/mapping-store';
import type { Mapping } from '@/shared/types';

beforeEach(() => {
  chrome.flush();
  chrome.storage.local.get.resolves({});
  chrome.storage.local.set.resolves();
});

const mk = (id: string): Mapping => ({
  id, name: `Map-${id}`, urlPatterns: ['x.com'], repo: 'o/r',
  token: 't', lastVerifiedAt: null, createdAt: 0,
});

describe('mapping-store', () => {
  it('loadMappings returns empty when storage is empty', async () => {
    chrome.storage.local.get.resolves({});
    const m = await loadMappings();
    expect(m).toEqual([]);
  });

  it('loadMappings migrates and returns mappings', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [mk('a')] }
    });
    const m = await loadMappings();
    expect(m).toHaveLength(1);
    expect(m[0]!.id).toBe('a');
  });

  it('saveMapping adds new entry', async () => {
    chrome.storage.local.get.resolves({ qaExt: { schemaVersion: 1, mappings: [] } });
    await saveMapping(mk('a'));
    const setCall = chrome.storage.local.set.firstCall.args[0];
    expect(setCall.qaExt.mappings).toHaveLength(1);
  });

  it('saveMapping updates existing entry', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [mk('a')] }
    });
    const updated = { ...mk('a'), name: 'Updated' };
    await saveMapping(updated);
    const setCall = chrome.storage.local.set.firstCall.args[0];
    expect(setCall.qaExt.mappings[0].name).toBe('Updated');
  });

  it('deleteMapping removes entry', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [mk('a'), mk('b')] }
    });
    await deleteMapping('a');
    const setCall = chrome.storage.local.set.firstCall.args[0];
    expect(setCall.qaExt.mappings).toHaveLength(1);
    expect(setCall.qaExt.mappings[0].id).toBe('b');
  });
});
