import { describe, it, expect, beforeEach } from 'vitest';
import { buildSelector, buildLabel } from '@/lib/selector';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('buildSelector', () => {
  it('uses #id when element has id', () => {
    document.body.innerHTML = `<div id="hero"><button id="cta">x</button></div>`;
    const el = document.getElementById('cta')!;
    expect(buildSelector(el)).toBe('#cta');
  });

  it('builds nth-child path when no id', () => {
    document.body.innerHTML = `<main><section><button>a</button><button>b</button></section></main>`;
    const buttons = document.querySelectorAll('button');
    const sel = buildSelector(buttons[1]!);
    expect(sel).toContain('nth-child(2)');
    expect(sel).toMatch(/^body > /);
  });

  it('includes class along with nth-child for clarity', () => {
    document.body.innerHTML = `<div class="card"><div class="card"></div></div>`;
    const inner = document.querySelectorAll('.card')[1]!;
    expect(buildSelector(inner)).toContain('.card');
  });
});

describe('buildLabel', () => {
  it('tag#id.firstClass', () => {
    const el = document.createElement('button');
    el.id = 'submit-btn';
    el.className = 'primary large';
    expect(buildLabel(el)).toBe('button#submit-btn.primary');
  });

  it('fallbacks to text snippet when no id/class', () => {
    const el = document.createElement('span');
    el.textContent = '장바구니에 담기';
    expect(buildLabel(el)).toMatch(/^span "장바구니에 담/);
  });

  it('caps label at 30 chars', () => {
    const el = document.createElement('div');
    el.id = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    expect(buildLabel(el).length).toBeLessThanOrEqual(30);
  });
});
