export function patternToRegex(pattern: string): RegExp {
  const hostOnly = pattern.split('/')[0]!;
  const apexMatch = hostOnly.match(/^\*\.(.+)$/);
  if (apexMatch) {
    const escHost = apexMatch[1]!.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^https?://(.*\\.)?${escHost}(/.*)?$`, 'i');
  }
  const escaped = hostOnly.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*/g, '.*');
  return new RegExp(`^https?://${withWildcards}(/.*)?$`, 'i');
}

export function normalizeUrl(url: string): string {
  return new URL(url).host.toLowerCase();
}

export function matchesPattern(pattern: string, url: string): boolean {
  return patternToRegex(pattern).test(url);
}
