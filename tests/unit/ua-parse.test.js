import { describe, it, expect, vi } from 'vitest';
import { parseUAString, captureUserAgent } from '@/lib/ua-parse';
describe('parseUAString', () => {
    it('parses Chrome on macOS', () => {
        const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
        const result = parseUAString(ua);
        expect(result.browser).toContain('Chrome');
        expect(result.platform).toContain('Mac');
    });
    it('falls back gracefully on unknown UA', () => {
        const result = parseUAString('SomeUnknown/1.0');
        expect(result.userAgent).toBe('SomeUnknown/1.0');
        expect(result.browser).toBeTruthy();
        expect(result.platform).toBeTruthy();
    });
});
describe('captureUserAgent', () => {
    it('uses userAgentData when available', async () => {
        const fakeData = {
            getHighEntropyValues: vi.fn().mockResolvedValue({
                platform: 'macOS',
                platformVersion: '14.5',
                fullVersionList: [
                    { brand: 'Not-A.Brand', version: '99' },
                    { brand: 'Chromium', version: '138.0.0.0' },
                ],
            }),
        };
        Object.defineProperty(navigator, 'userAgentData', {
            value: fakeData, configurable: true,
        });
        const result = await captureUserAgent();
        expect(result.browser).toContain('Chromium');
        expect(result.platform).toContain('macOS');
    });
});
