import type { IssueSubmitResult } from '@/shared/types';
import { GITHUB_API_BASE, GITHUB_API_VERSION, TIMEOUT_ISSUE_SUBMIT, TIMEOUT_TOKEN_TEST }
  from '@/shared/constants';
import { mapHttpToErrorCode, parseRetryAfter } from '@/lib/http-errors';

function authHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };
}

export async function ghCreateIssue(
  token: string, repo: string, title: string, body: string,
): Promise<IssueSubmitResult> {
  const url = `${GITHUB_API_BASE}/repos/${repo}/issues`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
      signal: AbortSignal.timeout(TIMEOUT_ISSUE_SUBMIT),
    });
  } catch (err) {
    return { ok: false, code: 'network', message: String(err) };
  }
  if (res.status === 201) {
    const j = await res.json();
    return { ok: true, number: j.number, htmlUrl: j.html_url };
  }
  const code = mapHttpToErrorCode(res.status, res.headers);
  const retryAfter = code === 'rate_limit' ? parseRetryAfter(res.headers, Date.now()) : undefined;
  const text = await res.text().catch(() => '');
  console.warn('[qa-ext] ghCreateIssue failed', {
    repo, status: res.status, code, body: text.slice(0, 500),
  });
  return { ok: false, code, message: text.slice(0, 200), retryAfter };
}

export async function ghCheckAuth(token: string): Promise<{ status: number }> {
  try {
    const res = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(TIMEOUT_TOKEN_TEST),
    });
    return { status: res.status };
  } catch {
    return { status: 0 };
  }
}

export async function ghCheckRepo(token: string, repo: string): Promise<{ status: number }> {
  try {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${repo}`, {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(TIMEOUT_TOKEN_TEST),
    });
    return { status: res.status };
  } catch {
    return { status: 0 };
  }
}
