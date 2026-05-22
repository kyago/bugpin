import { PII_QUERY_KEYS } from '@/shared/constants';

const PII_SET = new Set(PII_QUERY_KEYS.map(k => k.toLowerCase()));

export function scrubPii(url: string): string {
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  for (const key of [...u.searchParams.keys()]) {
    if (PII_SET.has(key.toLowerCase())) u.searchParams.set(key, '***');
  }
  return u.toString();
}
