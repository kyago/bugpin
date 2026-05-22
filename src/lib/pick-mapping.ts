import type { Mapping } from '@/shared/types';
import { patternToRegex } from './url-pattern';

interface Scored {
  mapping: Mapping;
  pattern: string;
  wildcardCount: number;
  length: number;
}

function scoreAllMatches(mappings: Mapping[], url: string): Scored[] {
  const out: Scored[] = [];
  for (const m of mappings) {
    for (const p of m.urlPatterns) {
      if (!patternToRegex(p).test(url)) continue;
      out.push({
        mapping: m, pattern: p,
        wildcardCount: (p.match(/\*/g) ?? []).length,
        length: p.length,
      });
    }
  }
  return out;
}

export function pickBestMapping(mappings: Mapping[], url: string): Mapping | null {
  const scored = scoreAllMatches(mappings, url);
  if (scored.length === 0) return null;
  scored.sort((a, b) =>
    a.wildcardCount !== b.wildcardCount
      ? a.wildcardCount - b.wildcardCount
      : b.length - a.length
  );
  return scored[0]!.mapping;
}

export function candidateMappings(mappings: Mapping[], url: string): string[] {
  const seen = new Set<string>();
  for (const s of scoreAllMatches(mappings, url)) seen.add(s.mapping.id);
  return [...seen];
}
