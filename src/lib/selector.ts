import { LABEL_CAP, TEXT_FALLBACK_CAP } from '@/shared/constants';

export function buildSelector(el: Element): string {
  if (el.id) return `#${cssEscape(el.id)}`;
  const path: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body.parentElement) {
    if (cur === document.body) { path.unshift('body'); break; }
    const parent: Element | null = cur.parentElement;
    if (!parent) break;
    const idx = Array.from(parent.children).indexOf(cur) + 1;
    let part = cur.tagName.toLowerCase();
    const firstClass = cur.classList[0];
    if (firstClass) part += `.${cssEscape(firstClass)}`;
    part += `:nth-child(${idx})`;
    path.unshift(part);
    cur = parent;
  }
  return path.join(' > ');
}

export function buildLabel(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : '';
  const cls = el.classList[0] ? `.${el.classList[0]}` : '';
  let label = `${tag}${id}${cls}`;
  if (!id && !cls) {
    const text = (el.textContent ?? '').trim();
    if (text) {
      const snippet = text.length > TEXT_FALLBACK_CAP
        ? text.slice(0, TEXT_FALLBACK_CAP) + '...'
        : text;
      label = `${tag} "${snippet}"`;
    }
  }
  if (label.length > LABEL_CAP) label = label.slice(0, LABEL_CAP - 1) + '…';
  return label;
}

function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&');
}
