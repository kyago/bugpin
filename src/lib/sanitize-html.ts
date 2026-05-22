import { BODY_OUTER_HTML_CAP, ATTR_VALUE_CAP } from '@/shared/constants';

const STRIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
const STRIP_ATTRS = new Set(['style', 'src', 'srcset', 'srcdoc']);

export function sanitizeOuterHTML(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  scrub(clone);
  let out = clone.outerHTML;
  if (out.length > BODY_OUTER_HTML_CAP) {
    out = out.slice(0, BODY_OUTER_HTML_CAP) + ' ... (잘림)';
  }
  return out;
}

function scrub(node: Element) {
  // Strip dangerous tags first
  for (const child of Array.from(node.children)) {
    if (STRIP_TAGS.has(child.tagName.toUpperCase())) {
      child.remove();
      continue;
    }
    scrub(child);
  }
  // Attributes
  for (const attr of Array.from(node.attributes)) {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on')) { node.removeAttribute(attr.name); continue; }
    if (STRIP_ATTRS.has(name)) { node.removeAttribute(attr.name); continue; }
    if (attr.value.includes('data:')) { node.removeAttribute(attr.name); continue; }
    if (attr.value.length > ATTR_VALUE_CAP) { node.removeAttribute(attr.name); continue; }
    if (name === 'href' && /^javascript:/i.test(attr.value)) {
      node.setAttribute('href', '#');
    }
  }
  // <input> value / checked
  if (node.tagName === 'INPUT') {
    node.removeAttribute('value');
    node.removeAttribute('checked');
  }
}

export function wrapInDetails(html: string): string {
  const escaped = html.replace(/```/g, '\\`\\`\\`');
  return `<details><summary>선택 영역 HTML</summary>\n\n\`\`\`html\n${escaped}\n\`\`\`\n\n</details>`;
}
