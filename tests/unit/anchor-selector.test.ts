import { describe, it, expect, beforeEach } from 'vitest';
import { isAutoId, buildNthChildSelector, buildPickInfo } from '@/lib/anchor-selector';

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

describe('buildPickInfo (no anchor)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('falls back to nth-child path when no anchor exists', () => {
    document.body.innerHTML = `<div><div><span>x</span></div></div>`;
    const span = document.querySelector('span')!;
    const info = buildPickInfo(span);
    expect(info.selector).toMatch(/^body > /);
    expect(info.selector).toContain('span');
    expect(info.anchorChain).toEqual([]);
    expect(info.sourceFile).toBeNull();
  });
});

describe('buildPickInfo — data-* tiers', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('tier 1: [data-block] picked as anchor', () => {
    document.body.innerHTML = `
      <section>
        <div data-block="card">
          <button>buy</button>
        </div>
      </section>`;
    const btn = document.querySelector('button')!;
    const info = buildPickInfo(btn);
    expect(info.selector).toContain('[data-block="card"]');
    expect(info.selector).toContain('button');
    expect(info.anchorChain).toEqual(['card']);
  });

  it('tier 2: [data-sentry-component] picks anchor and extracts sourceFile', () => {
    document.body.innerHTML = `
      <div data-sentry-component="Pricing" data-sentry-source-file="Pricing.tsx">
        <span>$</span>
      </div>`;
    const span = document.querySelector('span')!;
    const info = buildPickInfo(span);
    expect(info.selector).toContain('[data-sentry-component="Pricing"]');
    expect(info.anchorChain[0]).toBe('Pricing');
    expect(info.sourceFile).toBe('Pricing.tsx');
  });

  it('tier 2: sentry without source-file → sourceFile=null', () => {
    document.body.innerHTML = `<div data-sentry-component="X"><i>i</i></div>`;
    const info = buildPickInfo(document.querySelector('i')!);
    expect(info.sourceFile).toBeNull();
  });

  it('tier 3: [data-section]', () => {
    document.body.innerHTML = `<div data-section="hero"><p>txt</p></div>`;
    const info = buildPickInfo(document.querySelector('p')!);
    expect(info.selector).toContain('[data-section="hero"]');
    expect(info.anchorChain).toEqual(['hero']);
  });

  it('tier 1 has priority over tier 2 (innermost block beats outer component)', () => {
    document.body.innerHTML = `
      <div data-sentry-component="Outer">
        <div data-block="inner">
          <span>x</span>
        </div>
      </div>`;
    const info = buildPickInfo(document.querySelector('span')!);
    expect(info.selector).toContain('[data-block="inner"]');
  });
});
