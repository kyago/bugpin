import { describe, it, expect } from 'vitest';
import { scrubPii } from '@/lib/sanitize-pii';
describe('scrubPii', () => {
    it('redacts access_token', () => {
        expect(scrubPii('https://x.com/?access_token=abc123&q=1'))
            .toBe('https://x.com/?access_token=***&q=1');
    });
    it('case-insensitive', () => {
        expect(scrubPii('https://x.com/?Token=abc'))
            .toBe('https://x.com/?Token=***');
    });
    it('multiple params', () => {
        const out = scrubPii('https://x.com/?api_key=a&secret=b&keep=c');
        expect(out).toContain('api_key=***');
        expect(out).toContain('secret=***');
        expect(out).toContain('keep=c');
    });
    it('returns original when no PII', () => {
        expect(scrubPii('https://x.com/page?q=1')).toBe('https://x.com/page?q=1');
    });
    it('handles invalid URL gracefully', () => {
        expect(scrubPii('not-a-url')).toBe('not-a-url');
    });
    it('redacts jwt and id_token', () => {
        const out = scrubPii('https://x.com/?jwt=AAA&id_token=BBB');
        expect(out).toContain('jwt=***');
        expect(out).toContain('id_token=***');
    });
});
