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

const SEMANTIC_TAGS = new Set(['section', 'article', 'main', 'nav', 'header', 'footer']);

function buildRelativePath(anchor: Element, target: Element): string {
  if (anchor === target) return '';
  const parts: string[] = [];
  let cur: Element | null = target;
  while (cur && cur !== anchor) {
    const p: Element | null = cur.parentElement;
    if (!p) break;
    const idx = Array.from(p.children).indexOf(cur) + 1;
    let part = cur.tagName.toLowerCase();
    const firstClass = cur.classList[0];
    if (firstClass) part += `.${cssEscape(firstClass)}`;
    part += `:nth-child(${idx})`;
    parts.unshift(part);
    cur = p;
  }
  return parts.join(' > ');
}

function matchAnchor(el: Element): AnchorMatch | null {
  // tier 1: data-block
  const block = el.closest<HTMLElement>('[data-block]');
  if (block) {
    const v = block.getAttribute('data-block') ?? '';
    return { node: block, selector: `[data-block="${cssEscape(v)}"]`, label: v, sourceFile: null };
  }
  // tier 2: data-sentry-component (+ source-file)
  const sentry = el.closest<HTMLElement>('[data-sentry-component]');
  if (sentry) {
    const v = sentry.getAttribute('data-sentry-component') ?? '';
    return {
      node: sentry,
      selector: `[data-sentry-component="${cssEscape(v)}"]`,
      label: v,
      sourceFile: sentry.getAttribute('data-sentry-source-file'),
    };
  }
  // tier 3: data-section
  const section = el.closest<HTMLElement>('[data-section]');
  if (section) {
    const v = section.getAttribute('data-section') ?? '';
    return { node: section, selector: `[data-section="${cssEscape(v)}"]`, label: v, sourceFile: null };
  }
  // tier 4: stable id (auto-id 제외)
  let idCur: Element | null = el;
  while (idCur) {
    const id = idCur.id;
    if (id && !isAutoId(id)) {
      return { node: idCur, selector: `#${cssEscape(id)}`, label: `#${id}`, sourceFile: null };
    }
    idCur = idCur.parentElement;
  }
  // tier 5: [role] + optional [aria-label]
  const roleNode = el.closest<HTMLElement>('[role]');
  if (roleNode) {
    const role = roleNode.getAttribute('role') ?? '';
    const aria = roleNode.getAttribute('aria-label');
    const sel = aria
      ? `[role="${cssEscape(role)}"][aria-label="${cssEscape(aria)}"]`
      : `[role="${cssEscape(role)}"]`;
    return { node: roleNode, selector: sel, label: aria || role, sourceFile: null };
  }
  // tier 6: semantic tag
  let semCur: Element | null = el;
  while (semCur) {
    if (SEMANTIC_TAGS.has(semCur.tagName.toLowerCase())) {
      const tag = semCur.tagName.toLowerCase();
      return { node: semCur, selector: tag, label: tag, sourceFile: null };
    }
    semCur = semCur.parentElement;
  }
  return null;
}

function collectAnchorChain(deepest: AnchorMatch): string[] {
  const labels: string[] = [deepest.label];
  let cur: Element | null = deepest.node.parentElement;
  while (cur && labels.length < 3) {
    const m = matchAnchor(cur);
    if (!m) break;
    labels.push(m.label);
    cur = m.node.parentElement;
  }
  return labels.reverse();
}

export function buildPickInfo(el: Element): PickInfo {
  const anchor = matchAnchor(el);
  if (!anchor) {
    return { selector: buildNthChildSelector(el), anchorChain: [], sourceFile: null };
  }
  const relative = buildRelativePath(anchor.node, el);
  const selector = relative ? `${anchor.selector} ${relative}` : anchor.selector;
  return { selector, anchorChain: collectAnchorChain(anchor), sourceFile: anchor.sourceFile };
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
