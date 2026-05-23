import { describe, it, expect, vi, beforeEach } from 'vitest';
import chrome from 'sinon-chrome';
import { handleIssueSubmit, _resetThrottle } from '@/background/issue-submit';
import type { IssueDraft } from '@/shared/types';

const mkDraft = (mappingId: string, finalBody = 'body'): IssueDraft => ({
  mappingId, title: 'T', userDescription: 'U', collected: {} as any,
  finalBody, bodyOverridden: false,
});

beforeEach(() => {
  chrome.flush();
  vi.stubGlobal('fetch', vi.fn());
  _resetThrottle();
  chrome.storage.local.get.resolves({
    qaExt: { schemaVersion: 1, mappings: [{
      id: 'a', name: 'A', urlPatterns: ['x.com'], repo: 'o/r',
      token: 't', lastVerifiedAt: null, createdAt: 0,
    }]},
  });
});

describe('handleIssueSubmit', () => {
  it('returns ok on 201', async () => {
    (fetch as any).mockResolvedValue(new Response(
      JSON.stringify({ number: 5, html_url: 'https://github.com/o/r/issues/5' }),
      { status: 201 }
    ));
    const result = await handleIssueSubmit(mkDraft('a'));
    expect(result.ok).toBe(true);
  });

  it('returns error when mapping not found', async () => {
    const result = await handleIssueSubmit(mkDraft('missing'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not_found');
  });

  it('returns auth error on 401', async () => {
    (fetch as any).mockResolvedValue(new Response('', { status: 401 }));
    const result = await handleIssueSubmit(mkDraft('a'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('auth');
  });
});
