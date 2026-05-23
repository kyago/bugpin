import { describe, it, expect, beforeEach } from 'vitest';
import chrome from 'sinon-chrome';
import { handleBootstrap } from '@/background/panel-bootstrap';

beforeEach(() => {
  chrome.flush();
});

describe('handleBootstrap', () => {
  it('returns null activeMappingId when storage empty', async () => {
    chrome.storage.local.get.resolves({});
    const result = await handleBootstrap(1, 'https://x.com');
    expect(result.activeMappingId).toBeNull();
    expect(result.allCandidates).toEqual([]);
    expect(result.tabId).toBe(1);
    expect(result.hostOnly).toBe('x.com');
  });

  it('picks best mapping', async () => {
    chrome.storage.local.get.resolves({
      qaExt: {
        schemaVersion: 1,
        mappings: [
          { id: 'a', name: 'A', urlPatterns: ['*.vercel.app'], repo: 'o/r', token: 't', lastVerifiedAt: null, createdAt: 0 },
          { id: 'b', name: 'B', urlPatterns: ['myapp-*-myorg.vercel.app'], repo: 'o/r', token: 't', lastVerifiedAt: null, createdAt: 0 },
        ],
      },
    });
    const result = await handleBootstrap(1, 'https://myapp-feat-myorg.vercel.app/');
    expect(result.activeMappingId).toBe('b');
    expect(new Set(result.allCandidates)).toEqual(new Set(['a', 'b']));
  });
});
