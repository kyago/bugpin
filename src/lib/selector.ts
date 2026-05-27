import { LABEL_CAP, TEXT_FALLBACK_CAP } from '@/shared/constants';

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
