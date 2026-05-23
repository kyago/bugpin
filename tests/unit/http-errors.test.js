import { describe, it, expect } from 'vitest';
import { mapHttpToErrorCode, parseRetryAfter } from '@/lib/http-errors';
describe('mapHttpToErrorCode', () => {
    it('401 → auth', () => {
        expect(mapHttpToErrorCode(401, new Headers())).toBe('auth');
    });
    it('403 with Retry-After → rate_limit', () => {
        expect(mapHttpToErrorCode(403, new Headers({ 'Retry-After': '30' }))).toBe('rate_limit');
    });
    it('403 with X-RateLimit-Remaining: 0 → rate_limit', () => {
        expect(mapHttpToErrorCode(403, new Headers({ 'X-RateLimit-Remaining': '0' }))).toBe('rate_limit');
    });
    it('403 default → forbidden', () => {
        expect(mapHttpToErrorCode(403, new Headers())).toBe('forbidden');
    });
    it('404 → not_found', () => {
        expect(mapHttpToErrorCode(404, new Headers())).toBe('not_found');
    });
    it('422 → validation', () => {
        expect(mapHttpToErrorCode(422, new Headers())).toBe('validation');
    });
    it('500 → unknown', () => {
        expect(mapHttpToErrorCode(500, new Headers())).toBe('unknown');
    });
    it('other → unknown', () => {
        expect(mapHttpToErrorCode(418, new Headers())).toBe('unknown');
    });
});
describe('parseRetryAfter', () => {
    it('integer seconds from Retry-After', () => {
        const h = new Headers({ 'Retry-After': '30' });
        expect(parseRetryAfter(h, 1000)).toBe(30);
    });
    it('uses X-RateLimit-Reset (epoch sec) when no Retry-After', () => {
        const h = new Headers({ 'X-RateLimit-Reset': '1010' });
        expect(parseRetryAfter(h, 1_000_000)).toBe(1010 - 1000);
    });
    it('HTTP-date in Retry-After', () => {
        const future = new Date(Date.now() + 60_000).toUTCString();
        const h = new Headers({ 'Retry-After': future });
        const result = parseRetryAfter(h, Date.now());
        expect(result).toBeGreaterThan(50);
        expect(result).toBeLessThan(70);
    });
    it('returns 0 when no headers', () => {
        expect(parseRetryAfter(new Headers(), Date.now())).toBe(0);
    });
});
