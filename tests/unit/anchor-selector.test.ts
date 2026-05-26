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
    // chain 은 outer→inner 순서로 수집되므로 outer <section> tier 6 도 포함됨
    expect(info.anchorChain).toEqual(['section', 'card']);
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

describe('buildPickInfo — tier 4 (stable id)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('uses stable id as anchor', () => {
    document.body.innerHTML = `<div id="checkout"><button>buy</button></div>`;
    const info = buildPickInfo(document.querySelector('button')!);
    expect(info.selector).toContain('#checkout');
    expect(info.anchorChain).toEqual(['#checkout']);
  });

  it('skips auto id (:r0:) and falls through to lower tiers', () => {
    document.body.innerHTML = `<section><div id=":r0:"><button>x</button></div></section>`;
    const info = buildPickInfo(document.querySelector('button')!);
    expect(info.selector).not.toContain('#:r0:');
  });

  it('clicked element with its own stable id → anchor is the element itself', () => {
    document.body.innerHTML = `<button id="cta">x</button>`;
    const info = buildPickInfo(document.getElementById('cta')!);
    expect(info.selector).toBe('#cta');
    expect(info.anchorChain).toEqual(['#cta']);
  });
});

describe('buildPickInfo — tier 5 (role + optional aria-label)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('uses [role] alone when no aria-label', () => {
    document.body.innerHTML = `<div role="dialog"><span>x</span></div>`;
    const info = buildPickInfo(document.querySelector('span')!);
    expect(info.selector).toContain('[role="dialog"]');
    expect(info.anchorChain).toEqual(['dialog']);
  });

  it('combines [role][aria-label] when label present', () => {
    document.body.innerHTML = `<div role="button" aria-label="장바구니"><i>i</i></div>`;
    const info = buildPickInfo(document.querySelector('i')!);
    expect(info.selector).toContain('[role="button"][aria-label="장바구니"]');
    expect(info.anchorChain).toEqual(['장바구니']);
  });

  it('escapes special chars in aria-label', () => {
    document.body.innerHTML = `<div role="button" aria-label='Say "hi"'><i>i</i></div>`;
    const info = buildPickInfo(document.querySelector('i')!);
    expect(() => document.querySelectorAll(info.selector)).not.toThrow();
  });
});

describe('buildPickInfo — tier 6 (semantic tags)', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('uses <section> as anchor when no higher tier matches', () => {
    document.body.innerHTML = `<section><div><span>x</span></div></section>`;
    const info = buildPickInfo(document.querySelector('span')!);
    expect(info.selector.startsWith('section')).toBe(true);
    expect(info.anchorChain).toEqual(['section']);
  });

  it('uses innermost semantic ancestor', () => {
    document.body.innerHTML = `<main><article><span>x</span></article></main>`;
    const info = buildPickInfo(document.querySelector('span')!);
    expect(info.selector.startsWith('article')).toBe(true);
  });

  it('does NOT match non-semantic tags (div)', () => {
    document.body.innerHTML = `<div><span>x</span></div>`;
    const info = buildPickInfo(document.querySelector('span')!);
    expect(info.selector).toMatch(/^body > /);
    expect(info.anchorChain).toEqual([]);
  });
});

describe('buildPickInfo — anchor === target', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('returns anchor selector alone when clicked element IS the anchor', () => {
    document.body.innerHTML = `<div data-block="hero">x</div>`;
    const info = buildPickInfo(document.querySelector('[data-block]')!);
    expect(info.selector).toBe('[data-block="hero"]');
    expect(info.anchorChain).toEqual(['hero']);
  });

  it('same for role-based anchor', () => {
    document.body.innerHTML = `<button role="button" aria-label="OK">x</button>`;
    const info = buildPickInfo(document.querySelector('button')!);
    expect(info.selector).toBe('[role="button"][aria-label="OK"]');
  });
});

describe('buildPickInfo — anchorChain collection', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('collects outer-to-inner order across multiple tiers', () => {
    document.body.innerHTML = `
      <div data-sentry-component="Pricing">
        <div data-block="product-card">
          <button>buy</button>
        </div>
      </div>`;
    const info = buildPickInfo(document.querySelector('button')!);
    expect(info.anchorChain).toEqual(['Pricing', 'product-card']);
  });

  it('caps the chain at 3 entries', () => {
    document.body.innerHTML = `
      <section>
        <div data-section="a">
          <div data-sentry-component="B">
            <div data-block="c">
              <span>x</span>
            </div>
          </div>
        </div>
      </section>`;
    const info = buildPickInfo(document.querySelector('span')!);
    expect(info.anchorChain.length).toBeLessThanOrEqual(3);
    expect(info.anchorChain[info.anchorChain.length - 1]).toBe('c');
  });
});

describe('buildPickInfo — uniqueness', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('adds :nth-of-type when sibling anchors share the same tier match', () => {
    document.body.innerHTML = `
      <main>
        <section><div>a</div></section>
        <section><span class="target">b</span></section>
      </main>`;
    const target = document.querySelectorAll('.target')[0]!;
    const info = buildPickInfo(target);
    expect(info.selector).toContain('section:nth-of-type(2)');
  });

  it('falls back to nth-child when anchor matches are non-sibling and cannot be disambiguated', () => {
    document.body.innerHTML = `
      <main>
        <div><section><span class="t">a</span></section></div>
        <div><section><span class="t">b</span></section></div>
      </main>`;
    const target = document.querySelectorAll('.t')[1]!;
    const info = buildPickInfo(target);
    expect(info.selector).toMatch(/^body > /);
    expect(info.anchorChain).toEqual([]);
  });
});
