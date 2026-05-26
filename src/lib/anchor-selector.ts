const AUTO_ID_RE = /^:r[0-9a-z]+:?$|^[0-9]+$/;

export function isAutoId(id: string): boolean {
  return AUTO_ID_RE.test(id);
}

function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(s)
    : s.replace(/[^\w-]/g, '\\$&');
}

export interface PickInfo {
  selector: string;
  anchorChain: string[];
  sourceFile: string | null;
}

interface AnchorMatch {
  node: Element;
  selector: string;
  label: string;
  sourceFile: string | null;
}

function matchAnchor(_el: Element): AnchorMatch | null {
  return null;
}

export function buildPickInfo(el: Element): PickInfo {
  const anchor = matchAnchor(el);
  if (!anchor) {
    return { selector: buildNthChildSelector(el), anchorChain: [], sourceFile: null };
  }
  return { selector: anchor.selector, anchorChain: [anchor.label], sourceFile: anchor.sourceFile };
}

export function buildNthChildSelector(el: Element): string {
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
