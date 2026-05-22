import type { ErrorCode } from '@/shared/types';

export function mapHttpToErrorCode(status: number, headers: Headers): ErrorCode {
  if (status === 401) return 'auth';
  if (status === 403) {
    if (headers.has('Retry-After')) return 'rate_limit';
    if (headers.get('X-RateLimit-Remaining') === '0') return 'rate_limit';
    return 'forbidden';
  }
  if (status === 404) return 'not_found';
  if (status === 422) return 'validation';
  if (status >= 500 && status < 600) return 'unknown';
  return 'unknown';
}

/** Returns seconds until retry is allowed (0 if no info). */
export function parseRetryAfter(headers: Headers, nowMs: number): number {
  const ra = headers.get('Retry-After');
  if (ra) {
    const asInt = parseInt(ra, 10);
    if (!isNaN(asInt) && String(asInt) === ra.trim()) return asInt;
    const asDate = new Date(ra).getTime();
    if (!isNaN(asDate)) return Math.max(0, Math.floor((asDate - nowMs) / 1000));
  }
  const reset = headers.get('X-RateLimit-Reset');
  if (reset) {
    const epoch = parseInt(reset, 10);
    if (!isNaN(epoch)) return Math.max(0, epoch - Math.floor(nowMs / 1000));
  }
  return 0;
}
