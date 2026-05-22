import { describe, it, expect } from 'vitest';
import { dedupePush } from '@/lib/ring-buffer';
import type { ConsoleErrorEntry } from '@/shared/types';

const mk = (m: string, src: ConsoleErrorEntry['source'] = 'console.error'): ConsoleErrorEntry => ({
  message: m, timestamp: Date.now(), source: src, count: 1,
});

describe('dedupePush', () => {
  it('increments count when last matches', () => {
    const buf: ConsoleErrorEntry[] = [];
    dedupePush(buf, mk('TypeError: x'));
    dedupePush(buf, mk('TypeError: x'));
    dedupePush(buf, mk('TypeError: x'));
    expect(buf.length).toBe(1);
    expect(buf[0]!.count).toBe(3);
  });

  it('pushes new entry when source differs', () => {
    const buf: ConsoleErrorEntry[] = [];
    dedupePush(buf, mk('x', 'console.error'));
    dedupePush(buf, mk('x', 'window.onerror'));
    expect(buf.length).toBe(2);
  });

  it('pushes new entry when prefix differs', () => {
    const buf: ConsoleErrorEntry[] = [];
    dedupePush(buf, mk('A'));
    dedupePush(buf, mk('B'));
    expect(buf.length).toBe(2);
  });

  it('only dedups against last entry, not anywhere in buffer', () => {
    const buf: ConsoleErrorEntry[] = [];
    dedupePush(buf, mk('A'));
    dedupePush(buf, mk('B'));
    dedupePush(buf, mk('A'));
    expect(buf.length).toBe(3); // [A, B, A] not collapsed
  });

  it('FIFO drops oldest when exceeding cap', () => {
    const buf: ConsoleErrorEntry[] = [];
    for (let i = 0; i < 60; i++) dedupePush(buf, mk(`msg-${i}`));
    expect(buf.length).toBe(50);
    expect(buf[0]!.message).toBe('msg-10');
  });
});
