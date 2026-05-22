import { describe, it, expect } from 'vitest';
import { patternToRegex, normalizeUrl, matchesPattern } from '@/lib/url-pattern';

describe('patternToRegex', () => {
  it('matches plain host', () => {
    expect(matchesPattern('myapp.com', 'https://myapp.com/x?y=1')).toBe(true);
  });
  it('rejects different subdomain when no wildcard', () => {
    expect(matchesPattern('myapp.com', 'https://staging.myapp.com/')).toBe(false);
  });
  it('wildcard inside host', () => {
    expect(matchesPattern('myapp-*-myorg.vercel.app',
      'https://myapp-feat-login-myorg.vercel.app/products')).toBe(true);
  });
  it('apex match — *.X also matches X', () => {
    expect(matchesPattern('*.vercel.app', 'https://vercel.app/foo')).toBe(true);
    expect(matchesPattern('*.vercel.app', 'https://abc.vercel.app/foo')).toBe(true);
  });
  it('localhost with port', () => {
    expect(matchesPattern('localhost:3000', 'http://localhost:3000/dashboard')).toBe(true);
  });
  it('strips path from user input', () => {
    expect(matchesPattern('myapp.com/admin/x', 'https://myapp.com/anything')).toBe(true);
  });
  it('case-insensitive', () => {
    expect(matchesPattern('MyApp.com', 'https://myapp.com/')).toBe(true);
  });
  it('does not match other host', () => {
    expect(matchesPattern('myapp.com', 'https://other.com/')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('returns host with port', () => {
    expect(normalizeUrl('http://localhost:3000/x?y=1')).toBe('localhost:3000');
  });
  it('lowercases host', () => {
    expect(normalizeUrl('https://MyApp.COM/')).toBe('myapp.com');
  });
});
