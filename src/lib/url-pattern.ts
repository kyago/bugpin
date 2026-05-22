/**
 * Converts a host-only wildcard pattern into a regex.
 *
 * Pattern syntax:
 *   - `*` matches any sequence of characters (host labels included)
 *   - `*.X` form matches both `X` (apex) and any subdomain of `X`
 *   - Anything after `/` is stripped — patterns are host-only
 *
 * Note: `*.X` intentionally matches any subdomain including deep ones
 * (e.g., `*.vercel.app` matches `evil.com.vercel.app` since it is a valid
 * subdomain). Use stricter patterns if domain-suffix isolation matters.
 */
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

/**
 * Extracts the lowercased host (with port if present) from a URL string.
 *
 * **Contract:** caller must pass a valid URL. This function does not handle
 * invalid input and will throw `TypeError` from `new URL()` for malformed
 * strings. Callers (background SW) obtain URLs from `chrome.tabs.query`
 * which guarantees validity.
 */
export function normalizeUrl(url: string): string {
  return new URL(url).host.toLowerCase();
}

/**
 * Tests whether a URL matches the given host-only wildcard pattern.
 * See `patternToRegex` for pattern syntax.
 */
export function matchesPattern(pattern: string, url: string): boolean {
  return patternToRegex(pattern).test(url);
}
