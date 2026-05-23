import { describe, it, expect } from 'vitest';
import { pickBestMapping, candidateMappings } from '@/lib/pick-mapping';
const mk = (id, patterns) => ({
    id, name: id, urlPatterns: patterns, repo: 'o/r', token: 't',
    lastVerifiedAt: null, createdAt: 0,
});
describe('pickBestMapping', () => {
    it('returns null when no mapping matches', () => {
        expect(pickBestMapping([mk('a', ['other.com'])], 'https://myapp.com/')).toBeNull();
    });
    it('picks mapping with fewer wildcards', () => {
        const a = mk('a', ['*.vercel.app']);
        const b = mk('b', ['myapp-*-myorg.vercel.app']);
        const c = mk('c', ['myapp-stable-myorg.vercel.app']);
        const winner = pickBestMapping([a, b, c], 'https://myapp-stable-myorg.vercel.app/products');
        expect(winner?.id).toBe('c'); // 0 wildcards beats 1, 1 beats 2
    });
    it('on tie, longer pattern wins', () => {
        const a = mk('a', ['*.vercel.app']);
        const b = mk('b', ['myapp-*-myorg.vercel.app']);
        const winner = pickBestMapping([a, b], 'https://myapp-x-myorg.vercel.app/');
        expect(winner?.id).toBe('b');
    });
    it('flattens across mappings — multiple patterns per mapping', () => {
        const a = mk('a', ['something.else.com', '*.vercel.app']);
        const b = mk('b', ['myapp-*-myorg.vercel.app']);
        const winner = pickBestMapping([a, b], 'https://myapp-x-myorg.vercel.app/');
        expect(winner?.id).toBe('b');
    });
});
describe('candidateMappings', () => {
    it('returns all matching mapping ids', () => {
        const a = mk('a', ['*.vercel.app']);
        const b = mk('b', ['myapp-*-myorg.vercel.app']);
        const c = mk('c', ['other.com']);
        const ids = candidateMappings([a, b, c], 'https://myapp-x-myorg.vercel.app/');
        expect(new Set(ids)).toEqual(new Set(['a', 'b']));
    });
});
