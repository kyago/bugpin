import { describe, it, expect } from 'vitest';
import { buildLabel } from '@/lib/selector';

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
