import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ghCreateIssue, ghCheckAuth, ghCheckRepo } from '@/background/github-api';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('github-api', () => {
  it('ghCreateIssue returns ok on 201', async () => {
    (fetch as any).mockResolvedValue(new Response(
      JSON.stringify({ number: 7, html_url: 'https://github.com/o/r/issues/7' }),
      { status: 201, headers: { 'content-type': 'application/json' } }
    ));
    const result = await ghCreateIssue('token', 'o/r', 'T', 'B');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.number).toBe(7);
      expect(result.htmlUrl).toContain('/issues/7');
    }
  });

  it('ghCreateIssue maps 401 to auth', async () => {
    (fetch as any).mockResolvedValue(new Response('', { status: 401 }));
    const result = await ghCreateIssue('t', 'o/r', 'T', 'B');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('auth');
  });

  it('ghCheckAuth returns 200', async () => {
    (fetch as any).mockResolvedValue(new Response('{"login":"u"}', { status: 200 }));
    const result = await ghCheckAuth('t');
    expect(result.status).toBe(200);
  });
});

// keep reference so unused import is not stripped
void ghCheckRepo;
