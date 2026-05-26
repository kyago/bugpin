import { describe, it, expect, beforeEach } from 'vitest';
import { isAutoId, buildNthChildSelector } from '@/lib/anchor-selector';

describe('isAutoId', () => {
  it('rejects React useId pattern :r0:', () => {
    expect(isAutoId(':r0:')).toBe(true);
    expect(isAutoId(':r1a:')).toBe(true);
    expect(isAutoId(':rab')).toBe(true);
  });
  it('rejects pure numeric ids', () => {
    expect(isAutoId('123')).toBe(true);
  });
  it('accepts intentional ids', () => {
    expect(isAutoId('checkout-form')).toBe(false);
    expect(isAutoId('__next')).toBe(false);
    expect(isAutoId('hero')).toBe(false);
  });
});

describe('buildNthChildSelector (fallback)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('builds full nth-child path from body', () => {
    document.body.innerHTML = `<main><section><button>a</button><button>b</button></section></main>`;
    const btn = document.querySelectorAll('button')[1]!;
    const sel = buildNthChildSelector(btn);
    expect(sel).toMatch(/^body > /);
    expect(sel).toContain('nth-child(2)');
  });

  it('includes first class for clarity', () => {
    document.body.innerHTML = `<div class="card"><div class="card inner"></div></div>`;
    const inner = document.querySelectorAll('.card')[1]!;
    expect(buildNthChildSelector(inner)).toContain('.card');
  });

  it('returns "body" for the body element itself', () => {
    expect(buildNthChildSelector(document.body)).toBe('body');
  });
});
