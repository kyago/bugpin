import { describe, it, expect } from 'vitest';
import { Buffers, ingestMessage } from '@/content-iso/buffer';
describe('content-iso buffer', () => {
    it('ignores message without source marker', () => {
        const b = new Buffers();
        ingestMessage(b, { foo: 1 });
        expect(b.consoleErrors).toHaveLength(0);
        expect(b.networkFailures).toHaveLength(0);
    });
    it('ingests console.error', () => {
        const b = new Buffers();
        ingestMessage(b, {
            __qaSource: 'qa-ext',
            kind: 'console.error',
            entry: { message: 'oops', source: 'console.error', timestamp: 1 },
        });
        expect(b.consoleErrors).toHaveLength(1);
        expect(b.consoleErrors[0].count).toBe(1);
    });
    it('dedups consecutive identical errors', () => {
        const b = new Buffers();
        for (let i = 0; i < 5; i++) {
            ingestMessage(b, {
                __qaSource: 'qa-ext', kind: 'console.error',
                entry: { message: 'same', source: 'console.error', timestamp: i },
            });
        }
        expect(b.consoleErrors).toHaveLength(1);
        expect(b.consoleErrors[0].count).toBe(5);
    });
    it('ingests network.failure', () => {
        const b = new Buffers();
        ingestMessage(b, {
            __qaSource: 'qa-ext', kind: 'network.failure',
            entry: { method: 'GET', url: '/api', status: 500, statusText: 'err', timestamp: 1 },
        });
        expect(b.networkFailures).toHaveLength(1);
    });
});
