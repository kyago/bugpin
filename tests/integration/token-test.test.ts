import { describe, it, expect, vi, beforeEach } from 'vitest';
import chrome from 'sinon-chrome';
import { handleTokenTest } from '@/background/token-test';

beforeEach(() => {
  chrome.flush();
  vi.stubGlobal('fetch', vi.fn());
});

describe('handleTokenTest', () => {
  it('returns ok when both checks pass', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [{
        id: 'a', name: 'A', urlPatterns: ['x.com'], repo: 'o/r',
        token: 't', lastVerifiedAt: null, createdAt: 0,
      }]},
    });
    chrome.storage.local.set.resolves();
    (fetch as any).mockResolvedValueOnce(new Response('{"login":"u"}', { status: 200 }));
    (fetch as any).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const result = await handleTokenTest('a');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.repo).toBe('o/r');
  });

  it('returns auth failure on 401', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [{
        id: 'a', name: 'A', urlPatterns: ['x.com'], repo: 'o/r',
        token: 't', lastVerifiedAt: null, createdAt: 0,
      }]},
    });
    (fetch as any).mockResolvedValueOnce(new Response('', { status: 401 }));
    const result = await handleTokenTest('a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.step).toBe('auth');
  });

  it('returns repo failure on 404', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [{
        id: 'a', name: 'A', urlPatterns: ['x.com'], repo: 'o/r',
        token: 't', lastVerifiedAt: null, createdAt: 0,
      }]},
    });
    (fetch as any).mockResolvedValueOnce(new Response('{"login":"u"}', { status: 200 }));
    (fetch as any).mockResolvedValueOnce(new Response('', { status: 404 }));
    const result = await handleTokenTest('a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.step).toBe('repo');
  });
});
