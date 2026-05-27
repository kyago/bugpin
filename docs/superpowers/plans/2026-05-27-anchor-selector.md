# Anchor 기반 Selector 생성 알고리즘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** bugpin 이슈 #1 — 클릭된 element에 대해 의미 있는 anchor를 상향 탐색해 짧고 안정적인 CSS selector를 생성하고, anchor 체인 / 소스 파일을 이슈 본문과 패널에 노출한다.

**Architecture:** 새 모듈 `src/lib/anchor-selector.ts` 가 `buildPickInfo(el)` 단일 진입점을 노출. 7-tier 매처를 `closest()` 로 순차 적용하고, anchor 가 잡히면 anchor selector + 상대 nth-child 경로 + 사람용 라벨 체인을 합성한다. anchor 가 없으면 기존 nth-child fallback. 기존 `buildSelector` 는 새 모듈 내부의 private fallback 으로 흡수.

**Tech Stack:** TypeScript, Vite, Vitest (happy-dom), Playwright (E2E), React (panel UI).

**Spec:** [docs/superpowers/specs/2026-05-26-anchor-selector-design.md](../specs/2026-05-26-anchor-selector-design.md)

---

## File Structure

| 파일 | 변경 종류 | 책임 |
|------|-----------|-----|
| `src/lib/anchor-selector.ts` | **신규** | `buildPickInfo`, `isAutoId`, `buildNthChildSelector` (private), tier 매처들 |
| `src/lib/selector.ts` | 수정 | `buildLabel` 만 유지, `buildSelector` 제거 |
| `src/shared/types.ts` | 수정 | `PickedElement`/`CollectedData` 에 optional 필드 2개 추가 |
| `src/content-iso/selection-mode.ts` | 수정 (1줄+) | `toPayload` 가 `buildPickInfo` 호출 |
| `src/lib/format-body.ts` | 수정 | Anchor 체인 / 소스 파일 라인 조건부 출력 |
| `src/panel/components/SelectionPanel.tsx` | 수정 | anchor 체인 표시 |
| `src/panel/components/IssueForm.tsx` | 수정 | `s.picked` spread 시 신규 필드 명시 복사 |
| `tests/unit/anchor-selector.test.ts` | **신규** | tier 매처 / fallback / 유일화 / 체인 / 이스케이프 |
| `tests/unit/selector.test.ts` | 수정 | `buildLabel` 만 검증 |
| `tests/unit/selection-mode.test.ts` | 수정 | `anchorChain` 필드 어서션 추가 |
| `tests/unit/format-body.test.ts` | 수정 | Anchor 체인 / 소스 파일 라인 케이스 추가 |
| `tests/e2e/fixtures/test-page.html` | 수정 | data-sentry-component / data-block 노드 추가 |
| `tests/e2e/golden-path.spec.ts` | 수정 | 이슈 본문에 Anchor 체인 라인 포함되는지 검증 |
| `README.md` | 수정 | "알려진 제한" 의 auto-id 항목 갱신 |

각 task 가 1개 책임을 깔끔히 커버하도록 분할했으며, anchor matching 의 tier 별 동작은 각각 별도 task 에서 TDD 로 추가한다.

---

### Task 1: 타입 확장 — `PickedElement` / `CollectedData` 옵셔널 필드 추가

**Files:**
- Modify: `src/shared/types.ts:45-51, 62-67`

- [ ] **Step 1: 타입 수정**

`src/shared/types.ts` 의 두 인터페이스를 다음과 같이 변경:

```ts
export interface PickedElement {
  selector: string;
  outerHTML: string;
  parentChainSummary: string[];
  maxDepth: number;
  currentDepth: number;
  anchorChain?: string[];
  sourceFile?: string | null;
}

export interface CollectedData extends CapturedSnapshot {
  selectedDepth: number;
  selector: string;
  parentChainSummary: string[];
  outerHTML: string;
  anchorChain?: string[];
  sourceFile?: string | null;
}
```

- [ ] **Step 2: 타입 체크**

Run: `npx tsc --noEmit`
Expected: 기존 코드는 옵셔널 필드라 모두 통과해야 함. 통과 시 다음 step.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "types: PickedElement/CollectedData 에 anchorChain·sourceFile 옵셔널 필드 추가"
```

---

### Task 2: `anchor-selector.ts` 모듈 스켈레톤 + `isAutoId` 헬퍼

**Files:**
- Create: `src/lib/anchor-selector.ts`
- Create: `tests/unit/anchor-selector.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`tests/unit/anchor-selector.test.ts` 생성:

```ts
import { describe, it, expect } from 'vitest';
import { isAutoId } from '@/lib/anchor-selector';

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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: FAIL — 모듈 `@/lib/anchor-selector` 없음.

- [ ] **Step 3: 최소 구현**

`src/lib/anchor-selector.ts` 생성:

```ts
const AUTO_ID_RE = /^:r[0-9a-z]+:?$|^[0-9]+$/;

export function isAutoId(id: string): boolean {
  return AUTO_ID_RE.test(id);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/anchor-selector.ts tests/unit/anchor-selector.test.ts
git commit -m "anchor-selector: 모듈 스켈레톤 + isAutoId 헬퍼 (React :r…: / 숫자 id 필터)"
```

---

### Task 3: `buildNthChildSelector` — 기존 buildSelector 동작 회귀 안전망

**Files:**
- Modify: `src/lib/anchor-selector.ts`
- Modify: `tests/unit/anchor-selector.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`tests/unit/anchor-selector.test.ts` 에 append:

```ts
import { buildNthChildSelector } from '@/lib/anchor-selector';

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
```

`beforeEach` import 도 파일 상단에 추가: `import { describe, it, expect, beforeEach } from 'vitest';`

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: FAIL — `buildNthChildSelector` is not exported.

- [ ] **Step 3: 구현 추가**

`src/lib/anchor-selector.ts` 에 append:

```ts
function cssEscape(s: string): string {
  return typeof CSS !== 'undefined' && CSS.escape
    ? CSS.escape(s)
    : s.replace(/[^\w-]/g, '\\$&');
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
```

> 주: 기존 `buildSelector` 의 `if (el.id) return #id` 단축 분기는 제거했다. 이 함수는 anchor 매처가 모두 실패한 뒤에만 호출되므로, 도달 시점에 stable id 가 남아있을 수 없다. 그래도 fallback 일관성을 위해 순수 nth-child 경로만 반환한다.

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/anchor-selector.ts tests/unit/anchor-selector.test.ts
git commit -m "anchor-selector: buildNthChildSelector fallback (id 단축 제거, 순수 nth-child)"
```

---

### Task 4: `buildPickInfo` — anchor 없는 케이스 (orchestrator 스켈레톤)

**Files:**
- Modify: `src/lib/anchor-selector.ts`
- Modify: `tests/unit/anchor-selector.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`tests/unit/anchor-selector.test.ts` 에 append:

```ts
import { buildPickInfo } from '@/lib/anchor-selector';

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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: FAIL — `buildPickInfo` is not exported.

- [ ] **Step 3: 구현 추가**

`src/lib/anchor-selector.ts` 에 append:

```ts
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
  return null; // 다음 task 들에서 tier 별로 채움
}

export function buildPickInfo(el: Element): PickInfo {
  const anchor = matchAnchor(el);
  if (!anchor) {
    return {
      selector: buildNthChildSelector(el),
      anchorChain: [],
      sourceFile: null,
    };
  }
  // anchor 합성은 후속 task 에서 구현
  return {
    selector: anchor.selector,
    anchorChain: [anchor.label],
    sourceFile: anchor.sourceFile,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/anchor-selector.ts tests/unit/anchor-selector.test.ts
git commit -m "anchor-selector: buildPickInfo orchestrator (anchor 없을 때 nth-child fallback)"
```

---

### Task 5: tier 1·2·3 매처 (data-block, data-sentry-component, data-section) + sourceFile 추출

**Files:**
- Modify: `src/lib/anchor-selector.ts`
- Modify: `tests/unit/anchor-selector.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`tests/unit/anchor-selector.test.ts` 에 append:

```ts
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
    expect(info.selector).toBe('[data-block="card"] button:nth-child(1)');
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
    // tier 1 매처가 closest() 로 가장 가까운 것을 먼저 잡음
  });
});
```

> 주: 위 첫 케이스의 정확한 selector 문자열은 `buildRelativePath` 구현 형태에 따라 달라진다. 구현 후 실패 메시지의 실제 출력을 보고 expected 값을 다듬어도 된다. 핵심 검증은 `expect(info.selector).toContain('[data-block="card"]')` 와 anchorChain 이다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: FAIL — matchAnchor returns null.

- [ ] **Step 3: 구현 추가**

`src/lib/anchor-selector.ts` 의 `matchAnchor` 를 다음으로 교체하고 `buildRelativePath` 도 추가:

```ts
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
  return null;
}
```

그리고 `buildPickInfo` 의 반환부에 상대 경로 합성을 적용:

```ts
export function buildPickInfo(el: Element): PickInfo {
  const anchor = matchAnchor(el);
  if (!anchor) {
    return { selector: buildNthChildSelector(el), anchorChain: [], sourceFile: null };
  }
  const relative = buildRelativePath(anchor.node, el);
  const selector = relative ? `${anchor.selector} ${relative}` : anchor.selector;
  return { selector, anchorChain: [anchor.label], sourceFile: anchor.sourceFile };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: PASS (12 tests). 만일 첫 케이스의 `toBe` 가 실패하면 실제 출력을 보고 expected 값을 정확히 맞춤.

- [ ] **Step 5: Commit**

```bash
git add src/lib/anchor-selector.ts tests/unit/anchor-selector.test.ts
git commit -m "anchor-selector: tier 1/2/3 매처 + relative path + data-sentry-source-file 추출"
```

---

### Task 6: tier 4 매처 — 안정 id (auto-id 제외)

**Files:**
- Modify: `src/lib/anchor-selector.ts`
- Modify: `tests/unit/anchor-selector.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

```ts
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
    // tier 4 가 :r0: 를 건너뛰므로 tier 6 시맨틱 (section) 가 anchor 가 되거나, 없으면 nth-child fallback
    expect(info.selector).not.toContain('#:r0:');
  });

  it('clicked element with its own stable id → anchor is the element itself', () => {
    document.body.innerHTML = `<button id="cta">x</button>`;
    const info = buildPickInfo(document.getElementById('cta')!);
    expect(info.selector).toBe('#cta');
    expect(info.anchorChain).toEqual(['#cta']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: FAIL — id 케이스가 fallback 으로 떨어짐.

- [ ] **Step 3: 구현 추가**

`matchAnchor` 함수의 tier 3 블록 다음에 tier 4 블록을 추가:

```ts
  // tier 4: stable id (auto-id 제외)
  let cur: Element | null = el;
  while (cur) {
    const id = cur.id;
    if (id && !isAutoId(id)) {
      return { node: cur, selector: `#${cssEscape(id)}`, label: `#${id}`, sourceFile: null };
    }
    cur = cur.parentElement;
  }
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: PASS (15 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/anchor-selector.ts tests/unit/anchor-selector.test.ts
git commit -m "anchor-selector: tier 4 안정 id 매처 (auto-id 제외)"
```

---

### Task 7: tier 5 매처 — `[role]` (+ 있으면 `[aria-label]`) with CSS.escape

**Files:**
- Modify: `src/lib/anchor-selector.ts`
- Modify: `tests/unit/anchor-selector.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

```ts
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
    // CSS.escape 적용 시 따옴표가 이스케이프되어 selector 가 querySelectorAll 로 다시 파싱 가능해야 함
    expect(() => document.querySelectorAll(info.selector)).not.toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현 추가**

`matchAnchor` 함수의 tier 4 블록 다음에 tier 5 블록을 추가:

```ts
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
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: PASS (18 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/anchor-selector.ts tests/unit/anchor-selector.test.ts
git commit -m "anchor-selector: tier 5 role(+aria-label) 매처 + CSS.escape 적용"
```

---

### Task 8: tier 6 매처 — 시맨틱 태그 fallback

**Files:**
- Modify: `src/lib/anchor-selector.ts`
- Modify: `tests/unit/anchor-selector.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: FAIL — section 케이스가 fallback 으로 떨어짐.

- [ ] **Step 3: 구현 추가**

`matchAnchor` 함수 상단에 상수 추가:

```ts
const SEMANTIC_TAGS = new Set(['section', 'article', 'main', 'nav', 'header', 'footer']);
```

tier 5 블록 다음에 tier 6 블록을 추가:

```ts
  // tier 6: semantic tag
  let semCur: Element | null = el;
  while (semCur) {
    if (SEMANTIC_TAGS.has(semCur.tagName.toLowerCase())) {
      const tag = semCur.tagName.toLowerCase();
      return { node: semCur, selector: tag, label: tag, sourceFile: null };
    }
    semCur = semCur.parentElement;
  }
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: PASS (21 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/anchor-selector.ts tests/unit/anchor-selector.test.ts
git commit -m "anchor-selector: tier 6 시맨틱 태그 매처 (section/article/main/nav/header/footer)"
```

---

### Task 9: anchor === target 케이스 보장

**Files:**
- Modify: `tests/unit/anchor-selector.test.ts` (회귀 검증만; 코드는 이미 동작)

- [ ] **Step 1: 회귀 테스트 추가**

```ts
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
```

- [ ] **Step 2: 통과 확인 (코드 변경 없음)**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: PASS (23 tests). `buildRelativePath` 가 `anchor === target` 일 때 빈 문자열을 반환하므로 selector 합성 시 anchor selector 단독이 됨.

- [ ] **Step 3: Commit**

```bash
git add tests/unit/anchor-selector.test.ts
git commit -m "anchor-selector: anchor === target 케이스 회귀 테스트"
```

---

### Task 10: anchor 체인 outer→inner 수집 (최대 3개)

**Files:**
- Modify: `src/lib/anchor-selector.ts`
- Modify: `tests/unit/anchor-selector.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

```ts
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
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: FAIL — 현재 anchorChain 은 deepest 라벨 하나만 들어있음.

- [ ] **Step 3: 구현 추가**

`src/lib/anchor-selector.ts` 에 헬퍼 함수 추가하고 `buildPickInfo` 가 그것을 사용하도록 변경:

```ts
function collectAnchorChain(deepest: AnchorMatch): string[] {
  const labels: string[] = [deepest.label];
  let cur: Element | null = deepest.node.parentElement;
  while (cur && labels.length < 3) {
    const m = matchAnchor(cur);
    if (!m) break;
    labels.push(m.label);
    cur = m.node.parentElement;
  }
  return labels.reverse(); // outer-first
}
```

`buildPickInfo` 의 anchor 반환부 수정:

```ts
  return {
    selector,
    anchorChain: collectAnchorChain(anchor),
    sourceFile: anchor.sourceFile,
  };
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: PASS (25 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/anchor-selector.ts tests/unit/anchor-selector.test.ts
git commit -m "anchor-selector: anchorChain 바깥쪽→안쪽 순서로 최대 3개 수집"
```

---

### Task 11: 다중 매치 유일화 (nth-of-type) + 흩어진 매치 fallback

**Files:**
- Modify: `src/lib/anchor-selector.ts`
- Modify: `tests/unit/anchor-selector.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

```ts
describe('buildPickInfo — uniqueness', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('adds :nth-of-type when sibling anchors share the same tier match', () => {
    document.body.innerHTML = `
      <main>
        <section><div>a</div></section>
        <section><span id="target-x">b</span></section>
      </main>`;
    const info = buildPickInfo(document.getElementById('target-x')!);
    // section 두 개 형제. 두 번째가 target 의 anchor.
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
    // 두 section 모두 :nth-of-type(1) of their parent → 유일화 실패 → fallback
    expect(info.selector).toMatch(/^body > /);
    expect(info.anchorChain).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현 추가**

`src/lib/anchor-selector.ts` 에 `ensureUnique` 헬퍼 추가:

```ts
function ensureUnique(anchor: AnchorMatch): AnchorMatch | null {
  if (document.querySelectorAll(anchor.selector).length <= 1) return anchor;
  const parent = anchor.node.parentElement;
  if (!parent) return null;
  const sameTag = Array.from(parent.children).filter(c => c.tagName === anchor.node.tagName);
  const idx = sameTag.indexOf(anchor.node) + 1;
  if (idx < 1) return null;
  const newSel = `${anchor.selector}:nth-of-type(${idx})`;
  if (document.querySelectorAll(newSel).length === 1) {
    return { ...anchor, selector: newSel };
  }
  return null;
}
```

`buildPickInfo` 의 anchor 매칭 직후에 ensureUnique 적용:

```ts
export function buildPickInfo(el: Element): PickInfo {
  const raw = matchAnchor(el);
  if (!raw) {
    return { selector: buildNthChildSelector(el), anchorChain: [], sourceFile: null };
  }
  const anchor = ensureUnique(raw);
  if (!anchor) {
    return { selector: buildNthChildSelector(el), anchorChain: [], sourceFile: null };
  }
  const relative = buildRelativePath(anchor.node, el);
  const selector = relative ? `${anchor.selector} ${relative}` : anchor.selector;
  return { selector, anchorChain: collectAnchorChain(anchor), sourceFile: anchor.sourceFile };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/anchor-selector.test.ts`
Expected: PASS (27 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/anchor-selector.ts tests/unit/anchor-selector.test.ts
git commit -m "anchor-selector: 다중 매치 시 nth-of-type 유일화, 흩어진 매치는 nth-child fallback"
```

---

### Task 12: 기존 `selector.ts` 정리 — `buildSelector` 제거, `buildLabel` 유지 + 테스트 갱신

**Files:**
- Modify: `src/lib/selector.ts`
- Modify: `tests/unit/selector.test.ts`

- [ ] **Step 1: `selector.ts` 정리**

`src/lib/selector.ts` 의 내용을 다음으로 전체 교체:

```ts
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
```

- [ ] **Step 2: 기존 `selector.test.ts` 정리**

`tests/unit/selector.test.ts` 의 내용을 다음으로 전체 교체:

```ts
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
```

> 주: 기존 `buildSelector` 단위 테스트의 nth-child 행동은 `anchor-selector.test.ts` 의 `buildNthChildSelector (fallback)` describe 블록이 커버한다 (Task 3 에서 추가됨).

- [ ] **Step 3: 통과 확인**

Run: `npx vitest run tests/unit/selector.test.ts tests/unit/anchor-selector.test.ts`
Expected: PASS — selector.test.ts 3 tests + anchor-selector.test.ts 27 tests.

- [ ] **Step 4: 전체 타입 체크 (buildSelector 사용처 잡기)**

Run: `npx tsc --noEmit`
Expected: `selection-mode.ts:144` 에서 `buildSelector` 미정의 에러. 이는 Task 13 에서 해소.

이 task 의 commit 은 일시적으로 빌드를 깨므로, Task 12 와 Task 13 을 묶어서 한 commit 으로 처리한다. 다음 step 으로 진행.

- [ ] **Step 5: (스킵) commit 은 Task 13 에서 함께**

Task 13 의 변경까지 끝낸 뒤 한 번에 커밋.

---

### Task 13: `selection-mode.ts` 가 `buildPickInfo` 사용 + 테스트 갱신

**Files:**
- Modify: `src/content-iso/selection-mode.ts:142-150`
- Modify: `tests/unit/selection-mode.test.ts`

- [ ] **Step 1: `selection-mode.ts` import / payload 변경**

파일 상단 import 라인을 다음과 같이 수정 (`buildSelector` 제거, `buildPickInfo` 추가):

```ts
import { buildLabel } from '@/lib/selector';
import { buildPickInfo } from '@/lib/anchor-selector';
```

`toPayload` 메소드를 다음으로 교체:

```ts
private toPayload(el: Element): PickedElement {
  const info = buildPickInfo(el);
  return {
    selector: info.selector,
    outerHTML: sanitizeOuterHTML(el),
    parentChainSummary: this.parentChain.map(buildLabel),
    maxDepth: Math.max(0, this.parentChain.length - 1),
    currentDepth: this.currentDepth,
    anchorChain: info.anchorChain,
    sourceFile: info.sourceFile,
  };
}
```

- [ ] **Step 2: `selection-mode.test.ts` 어서션 보강**

`tests/unit/selection-mode.test.ts` 의 첫 번째 테스트 (`invokes onPicked on click ...`) 안의 `expect(picked!.selector).toBe('#btn');` 줄 다음에 한 줄 추가:

```ts
expect(picked!.anchorChain).toEqual(['#btn']);
expect(picked!.sourceFile).toBeNull();
```

- [ ] **Step 3: 빌드 + 테스트 통과 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: 타입 체크 통과, 전체 unit 테스트 통과.

- [ ] **Step 4: Commit (Task 12 + 13 변경 묶음)**

```bash
git add src/lib/selector.ts src/lib/anchor-selector.ts \
        src/content-iso/selection-mode.ts \
        tests/unit/selector.test.ts tests/unit/selection-mode.test.ts
git commit -m "selection-mode: buildPickInfo 도입 — selector.ts 는 buildLabel 만 유지, 회귀 테스트 갱신"
```

---

### Task 14: `format-body.ts` — Anchor 체인 / 소스 파일 라인 조건부 출력

**Files:**
- Modify: `src/lib/format-body.ts:13`
- Modify: `tests/unit/format-body.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`tests/unit/format-body.test.ts` 에 새 describe 블록 추가:

```ts
describe('formatIssueBody — anchor lines', () => {
  it('includes Anchor 체인 line when anchorChain non-empty', () => {
    const c: CollectedData = { ...baseCollected, anchorChain: ['Pricing', 'product-card'] };
    const body = formatIssueBody('x', c);
    expect(body).toContain('Anchor 체인');
    expect(body).toContain('Pricing → product-card');
  });

  it('includes 소스 파일 line when sourceFile present', () => {
    const c: CollectedData = {
      ...baseCollected,
      anchorChain: ['Pricing'],
      sourceFile: 'Pricing.tsx',
    };
    const body = formatIssueBody('x', c);
    expect(body).toContain('소스 파일');
    expect(body).toContain('Pricing.tsx');
  });

  it('omits both lines when anchorChain empty and sourceFile null', () => {
    const body = formatIssueBody('x', baseCollected);
    expect(body).not.toContain('Anchor 체인');
    expect(body).not.toContain('소스 파일');
  });

  it('emits Anchor 체인 above Selector line', () => {
    const c: CollectedData = { ...baseCollected, anchorChain: ['A'] };
    const body = formatIssueBody('x', c);
    const anchorIdx = body.indexOf('Anchor 체인');
    const selectorIdx = body.indexOf('**Selector**');
    expect(anchorIdx).toBeGreaterThan(0);
    expect(anchorIdx).toBeLessThan(selectorIdx);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/format-body.test.ts`
Expected: FAIL — 4 new tests fail.

- [ ] **Step 3: 구현**

`src/lib/format-body.ts` 에서 `parts.push(` `- **Selector**: ...` `)` 라인 (line 13) **바로 위**에 다음 두 줄 삽입:

```ts
  if (c.anchorChain && c.anchorChain.length > 0) {
    parts.push(`- **Anchor 체인**: ${c.anchorChain.join(' → ')}`);
  }
  if (c.sourceFile) {
    parts.push(`- **소스 파일**: ${c.sourceFile}`);
  }
```

최종 순서: URL → 선택 범위 → **Anchor 체인** → **소스 파일** → Selector → 브라우저 → ...

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/unit/format-body.test.ts`
Expected: PASS — 기존 5 tests + 신규 4 tests = 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/format-body.ts tests/unit/format-body.test.ts
git commit -m "format-body: 이슈 본문에 Anchor 체인 / 소스 파일 라인 조건부 출력"
```

---

### Task 15: `IssueForm.tsx` — `s.picked` spread 시 `anchorChain` / `sourceFile` 명시 복사

**Files:**
- Modify: `src/panel/components/IssueForm.tsx:30-36, 55-61`

- [ ] **Step 1: 두 spread 위치 수정**

`src/panel/components/IssueForm.tsx` 의 두 곳:

(1) `const finalBody = useMemo(...)` 내부 (현재 line 30-36):

```ts
    const collected: CollectedData = {
      ...(s.collected as unknown as CollectedData),
      selectedDepth: s.currentDepth,
      selector: s.picked.selector,
      parentChainSummary: s.picked.parentChainSummary,
      outerHTML: s.picked.outerHTML,
      anchorChain: s.picked.anchorChain,
      sourceFile: s.picked.sourceFile,
    };
```

(2) `onSubmit` 의 `collected:` 블록 (현재 line 55-61):

```ts
      collected: {
        ...(s.collected as unknown as CollectedData),
        selectedDepth: s.currentDepth,
        selector: s.picked.selector,
        parentChainSummary: s.picked.parentChainSummary,
        outerHTML: s.picked.outerHTML,
        anchorChain: s.picked.anchorChain,
        sourceFile: s.picked.sourceFile,
      } as CollectedData,
```

- [ ] **Step 2: 타입 체크 + 전체 unit 테스트 통과 확인**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/panel/components/IssueForm.tsx
git commit -m "panel: IssueForm 이 picked 의 anchorChain·sourceFile 을 collected 로 명시 복사"
```

---

### Task 16: `SelectionPanel.tsx` — anchor 체인 노출

**Files:**
- Modify: `src/panel/components/SelectionPanel.tsx:69-73`

- [ ] **Step 1: anchor 체인 표시 추가**

`src/panel/components/SelectionPanel.tsx` 의 `{picked && (...)}` 블록 (현재 line 69-73) 을 다음으로 교체:

```tsx
      {picked && (
        <>
          {picked.anchorChain && picked.anchorChain.length > 0 && (
            <div className="anchor-chain" title={picked.anchorChain.join(' → ')}>
              <code>⚓ {picked.anchorChain.join(' → ')}</code>
              {picked.sourceFile && <span className="source-file"> · {picked.sourceFile}</span>}
            </div>
          )}
          <div className="selector-preview" title={picked.selector}>
            <code>{picked.selector}</code>
          </div>
        </>
      )}
```

스타일링은 기존 `.selector-preview` 와 같은 톤 (작은 모노스페이스). 별도 CSS 추가 필요 시 동일 파일 `selection-panel.css` 가 있다면 거기에, 없다면 인라인 스타일은 안 쓰고 클래스명만 둠.

- [ ] **Step 2: 타입 / 빌드 체크**

Run: `npx tsc --noEmit && npm run build`
Expected: 빌드 성공.

- [ ] **Step 3: Commit**

```bash
git add src/panel/components/SelectionPanel.tsx
git commit -m "panel: SelectionPanel 에 anchor 체인 / 소스 파일 노출"
```

---

### Task 17: E2E fixture 확장 + golden-path 시나리오에 anchor 라인 어서션 추가

**Files:**
- Modify: `tests/e2e/fixtures/test-page.html`
- Modify: `tests/e2e/golden-path.spec.ts`

- [ ] **Step 1: fixture HTML 보강**

`tests/e2e/fixtures/test-page.html` 의 `<body>` 안에 anchor 속성이 있는 영역을 추가:

```html
<!doctype html>
<html><body>
  <h1>Test Page</h1>
  <button id="cta">CTA</button>
  <div class="card"><span>card content</span></div>
  <section data-sentry-component="Demo" data-sentry-source-file="Demo.tsx">
    <div data-block="card">
      <button id="anchored-cta">Anchored CTA</button>
    </div>
  </section>
</body></html>
```

- [ ] **Step 2: golden-path 시나리오에 어서션 추가**

`tests/e2e/golden-path.spec.ts` 를 열고, 픽 → 본문 검증 부분을 찾아 anchor-attribute 가 있는 element 를 픽하도록 시나리오를 조정 (기존 픽 대상이 anchor 가 없는 영역이면, 새 영역 안의 `#anchored-cta` 를 픽하도록 변경). mock GitHub 서버가 받은 issue body 에 다음이 포함되는지 확인:

```ts
expect(receivedBody).toContain('**Anchor 체인**: Demo → card');
expect(receivedBody).toContain('**소스 파일**: Demo.tsx');
expect(receivedBody).toContain('[data-sentry-component="Demo"]');
```

> 실제 어서션 코드는 `golden-path.spec.ts` 의 기존 패턴 (mock 서버 캡처 방식) 을 따라 작성. 변경 전에 파일을 읽어 기존 어서션이 어떻게 구성되어 있는지 확인하고, 같은 스타일로 라인 3개만 append.

- [ ] **Step 3: E2E 실행**

Run: `npm run test:e2e -- golden-path`
Expected: PASS — Anchor 체인 / 소스 파일 / data-sentry-component 셀렉터가 본문에 포함됨.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/fixtures/test-page.html tests/e2e/golden-path.spec.ts
git commit -m "e2e: anchor 속성 fixture 추가 + golden-path 에 Anchor 체인·소스 파일 어서션"
```

---

### Task 18: README "알려진 제한" 갱신

**Files:**
- Modify: `README.md`

- [ ] **Step 1: 항목 제거**

`README.md` 의 "알려진 제한 (MVP)" 섹션에서 다음 줄을 삭제:

```
- 자동 생성 id (`:r0:`, `__abc` 등) 의 selector 안정성 낮음
```

(이 항목은 anchor 기반 selector 도입으로 해소됨. README 의 동작 흐름 자체에는 변경 없음.)

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs(readme): auto-id selector 안정성 제한 항목 제거 — anchor 기반으로 해소"
```

---

### Task 19: 전체 회귀 — 모든 테스트 통과 + 빌드 확인

**Files:** (검증 단계만)

- [ ] **Step 1: 전체 unit 테스트**

Run: `npm test`
Expected: 모든 unit/integration 테스트 PASS.

- [ ] **Step 2: 전체 E2E**

Run: `npm run test:e2e`
Expected: 모든 E2E 시나리오 PASS.

- [ ] **Step 3: 프로덕션 빌드**

Run: `npm run build`
Expected: 빌드 성공, dist 생성.

- [ ] **Step 4: 최종 lint / typecheck (있다면)**

Run: `npx tsc --noEmit`
Expected: 0 error.

- [ ] **Step 5: 머지 가능 상태 commit (별도 commit 불필요 — 모두 통과 시 PR)**

각 task 의 commit 들이 이미 머지 단위. 본 task 는 실행 후 PR 제출.

---

## Self-Review Notes

- **Spec coverage**:
  - §3 모듈 & API → Task 2, 3, 4
  - §4 tier 매처 (1-6) → Task 5, 6, 7, 8
  - §4.3 auto-id 정규식 → Task 2
  - §4.4 nth-of-type 유일화 → Task 11
  - §5.1 타입 변경 → Task 1
  - §5.2 호출부 (selection-mode) → Task 13
  - §5.2 호출부 (IssueForm) → Task 15
  - §5.3 본문 출력 → Task 14
  - §5.4 패널 노출 → Task 16
  - §6 depth 슬라이더 분리 → 이미 보장됨 (selection-mode 의 `toPayload` 가 1회만 호출). 별도 task 불필요.
  - §7 엣지 케이스 (anchor === target, body 도달, escape) → Task 9, Task 3 (body), Task 7 (escape)
  - §8 테스트 전략 → 각 task 의 TDD step + Task 17 (E2E)
  - §9 마이그레이션 → 옵셔널 필드 사용으로 자동 충족, 별도 task 없음
- **Placeholder scan**: TBD / TODO 없음. 각 step 에 실제 코드 / 명령 / expected output 명시.
- **Type consistency**: `PickInfo`, `AnchorMatch`, `PickedElement`, `CollectedData` 필드명·시그니처 통일 확인.
- **순서 검증**: Task 12 가 일시적으로 빌드를 깨므로 Task 13 과 한 commit 으로 묶음 — step 에서 명시.
