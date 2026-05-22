# QA Issue Reporter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chrome MV3 extension for non-developer QA — element selection with parent-expansion slider, automatic context capture (URL, UA, viewport, console, network, sanitized HTML), and direct GitHub Issue submission with per-domain repo/token mappings.

**Architecture:** Native Chrome Side Panel + React/TS + Vite. Background service worker handles GitHub API + storage. Two content scripts (MAIN-world monkey-patches fetch/XHR/console; ISOLATED-world handles DOM + Shadow DOM overlay + buffering). Pure library functions extracted to `src/lib/*` for full unit-test coverage.

**Tech Stack:** TypeScript, React 18, Vite, `@crxjs/vite-plugin`, Zustand, Vitest, `sinon-chrome`, Playwright, Node `http` (mock GitHub server).

**Spec:** `docs/superpowers/specs/2026-05-23-qa-issue-reporter-extension-design.md`

---

## Phase Overview

| Phase | Tasks | Focus |
|---|---|---|
| 1. Foundation | 1–4 | git/project scaffold, manifest, TS+Vite, smoke load |
| 2. Shared types | 5 | Types + constants used by all contexts |
| 3. Pure library (TDD) | 6–15 | URL pattern, selector, sanitization, body budget, UA parse |
| 4. Storage | 16 | `chrome.storage.local` wrapper + migration tests |
| 5. Content scripts | 17–21 | MAIN monkey-patch + ISOLATED buffer/overlay/selection/router |
| 6. Background SW | 22–28 | Router, routing, bootstrap, GitHub API, token test, submit |
| 7. Side panel UI | 29–36 | State machine, components, hooks, styling |
| 8. Options page | 37–39 | Mapping CRUD, token test, prefill, threat-model notice |
| 9. E2E | 40–43 | Mock server, Playwright load + scenarios |
| 10. Polish | 44–46 | README, manual QA checklist, prod build |

Total: 46 tasks. Each step is 2–5 min. Plan to commit after every task.

---

## Phase 1: Foundation

### Task 1: Initialize project & git

**Files:**
- Create: `package.json`, `.gitignore`, `tsconfig.json`, `tsconfig.node.json`

- [ ] **Step 1.1 — Init git repo**

```bash
cd /Users/yongjunkang/no-name
git init -b main
```

- [ ] **Step 1.2 — Create `.gitignore`**

```
node_modules/
dist/
.DS_Store
coverage/
playwright-report/
test-results/
.env
.env.local
.superpowers/
*.log
```

- [ ] **Step 1.3 — Create `package.json`**

```json
{
  "name": "qa-issue-reporter",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "lint": "tsc --noEmit",
    "coverage": "vitest run --coverage"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.5"
  },
  "devDependencies": {
    "@crxjs/vite-plugin": "^2.0.0-beta.28",
    "@playwright/test": "^1.48.0",
    "@testing-library/react": "^16.0.1",
    "@testing-library/jest-dom": "^6.5.0",
    "@types/chrome": "^0.0.270",
    "@types/node": "^22.7.0",
    "@types/react": "^18.3.10",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "@vitest/coverage-v8": "^2.1.1",
    "happy-dom": "^15.7.4",
    "sinon-chrome": "^3.0.1",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.1"
  }
}
```

- [ ] **Step 1.4 — Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "allowSyntheticDefaultImports": true,
    "types": ["chrome", "node", "vitest/globals"],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 1.5 — Create `tsconfig.node.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "allowSyntheticDefaultImports": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 1.6 — Install dependencies**

```bash
npm install
```
Expected: `node_modules/` created without errors.

- [ ] **Step 1.7 — Commit**

```bash
git add .
git commit -m "프로젝트 초기 셋업"
```

---

### Task 2: Vite + CRX manifest

**Files:**
- Create: `vite.config.ts`, `src/manifest.ts`, `src/manifest-icons/` (placeholder)

- [ ] **Step 2.1 — Create `src/manifest.ts`**

```ts
import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: 'QA 이슈 리포터',
  version: '0.1.0',
  description: '비개발자 QA 가 element 단위로 GitHub Issue 를 등록하는 도구',
  permissions: ['storage', 'scripting', 'tabs', 'activeTab', 'sidePanel'],
  host_permissions: ['<all_urls>'],
  background: { service_worker: 'src/background/index.ts', type: 'module' },
  side_panel: { default_path: 'src/panel/index.html' },
  options_page: 'src/options/index.html',
  content_scripts: [
    {
      matches: ['<all_urls>'],
      js: ['src/content-main/index.ts'],
      run_at: 'document_start',
      world: 'MAIN',
    },
    {
      matches: ['<all_urls>'],
      js: ['src/content-iso/index.ts'],
      run_at: 'document_start',
    },
  ],
  action: { default_title: 'QA 이슈 리포터' },
  icons: {
    16: 'src/manifest-icons/16.png',
    48: 'src/manifest-icons/48.png',
    128: 'src/manifest-icons/128.png',
  },
});
```

- [ ] **Step 2.2 — Add placeholder icons**

```bash
mkdir -p src/manifest-icons
# Create three solid-color PNGs (use any 16/48/128 px PNG; placeholder fine for MVP)
# For initial dev a generated solid square works:
node -e "const fs=require('fs');const buf=Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63600100000005000167a73fb50000000049454e44ae426082','hex');fs.writeFileSync('src/manifest-icons/16.png',buf);fs.writeFileSync('src/manifest-icons/48.png',buf);fs.writeFileSync('src/manifest-icons/128.png',buf);"
```
(Replace with real icons before prod.)

- [ ] **Step 2.3 — Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  build: {
    rollupOptions: { input: { panel: 'src/panel/index.html', options: 'src/options/index.html' } },
  },
});
```

- [ ] **Step 2.4 — Stub entry files (empty placeholders so build succeeds)**

```bash
mkdir -p src/background src/content-main src/content-iso src/panel src/options
```

`src/background/index.ts`:
```ts
console.debug('[qa-ext] background worker booted');
```

`src/content-main/index.ts`:
```ts
console.debug('[qa-ext] content-main loaded');
```

`src/content-iso/index.ts`:
```ts
console.debug('[qa-ext] content-iso loaded');
```

`src/panel/index.html`:
```html
<!doctype html>
<html lang="ko">
  <head><meta charset="UTF-8" /><title>QA 이슈 리포터</title></head>
  <body><div id="root"></div><script type="module" src="./main.tsx"></script></body>
</html>
```

`src/panel/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<div>Panel placeholder</div>);
```

`src/options/index.html`:
```html
<!doctype html>
<html lang="ko">
  <head><meta charset="UTF-8" /><title>설정 — QA 이슈 리포터</title></head>
  <body><div id="root"></div><script type="module" src="./main.tsx"></script></body>
</html>
```

`src/options/main.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
createRoot(document.getElementById('root')!).render(<div>Options placeholder</div>);
```

- [ ] **Step 2.5 — Run build**

```bash
npm run build
```
Expected: `dist/` created, no errors, `manifest.json` present.

- [ ] **Step 2.6 — Commit**

```bash
git add .
git commit -m "Vite + CRX 매니페스트 셋업"
```

---

### Task 3: Vitest config + smoke test

**Files:**
- Create: `vitest.config.ts`, `tests/unit/smoke.test.ts`

- [ ] **Step 3.1 — Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'], include: ['src/lib/**'] },
    setupFiles: ['tests/setup.ts'],
  },
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
});
```

- [ ] **Step 3.2 — Create `tests/setup.ts`**

```ts
import chrome from 'sinon-chrome';
// @ts-expect-error inject into globalThis
globalThis.chrome = chrome;

beforeEach(() => {
  chrome.flush();
});
```

- [ ] **Step 3.3 — Create `tests/unit/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('arithmetic still works', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 3.4 — Run tests**

```bash
npm test
```
Expected: 1 passed.

- [ ] **Step 3.5 — Commit**

```bash
git add .
git commit -m "Vitest 설정 + smoke 테스트"
```

---

### Task 4: Load extension in Chrome (manual smoke)

- [ ] **Step 4.1 — Dev build & load**

```bash
npm run build
```

- [ ] **Step 4.2 — Manual verify (record in notes, not committed)**

1. Chrome `chrome://extensions` → "개발자 모드" ON
2. "압축해제된 확장 프로그램 로드" → `dist/`
3. Service worker boot log: extension Details → "service worker" inspect → see `[qa-ext] background worker booted`
4. Visit any HTTP page → page console: `[qa-ext] content-main loaded` and `[qa-ext] content-iso loaded`
5. Click extension icon → side panel placeholder opens

If any step fails, fix before continuing. No commit; this is verification only.

---

## Phase 2: Shared Types

### Task 5: Define shared types + constants

**Files:**
- Create: `src/shared/types.ts`, `src/shared/constants.ts`

- [ ] **Step 5.1 — Create `src/shared/types.ts`**

```ts
// ============ Storage ============

export interface StorageSchema {
  schemaVersion: 1;
  mappings: Mapping[];
}

export interface Mapping {
  id: string;
  name: string;
  urlPatterns: string[];
  repo: string;
  token: string;
  lastVerifiedAt: number | null;
  createdAt: number;
}

// ============ Captured Data ============

export interface ConsoleErrorEntry {
  message: string;
  stack?: string;
  timestamp: number;
  source: 'console.error' | 'window.onerror' | 'unhandledrejection';
  count: number;
}

export interface NetworkFailureEntry {
  method: string;
  url: string;
  status: number;
  statusText: string;
  timestamp: number;
  count: number;
}

export interface UAInfo {
  userAgent: string;
  platform: string;
  browser: string;
}

export interface PickedElement {
  selector: string;
  outerHTML: string;
  parentChainSummary: string[];
  maxDepth: number;
  currentDepth: number;
}

export interface CapturedSnapshot {
  url: string;
  viewport: { w: number; h: number };
  ua: UAInfo;
  consoleErrors: ConsoleErrorEntry[];
  networkFailures: NetworkFailureEntry[];
  capturedAt: number;
}

export interface CollectedData extends CapturedSnapshot {
  selectedDepth: number;
  selector: string;
  parentChainSummary: string[];
  outerHTML: string;
}

// ============ Draft / Submit ============

export interface IssueDraft {
  mappingId: string;
  title: string;
  userDescription: string;
  collected: CollectedData;
  finalBody: string;
  bodyOverridden: boolean;
}

export type ErrorCode =
  | 'auth' | 'not_found' | 'forbidden'
  | 'validation' | 'rate_limit' | 'network' | 'unknown';

export type IssueSubmitResult =
  | { ok: true; number: number; htmlUrl: string }
  | { ok: false; code: ErrorCode; message: string; retryAfter?: number };

// ============ Messages ============

export type PanelToBg =
  | { kind: 'panel.bootstrap' }
  | { kind: 'issue.submit'; payload: IssueDraft }
  | { kind: 'token.test'; mappingId: string }
  | { kind: 'mapping.save'; mapping: Mapping }
  | { kind: 'mapping.delete'; id: string }
  | { kind: 'tab.rebind' } // 사용자가 "현재 탭으로 전환" 클릭
  | { kind: 'forward.toContent'; payload: PanelToContent };

export type PanelToContent =
  | { kind: 'selection.start' }
  | { kind: 'selection.cancel' }
  | { kind: 'selection.depthChange'; depth: number }
  | { kind: 'capture.snapshot' };

export type ContentToPanel =
  | { kind: 'selection.picked'; payload: PickedElement }
  | { kind: 'selection.updated'; payload: PickedElement }
  | { kind: 'selection.cancelled' }
  | { kind: 'capture.snapshot.result'; payload: CapturedSnapshot };

export type BgToPanel =
  | { kind: 'tab.gone' }
  | { kind: 'content.relay'; payload: ContentToPanel };

export interface BootstrapResponse {
  activeMappingId: string | null;
  allCandidates: string[]; // mapping ids matching current URL
  tabId: number;
  url: string;
  hostOnly: string;
}

// ============ Page MAIN-world postMessage ============

export type MainToIsoMessage =
  | { __qaSource: 'qa-ext'; kind: 'console.error'; entry: Omit<ConsoleErrorEntry, 'count'> }
  | { __qaSource: 'qa-ext'; kind: 'network.failure'; entry: Omit<NetworkFailureEntry, 'count'> };

// ============ Token Test ============

export type TokenTestResult =
  | { ok: true; repo: string; verifiedAt: number }
  | { ok: false; step: 'auth' | 'repo'; status: number; message: string };
```

- [ ] **Step 5.2 — Create `src/shared/constants.ts`**

```ts
// Body 자르기 예산
export const BODY_BUDGET = 60_000;
export const BODY_OUTER_HTML_CAP = 4_000;
export const BODY_NETWORK_FAILURES_MAX = 20;
export const BODY_CONSOLE_ERRORS_MAX = 20;
export const BODY_CONSOLE_MESSAGE_CAP = 1_000;
export const BODY_CONSOLE_STACK_CAP = 2_000;

// 버퍼 상한
export const BUFFER_MAX = 50;
export const DEDUP_PREFIX_LEN = 200;

// 슬라이더
export const LABEL_CAP = 30;
export const TEXT_FALLBACK_CAP = 12;
export const ATTR_VALUE_CAP = 5_000;

// 타임아웃 (ms)
export const TIMEOUT_BOOTSTRAP = 5_000;
export const TIMEOUT_SNAPSHOT = 5_000;
export const TIMEOUT_TOKEN_TEST = 10_000;
export const TIMEOUT_MAPPING_OP = 5_000;
export const TIMEOUT_ISSUE_SUBMIT = 30_000;

// Throttle
export const SUBMIT_THROTTLE_MS = 1_000;

// Token cache
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1_000;

// Body indicator thresholds
export const BODY_WARN_THRESHOLD = 55_000;

// PII query-parameter names (case-insensitive)
export const PII_QUERY_KEYS = [
  'access_token', 'refresh_token', 'token',
  'api_key', 'apikey', 'auth',
  'password', 'secret', 'code',
  'bearer', 'session', 'sid', 'jwt', 'id_token',
] as const;

// postMessage 마커
export const POST_MESSAGE_SOURCE = 'qa-ext' as const;

// GitHub API
export const GITHUB_API_BASE = 'https://api.github.com';
export const GITHUB_API_VERSION = '2022-11-28';
```

- [ ] **Step 5.3 — Lint check**

```bash
npm run lint
```
Expected: no TypeScript errors.

- [ ] **Step 5.4 — Commit**

```bash
git add .
git commit -m "공유 타입 및 상수 정의"
```

---

## Phase 3: Pure Library (TDD)

**Goal:** Every file in `src/lib/` is pure (no `chrome.*`, no DOM) and 85%+ unit-test covered.

### Task 6: URL pattern matching

**Files:**
- Create: `src/lib/url-pattern.ts`, `tests/unit/url-pattern.test.ts`

- [ ] **Step 6.1 — Write failing tests**

`tests/unit/url-pattern.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { patternToRegex, normalizeUrl, matchesPattern } from '@/lib/url-pattern';

describe('patternToRegex', () => {
  it('matches plain host', () => {
    expect(matchesPattern('myapp.com', 'https://myapp.com/x?y=1')).toBe(true);
  });
  it('rejects different subdomain when no wildcard', () => {
    expect(matchesPattern('myapp.com', 'https://staging.myapp.com/')).toBe(false);
  });
  it('wildcard inside host', () => {
    expect(matchesPattern('myapp-*-myorg.vercel.app',
      'https://myapp-feat-login-myorg.vercel.app/products')).toBe(true);
  });
  it('apex match — *.X also matches X', () => {
    expect(matchesPattern('*.vercel.app', 'https://vercel.app/foo')).toBe(true);
    expect(matchesPattern('*.vercel.app', 'https://abc.vercel.app/foo')).toBe(true);
  });
  it('localhost with port', () => {
    expect(matchesPattern('localhost:3000', 'http://localhost:3000/dashboard')).toBe(true);
  });
  it('strips path from user input', () => {
    expect(matchesPattern('myapp.com/admin/x', 'https://myapp.com/anything')).toBe(true);
  });
  it('case-insensitive', () => {
    expect(matchesPattern('MyApp.com', 'https://myapp.com/')).toBe(true);
  });
  it('does not match other host', () => {
    expect(matchesPattern('myapp.com', 'https://other.com/')).toBe(false);
  });
});

describe('normalizeUrl', () => {
  it('returns host with port', () => {
    expect(normalizeUrl('http://localhost:3000/x?y=1')).toBe('localhost:3000');
  });
  it('lowercases host', () => {
    expect(normalizeUrl('https://MyApp.COM/')).toBe('myapp.com');
  });
});
```

- [ ] **Step 6.2 — Run tests (should fail)**

```bash
npx vitest run tests/unit/url-pattern.test.ts
```
Expected: FAIL (module not found).

- [ ] **Step 6.3 — Implement `src/lib/url-pattern.ts`**

```ts
export function patternToRegex(pattern: string): RegExp {
  const hostOnly = pattern.split('/')[0]!;
  const apexMatch = hostOnly.match(/^\*\.(.+)$/);
  if (apexMatch) {
    const escHost = apexMatch[1]!.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^https?://(.*\\.)?${escHost}(/.*)?$`, 'i');
  }
  const escaped = hostOnly.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*/g, '.*');
  return new RegExp(`^https?://${withWildcards}(/.*)?$`, 'i');
}

export function normalizeUrl(url: string): string {
  return new URL(url).host.toLowerCase();
}

export function matchesPattern(pattern: string, url: string): boolean {
  return patternToRegex(pattern).test(url);
}
```

- [ ] **Step 6.4 — Run tests (should pass)**

```bash
npx vitest run tests/unit/url-pattern.test.ts
```
Expected: PASS (all 10 tests).

- [ ] **Step 6.5 — Commit**

```bash
git add .
git commit -m "URL 패턴 매칭 (host-only, apex, 와일드카드)"
```

---

### Task 7: Mapping selection (multi-match priority)

**Files:**
- Create: `src/lib/pick-mapping.ts`, `tests/unit/pick-mapping.test.ts`

- [ ] **Step 7.1 — Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { pickBestMapping, candidateMappings } from '@/lib/pick-mapping';
import type { Mapping } from '@/shared/types';

const mk = (id: string, patterns: string[]): Mapping => ({
  id, name: id, urlPatterns: patterns, repo: 'o/r', token: 't',
  lastVerifiedAt: null, createdAt: 0,
});

describe('pickBestMapping', () => {
  it('returns null when no mapping matches', () => {
    expect(pickBestMapping([mk('a', ['other.com'])], 'https://myapp.com/')).toBeNull();
  });

  it('picks mapping with fewer wildcards', () => {
    const a = mk('a', ['*.vercel.app']);
    const b = mk('b', ['myapp-*-myorg.vercel.app']);
    const c = mk('c', ['myapp-stable-myorg.vercel.app']);
    const winner = pickBestMapping([a, b, c],
      'https://myapp-stable-myorg.vercel.app/products');
    expect(winner?.id).toBe('c'); // 0 wildcards beats 1, 1 beats 2
  });

  it('on tie, longer pattern wins', () => {
    const a = mk('a', ['*.vercel.app']);
    const b = mk('b', ['myapp-*-myorg.vercel.app']);
    const winner = pickBestMapping([a, b],
      'https://myapp-x-myorg.vercel.app/');
    expect(winner?.id).toBe('b');
  });

  it('flattens across mappings — multiple patterns per mapping', () => {
    const a = mk('a', ['something.else.com', '*.vercel.app']);
    const b = mk('b', ['myapp-*-myorg.vercel.app']);
    const winner = pickBestMapping([a, b], 'https://myapp-x-myorg.vercel.app/');
    expect(winner?.id).toBe('b');
  });
});

describe('candidateMappings', () => {
  it('returns all matching mapping ids', () => {
    const a = mk('a', ['*.vercel.app']);
    const b = mk('b', ['myapp-*-myorg.vercel.app']);
    const c = mk('c', ['other.com']);
    const ids = candidateMappings([a, b, c], 'https://myapp-x-myorg.vercel.app/');
    expect(new Set(ids)).toEqual(new Set(['a', 'b']));
  });
});
```

- [ ] **Step 7.2 — Run tests (fail)**

```bash
npx vitest run tests/unit/pick-mapping.test.ts
```

- [ ] **Step 7.3 — Implement `src/lib/pick-mapping.ts`**

```ts
import type { Mapping } from '@/shared/types';
import { patternToRegex } from './url-pattern';

interface Scored {
  mapping: Mapping;
  pattern: string;
  wildcardCount: number;
  length: number;
}

function scoreAllMatches(mappings: Mapping[], url: string): Scored[] {
  const out: Scored[] = [];
  for (const m of mappings) {
    for (const p of m.urlPatterns) {
      if (!patternToRegex(p).test(url)) continue;
      out.push({
        mapping: m, pattern: p,
        wildcardCount: (p.match(/\*/g) ?? []).length,
        length: p.length,
      });
    }
  }
  return out;
}

export function pickBestMapping(mappings: Mapping[], url: string): Mapping | null {
  const scored = scoreAllMatches(mappings, url);
  if (scored.length === 0) return null;
  scored.sort((a, b) =>
    a.wildcardCount !== b.wildcardCount
      ? a.wildcardCount - b.wildcardCount
      : b.length - a.length
  );
  return scored[0]!.mapping;
}

export function candidateMappings(mappings: Mapping[], url: string): string[] {
  const seen = new Set<string>();
  for (const s of scoreAllMatches(mappings, url)) seen.add(s.mapping.id);
  return [...seen];
}
```

- [ ] **Step 7.4 — Run tests (pass)**

- [ ] **Step 7.5 — Commit**

```bash
git add .
git commit -m "다중 매칭 우선순위 선택 알고리즘"
```

---

### Task 8: Storage migration

**Files:**
- Create: `src/lib/storage-migrate.ts`, `tests/unit/storage-migrate.test.ts`

- [ ] **Step 8.1 — Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { migrateStorage } from '@/lib/storage-migrate';

describe('migrateStorage', () => {
  it('returns initial schema when storage is empty', () => {
    const result = migrateStorage(undefined);
    expect(result).toEqual({ schemaVersion: 1, mappings: [] });
  });

  it('returns initial schema when raw is null', () => {
    expect(migrateStorage(null)).toEqual({ schemaVersion: 1, mappings: [] });
  });

  it('passes through valid v1', () => {
    const v1 = {
      schemaVersion: 1,
      mappings: [{
        id: 'a', name: 'A', urlPatterns: ['x.com'], repo: 'o/r',
        token: 't', lastVerifiedAt: null, createdAt: 1,
      }],
    };
    expect(migrateStorage(v1)).toEqual(v1);
  });

  it('discards unknown schemaVersion and re-initializes', () => {
    const result = migrateStorage({ schemaVersion: 99, mappings: [] });
    expect(result).toEqual({ schemaVersion: 1, mappings: [] });
  });

  it('initializes when shape is wrong', () => {
    expect(migrateStorage({ random: 'data' })).toEqual({ schemaVersion: 1, mappings: [] });
  });
});
```

- [ ] **Step 8.2 — Run tests (fail)**

- [ ] **Step 8.3 — Implement `src/lib/storage-migrate.ts`**

```ts
import type { StorageSchema } from '@/shared/types';

const EMPTY: StorageSchema = { schemaVersion: 1, mappings: [] };

export function migrateStorage(raw: unknown): StorageSchema {
  if (raw == null || typeof raw !== 'object') return EMPTY;
  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion === 1 && Array.isArray(obj.mappings)) {
    return { schemaVersion: 1, mappings: obj.mappings as StorageSchema['mappings'] };
  }
  return EMPTY;
}
```

- [ ] **Step 8.4 — Run tests (pass)**

- [ ] **Step 8.5 — Commit**

```bash
git add .
git commit -m "storage 스키마 마이그레이션"
```

---

### Task 9: Selector builder

**Files:**
- Create: `src/lib/selector.ts`, `tests/unit/selector.test.ts`

- [ ] **Step 9.1 — Write failing tests**

```ts
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
```

- [ ] **Step 9.2 — Run tests (fail)**

- [ ] **Step 9.3 — Implement `src/lib/selector.ts`**

```ts
import { LABEL_CAP, TEXT_FALLBACK_CAP } from '@/shared/constants';

export function buildSelector(el: Element): string {
  if (el.id) return `#${cssEscape(el.id)}`;
  const path: string[] = [];
  let cur: Element | null = el;
  while (cur && cur !== document.body.parentElement) {
    if (cur === document.body) { path.unshift('body'); break; }
    const parent = cur.parentElement;
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
```

- [ ] **Step 9.4 — Run tests (pass)**

- [ ] **Step 9.5 — Commit**

```bash
git add .
git commit -m "selector + 슬라이더 라벨 빌더"
```

---

### Task 10: HTML sanitizer

**Files:**
- Create: `src/lib/sanitize-html.ts`, `tests/unit/sanitize-html.test.ts`

- [ ] **Step 10.1 — Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeOuterHTML } from '@/lib/sanitize-html';

beforeEach(() => { document.body.innerHTML = ''; });

describe('sanitizeOuterHTML', () => {
  it('removes inline style', () => {
    document.body.innerHTML = `<div style="color:red">x</div>`;
    const out = sanitizeOuterHTML(document.body.firstElementChild!);
    expect(out).not.toContain('style');
  });

  it('removes src/srcset', () => {
    document.body.innerHTML = `<img src="data:image/png;base64,XXXX" srcset="a 1x">`;
    const out = sanitizeOuterHTML(document.body.firstElementChild!);
    expect(out).not.toContain('src');
  });

  it('removes on* handlers', () => {
    document.body.innerHTML = `<button onclick="alert(1)">a</button>`;
    const out = sanitizeOuterHTML(document.body.firstElementChild!);
    expect(out).not.toContain('onclick');
  });

  it('replaces javascript: href with #', () => {
    document.body.innerHTML = `<a href="javascript:alert(1)">a</a>`;
    const out = sanitizeOuterHTML(document.body.firstElementChild!);
    expect(out).toContain('href="#"');
    expect(out).not.toContain('javascript:');
  });

  it('removes <input value>', () => {
    document.body.innerHTML = `<form><input type="password" value="secret"></form>`;
    const out = sanitizeOuterHTML(document.body.firstElementChild!);
    expect(out).not.toContain('secret');
    expect(out).not.toContain('value=');
  });

  it('removes <script> children', () => {
    document.body.innerHTML = `<div><script>alert(1)</script>visible</div>`;
    const out = sanitizeOuterHTML(document.body.firstElementChild!);
    expect(out).not.toContain('<script');
    expect(out).toContain('visible');
  });

  it('caps to 4000 chars', () => {
    const big = '<div>' + 'x'.repeat(10_000) + '</div>';
    document.body.innerHTML = big;
    const out = sanitizeOuterHTML(document.body.firstElementChild!);
    expect(out.length).toBeLessThanOrEqual(4_100); // 4000 + small marker
    expect(out).toContain('(잘림)');
  });

  it('removes iframe srcdoc', () => {
    document.body.innerHTML = `<iframe srcdoc="<x>"></iframe>`;
    const out = sanitizeOuterHTML(document.body.firstElementChild!);
    expect(out).not.toContain('srcdoc');
  });
});
```

- [ ] **Step 10.2 — Run tests (fail)**

- [ ] **Step 10.3 — Implement `src/lib/sanitize-html.ts`**

```ts
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
    if (STRIP_TAGS.has(child.tagName)) {
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
  return `<details><summary>선택 영역 HTML</summary>\n\n\`\`\`html\n${html}\n\`\`\`\n\n</details>`;
}
```

- [ ] **Step 10.4 — Run tests (pass)**

- [ ] **Step 10.5 — Commit**

```bash
git add .
git commit -m "outerHTML 정제 (on*/src/javascript:/input value 등)"
```

---

### Task 11: PII sanitizer

**Files:**
- Create: `src/lib/sanitize-pii.ts`, `tests/unit/sanitize-pii.test.ts`

- [ ] **Step 11.1 — Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { scrubPii } from '@/lib/sanitize-pii';

describe('scrubPii', () => {
  it('redacts access_token', () => {
    expect(scrubPii('https://x.com/?access_token=abc123&q=1'))
      .toBe('https://x.com/?access_token=***&q=1');
  });

  it('case-insensitive', () => {
    expect(scrubPii('https://x.com/?Token=abc'))
      .toBe('https://x.com/?Token=***');
  });

  it('multiple params', () => {
    const out = scrubPii('https://x.com/?api_key=a&secret=b&keep=c');
    expect(out).toContain('api_key=***');
    expect(out).toContain('secret=***');
    expect(out).toContain('keep=c');
  });

  it('returns original when no PII', () => {
    expect(scrubPii('https://x.com/page?q=1')).toBe('https://x.com/page?q=1');
  });

  it('handles invalid URL gracefully', () => {
    expect(scrubPii('not-a-url')).toBe('not-a-url');
  });

  it('redacts jwt and id_token', () => {
    const out = scrubPii('https://x.com/?jwt=AAA&id_token=BBB');
    expect(out).toContain('jwt=***');
    expect(out).toContain('id_token=***');
  });
});
```

- [ ] **Step 11.2 — Run tests (fail)**

- [ ] **Step 11.3 — Implement `src/lib/sanitize-pii.ts`**

```ts
import { PII_QUERY_KEYS } from '@/shared/constants';

const PII_SET = new Set(PII_QUERY_KEYS.map(k => k.toLowerCase()));

export function scrubPii(url: string): string {
  let u: URL;
  try { u = new URL(url); } catch { return url; }
  for (const key of [...u.searchParams.keys()]) {
    if (PII_SET.has(key.toLowerCase())) u.searchParams.set(key, '***');
  }
  return u.toString();
}
```

- [ ] **Step 11.4 — Run tests (pass)**

- [ ] **Step 11.5 — Commit**

```bash
git add .
git commit -m "URL query string PII 치환"
```

---

### Task 12: Ring buffer with dedup

**Files:**
- Create: `src/lib/ring-buffer.ts`, `tests/unit/ring-buffer.test.ts`

- [ ] **Step 12.1 — Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { dedupePush } from '@/lib/ring-buffer';
import type { ConsoleErrorEntry } from '@/shared/types';

const mk = (m: string, src: ConsoleErrorEntry['source'] = 'console.error'): ConsoleErrorEntry => ({
  message: m, timestamp: Date.now(), source: src, count: 1,
});

describe('dedupePush', () => {
  it('increments count when last matches', () => {
    const buf: ConsoleErrorEntry[] = [];
    dedupePush(buf, mk('TypeError: x'));
    dedupePush(buf, mk('TypeError: x'));
    dedupePush(buf, mk('TypeError: x'));
    expect(buf.length).toBe(1);
    expect(buf[0]!.count).toBe(3);
  });

  it('pushes new entry when source differs', () => {
    const buf: ConsoleErrorEntry[] = [];
    dedupePush(buf, mk('x', 'console.error'));
    dedupePush(buf, mk('x', 'window.onerror'));
    expect(buf.length).toBe(2);
  });

  it('pushes new entry when prefix differs', () => {
    const buf: ConsoleErrorEntry[] = [];
    dedupePush(buf, mk('A'));
    dedupePush(buf, mk('B'));
    expect(buf.length).toBe(2);
  });

  it('only dedups against last entry, not anywhere in buffer', () => {
    const buf: ConsoleErrorEntry[] = [];
    dedupePush(buf, mk('A'));
    dedupePush(buf, mk('B'));
    dedupePush(buf, mk('A'));
    expect(buf.length).toBe(3); // [A, B, A] not collapsed
  });

  it('FIFO drops oldest when exceeding cap', () => {
    const buf: ConsoleErrorEntry[] = [];
    for (let i = 0; i < 60; i++) dedupePush(buf, mk(`msg-${i}`));
    expect(buf.length).toBe(50);
    expect(buf[0]!.message).toBe('msg-10');
  });
});
```

- [ ] **Step 12.2 — Run tests (fail)**

- [ ] **Step 12.3 — Implement `src/lib/ring-buffer.ts`**

```ts
import type { ConsoleErrorEntry, NetworkFailureEntry } from '@/shared/types';
import { BUFFER_MAX, DEDUP_PREFIX_LEN } from '@/shared/constants';

type DedupEntry = ConsoleErrorEntry | NetworkFailureEntry;

export function dedupePush<T extends DedupEntry>(buf: T[], next: T): void {
  const last = buf[buf.length - 1];
  if (last && matchesLast(last, next)) {
    last.count += 1;
    last.timestamp = next.timestamp;
    return;
  }
  buf.push(next);
  if (buf.length > BUFFER_MAX) buf.shift();
}

function matchesLast(a: DedupEntry, b: DedupEntry): boolean {
  if ('message' in a && 'message' in b) {
    return a.source === b.source
      && a.message.slice(0, DEDUP_PREFIX_LEN) === b.message.slice(0, DEDUP_PREFIX_LEN);
  }
  if ('url' in a && 'url' in b) {
    return a.method === b.method && a.url === b.url && a.status === b.status;
  }
  return false;
}
```

- [ ] **Step 12.4 — Run tests (pass)**

- [ ] **Step 12.5 — Commit**

```bash
git add .
git commit -m "링 버퍼 + dedup (FIFO 50, prefix 200)"
```

---

### Task 13: HTTP error mapping + retry-after parsing

**Files:**
- Create: `src/lib/http-errors.ts`, `tests/unit/http-errors.test.ts`

- [ ] **Step 13.1 — Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { mapHttpToErrorCode, parseRetryAfter } from '@/lib/http-errors';

describe('mapHttpToErrorCode', () => {
  it('401 → auth', () => {
    expect(mapHttpToErrorCode(401, new Headers())).toBe('auth');
  });
  it('403 with Retry-After → rate_limit', () => {
    expect(mapHttpToErrorCode(403, new Headers({ 'Retry-After': '30' }))).toBe('rate_limit');
  });
  it('403 with X-RateLimit-Remaining: 0 → rate_limit', () => {
    expect(mapHttpToErrorCode(403, new Headers({ 'X-RateLimit-Remaining': '0' }))).toBe('rate_limit');
  });
  it('403 default → forbidden', () => {
    expect(mapHttpToErrorCode(403, new Headers())).toBe('forbidden');
  });
  it('404 → not_found', () => {
    expect(mapHttpToErrorCode(404, new Headers())).toBe('not_found');
  });
  it('422 → validation', () => {
    expect(mapHttpToErrorCode(422, new Headers())).toBe('validation');
  });
  it('500 → unknown', () => {
    expect(mapHttpToErrorCode(500, new Headers())).toBe('unknown');
  });
  it('other → unknown', () => {
    expect(mapHttpToErrorCode(418, new Headers())).toBe('unknown');
  });
});

describe('parseRetryAfter', () => {
  it('integer seconds from Retry-After', () => {
    const h = new Headers({ 'Retry-After': '30' });
    expect(parseRetryAfter(h, 1000)).toBe(30);
  });
  it('uses X-RateLimit-Reset (epoch sec) when no Retry-After', () => {
    const h = new Headers({ 'X-RateLimit-Reset': '1010' });
    expect(parseRetryAfter(h, 1_000_000)).toBe(1010 - 1000);
  });
  it('HTTP-date in Retry-After', () => {
    const future = new Date(Date.now() + 60_000).toUTCString();
    const h = new Headers({ 'Retry-After': future });
    const result = parseRetryAfter(h, Date.now());
    expect(result).toBeGreaterThan(50);
    expect(result).toBeLessThan(70);
  });
  it('returns 0 when no headers', () => {
    expect(parseRetryAfter(new Headers(), Date.now())).toBe(0);
  });
});
```

- [ ] **Step 13.2 — Run tests (fail)**

- [ ] **Step 13.3 — Implement `src/lib/http-errors.ts`**

```ts
import type { ErrorCode } from '@/shared/types';

export function mapHttpToErrorCode(status: number, headers: Headers): ErrorCode {
  if (status === 401) return 'auth';
  if (status === 403) {
    if (headers.has('Retry-After')) return 'rate_limit';
    if (headers.get('X-RateLimit-Remaining') === '0') return 'rate_limit';
    return 'forbidden';
  }
  if (status === 404) return 'not_found';
  if (status === 422) return 'validation';
  if (status >= 500 && status < 600) return 'unknown';
  return 'unknown';
}

/** Returns seconds until retry is allowed (0 if no info). */
export function parseRetryAfter(headers: Headers, nowMs: number): number {
  const ra = headers.get('Retry-After');
  if (ra) {
    const asInt = parseInt(ra, 10);
    if (!isNaN(asInt) && String(asInt) === ra.trim()) return asInt;
    const asDate = new Date(ra).getTime();
    if (!isNaN(asDate)) return Math.max(0, Math.floor((asDate - nowMs) / 1000));
  }
  const reset = headers.get('X-RateLimit-Reset');
  if (reset) {
    const epoch = parseInt(reset, 10);
    if (!isNaN(epoch)) return Math.max(0, epoch - Math.floor(nowMs / 1000));
  }
  return 0;
}
```

- [ ] **Step 13.4 — Run tests (pass)**

- [ ] **Step 13.5 — Commit**

```bash
git add .
git commit -m "HTTP 에러 매핑 + Retry-After 파싱"
```

---

### Task 14: Issue body formatting + budget

**Files:**
- Create: `src/lib/format-body.ts`, `tests/unit/format-body.test.ts`

- [ ] **Step 14.1 — Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { formatIssueBody, applyBodyBudget } from '@/lib/format-body';
import type { CollectedData } from '@/shared/types';
import { BODY_BUDGET } from '@/shared/constants';

const baseCollected: CollectedData = {
  url: 'https://x.com/page',
  viewport: { w: 1440, h: 900 },
  ua: { userAgent: 'UA', platform: 'macOS 14.5', browser: 'Chrome 138' },
  consoleErrors: [],
  networkFailures: [],
  capturedAt: 1_000,
  selectedDepth: 1,
  selector: 'body > div',
  parentChainSummary: ['button', 'div.card'],
  outerHTML: '<div>x</div>',
};

describe('formatIssueBody', () => {
  it('includes user description and collected sections', () => {
    const body = formatIssueBody('설명', baseCollected);
    expect(body).toContain('## 설명');
    expect(body).toContain('설명');
    expect(body).toContain('자동 수집 정보');
    expect(body).toContain('https://x.com/page');
    expect(body).toContain('Chrome 138');
    expect(body).toContain('1440');
  });

  it('outerHTML inside <details>', () => {
    const body = formatIssueBody('x', baseCollected);
    expect(body).toContain('<details>');
    expect(body).toContain('<div>x</div>');
  });

  it('omits empty console/network sections', () => {
    const body = formatIssueBody('x', baseCollected);
    expect(body).not.toContain('콘솔 에러');
    expect(body).not.toContain('네트워크');
  });

  it('shows console + network when present', () => {
    const c: CollectedData = {
      ...baseCollected,
      consoleErrors: [{ message: 'TypeError', source: 'console.error', timestamp: 0, count: 2 }],
      networkFailures: [{ method: 'GET', url: '/api/x', status: 500, statusText: 'err', timestamp: 0, count: 1 }],
    };
    const body = formatIssueBody('x', c);
    expect(body).toContain('콘솔 에러');
    expect(body).toContain('TypeError');
    expect(body).toContain('네트워크 실패');
    expect(body).toContain('500');
  });
});

describe('applyBodyBudget', () => {
  it('returns as-is when under budget', () => {
    const out = applyBodyBudget('short body');
    expect(out).toBe('short body');
  });

  it('truncates user content when over budget', () => {
    const huge = 'a'.repeat(BODY_BUDGET + 5_000);
    const out = applyBodyBudget(huge);
    expect(out.length).toBeLessThanOrEqual(BODY_BUDGET);
    expect(out).toContain('(사용자 입력 일부 생략)');
  });
});
```

- [ ] **Step 14.2 — Run tests (fail)**

- [ ] **Step 14.3 — Implement `src/lib/format-body.ts`**

```ts
import type { CollectedData } from '@/shared/types';
import { BODY_BUDGET, BODY_CONSOLE_ERRORS_MAX, BODY_NETWORK_FAILURES_MAX,
         BODY_CONSOLE_MESSAGE_CAP, BODY_CONSOLE_STACK_CAP } from '@/shared/constants';
import { wrapInDetails } from './sanitize-html';

export function formatIssueBody(userDescription: string, c: CollectedData): string {
  const parts: string[] = [];
  parts.push(`## 설명\n${userDescription || '(설명 없음)'}\n`);
  parts.push('---');
  parts.push('## 자동 수집 정보');
  parts.push(`- **URL**: ${c.url}`);
  parts.push(`- **선택 범위**: depth +${c.selectedDepth} (${c.parentChainSummary[c.selectedDepth] ?? c.parentChainSummary.at(-1) ?? '?'})`);
  parts.push(`- **Selector**: \`${c.selector}\``);
  parts.push(`- **브라우저**: ${c.ua.browser} / ${c.ua.platform}`);
  parts.push(`- **뷰포트**: ${c.viewport.w} × ${c.viewport.h}`);
  parts.push(`- **감지 시각**: ${new Date(c.capturedAt).toISOString()}`);
  parts.push('');
  parts.push(wrapInDetails(c.outerHTML));

  if (c.consoleErrors.length > 0) {
    const slice = c.consoleErrors.slice(-BODY_CONSOLE_ERRORS_MAX);
    parts.push(`\n### 콘솔 에러 (${c.consoleErrors.length}건)\n`);
    for (const e of slice) {
      const msg = e.message.slice(0, BODY_CONSOLE_MESSAGE_CAP);
      const cnt = e.count > 1 ? ` ×${e.count}` : '';
      parts.push(`- [${e.source}${cnt}] ${msg}`);
      if (e.stack) parts.push('  ```\n' + e.stack.slice(0, BODY_CONSOLE_STACK_CAP) + '\n  ```');
    }
  }

  if (c.networkFailures.length > 0) {
    const slice = c.networkFailures.slice(-BODY_NETWORK_FAILURES_MAX);
    parts.push(`\n### 네트워크 실패 (${c.networkFailures.length}건)\n`);
    for (const n of slice) {
      const cnt = n.count > 1 ? ` ×${n.count}` : '';
      parts.push(`- ${n.method} ${n.url} → ${n.status} ${n.statusText}${cnt}`);
    }
  }

  return parts.join('\n');
}

export function applyBodyBudget(body: string): string {
  if (body.length <= BODY_BUDGET) return body;
  const footer = '\n\n_(사용자 입력 일부 생략)_';
  return body.slice(0, BODY_BUDGET - footer.length) + footer;
}
```

- [ ] **Step 14.4 — Run tests (pass)**

- [ ] **Step 14.5 — Commit**

```bash
git add .
git commit -m "이슈 본문 생성 + 60K 자르기 예산"
```

---

### Task 15: UA / platform parsing

**Files:**
- Create: `src/lib/ua-parse.ts`, `tests/unit/ua-parse.test.ts`

- [ ] **Step 15.1 — Write failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import { parseUAString, captureUserAgent } from '@/lib/ua-parse';

describe('parseUAString', () => {
  it('parses Chrome on macOS', () => {
    const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36';
    const result = parseUAString(ua);
    expect(result.browser).toContain('Chrome');
    expect(result.platform).toContain('Mac');
  });

  it('falls back gracefully on unknown UA', () => {
    const result = parseUAString('SomeUnknown/1.0');
    expect(result.userAgent).toBe('SomeUnknown/1.0');
    expect(result.browser).toBeTruthy();
    expect(result.platform).toBeTruthy();
  });
});

describe('captureUserAgent', () => {
  it('uses userAgentData when available', async () => {
    const fakeData = {
      getHighEntropyValues: vi.fn().mockResolvedValue({
        platform: 'macOS',
        platformVersion: '14.5',
        fullVersionList: [
          { brand: 'Not-A.Brand', version: '99' },
          { brand: 'Chromium', version: '138.0.0.0' },
        ],
      }),
    };
    Object.defineProperty(navigator, 'userAgentData', {
      value: fakeData, configurable: true,
    });
    const result = await captureUserAgent();
    expect(result.browser).toContain('Chromium');
    expect(result.platform).toContain('macOS');
  });
});
```

- [ ] **Step 15.2 — Run tests (fail)**

- [ ] **Step 15.3 — Implement `src/lib/ua-parse.ts`**

```ts
import type { UAInfo } from '@/shared/types';

interface UAData {
  getHighEntropyValues(hints: string[]): Promise<{
    platform: string; platformVersion: string;
    fullVersionList: { brand: string; version: string }[];
  }>;
}

export async function captureUserAgent(): Promise<UAInfo> {
  const data = (navigator as unknown as { userAgentData?: UAData }).userAgentData;
  if (data?.getHighEntropyValues) {
    try {
      const d = await data.getHighEntropyValues(['platformVersion', 'fullVersionList']);
      const brand = d.fullVersionList.find(b => !/Not.A.Brand/i.test(b.brand))
                 ?? d.fullVersionList[0];
      return {
        userAgent: navigator.userAgent,
        platform: `${d.platform} ${d.platformVersion}`.trim(),
        browser: brand ? `${brand.brand} ${brand.version}` : 'Unknown',
      };
    } catch { /* fall through */ }
  }
  return parseUAString(navigator.userAgent);
}

export function parseUAString(ua: string): UAInfo {
  let browser = 'Unknown';
  let platform = 'Unknown';
  const chromeMatch = ua.match(/(Chrome|Edg|Firefox|Safari)\/([\d.]+)/);
  if (chromeMatch) browser = `${chromeMatch[1]} ${chromeMatch[2]}`;
  const platMatch = ua.match(/\(([^)]+)\)/);
  if (platMatch) platform = platMatch[1]!.split(';')[0]!.trim();
  return { userAgent: ua, browser, platform };
}
```

- [ ] **Step 15.4 — Run tests (pass)**

- [ ] **Step 15.5 — Commit**

```bash
git add .
git commit -m "UA / platform 파싱 (userAgentData 우선, regex fallback)"
```

---

## Phase 4: Storage Layer

### Task 16: Mapping store (chrome.storage wrapper)

**Files:**
- Create: `src/background/mapping-store.ts`, `tests/integration/mapping-store.test.ts`

- [ ] **Step 16.1 — Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import chrome from 'sinon-chrome';
import { loadMappings, saveMapping, deleteMapping } from '@/background/mapping-store';
import type { Mapping } from '@/shared/types';

beforeEach(() => {
  chrome.flush();
  chrome.storage.local.get.resolves({});
  chrome.storage.local.set.resolves();
});

const mk = (id: string): Mapping => ({
  id, name: `Map-${id}`, urlPatterns: ['x.com'], repo: 'o/r',
  token: 't', lastVerifiedAt: null, createdAt: 0,
});

describe('mapping-store', () => {
  it('loadMappings returns empty when storage is empty', async () => {
    chrome.storage.local.get.resolves({});
    const m = await loadMappings();
    expect(m).toEqual([]);
  });

  it('loadMappings migrates and returns mappings', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [mk('a')] }
    });
    const m = await loadMappings();
    expect(m).toHaveLength(1);
    expect(m[0]!.id).toBe('a');
  });

  it('saveMapping adds new entry', async () => {
    chrome.storage.local.get.resolves({ qaExt: { schemaVersion: 1, mappings: [] } });
    await saveMapping(mk('a'));
    const setCall = chrome.storage.local.set.firstCall.args[0];
    expect(setCall.qaExt.mappings).toHaveLength(1);
  });

  it('saveMapping updates existing entry', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [mk('a')] }
    });
    const updated = { ...mk('a'), name: 'Updated' };
    await saveMapping(updated);
    const setCall = chrome.storage.local.set.firstCall.args[0];
    expect(setCall.qaExt.mappings[0].name).toBe('Updated');
  });

  it('deleteMapping removes entry', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [mk('a'), mk('b')] }
    });
    await deleteMapping('a');
    const setCall = chrome.storage.local.set.firstCall.args[0];
    expect(setCall.qaExt.mappings).toHaveLength(1);
    expect(setCall.qaExt.mappings[0].id).toBe('b');
  });
});
```

- [ ] **Step 16.2 — Run tests (fail)**

- [ ] **Step 16.3 — Implement `src/background/mapping-store.ts`**

```ts
import type { Mapping, StorageSchema } from '@/shared/types';
import { migrateStorage } from '@/lib/storage-migrate';

const STORAGE_KEY = 'qaExt';

async function readSchema(): Promise<StorageSchema> {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  return migrateStorage(raw?.[STORAGE_KEY]);
}

async function writeSchema(schema: StorageSchema): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: schema });
}

export async function loadMappings(): Promise<Mapping[]> {
  return (await readSchema()).mappings;
}

export async function saveMapping(mapping: Mapping): Promise<void> {
  const schema = await readSchema();
  const idx = schema.mappings.findIndex(m => m.id === mapping.id);
  if (idx >= 0) schema.mappings[idx] = mapping;
  else schema.mappings.push(mapping);
  await writeSchema(schema);
}

export async function deleteMapping(id: string): Promise<void> {
  const schema = await readSchema();
  schema.mappings = schema.mappings.filter(m => m.id !== id);
  await writeSchema(schema);
}

export async function getMapping(id: string): Promise<Mapping | null> {
  const schema = await readSchema();
  return schema.mappings.find(m => m.id === id) ?? null;
}

export async function touchVerified(id: string, ts: number): Promise<void> {
  const schema = await readSchema();
  const m = schema.mappings.find(m => m.id === id);
  if (m) {
    m.lastVerifiedAt = ts;
    await writeSchema(schema);
  }
}
```

- [ ] **Step 16.4 — Run tests (pass)**

- [ ] **Step 16.5 — Commit**

```bash
git add .
git commit -m "매핑 storage CRUD wrapper"
```

---

## Phase 5: Content Scripts

### Task 17: MAIN-world monkey-patch script

**Files:**
- Modify: `src/content-main/index.ts`

- [ ] **Step 17.1 — Implement `src/content-main/index.ts`**

```ts
import { POST_MESSAGE_SOURCE } from '@/shared/constants';
import type { MainToIsoMessage } from '@/shared/types';

const origin = window.location.origin;

function post(msg: MainToIsoMessage): void {
  window.postMessage(msg, origin);
}

// === fetch wrapper ===
const origFetch = window.fetch;
window.fetch = async function (...args) {
  const startMethod = (args[1] as RequestInit | undefined)?.method ?? 'GET';
  const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
  try {
    const res = await origFetch.apply(this, args);
    if (res.status >= 400 || res.status === 0) {
      post({
        __qaSource: POST_MESSAGE_SOURCE,
        kind: 'network.failure',
        entry: {
          method: startMethod, url,
          status: res.status, statusText: res.statusText,
          timestamp: Date.now(),
        },
      });
    }
    return res;
  } catch (err) {
    post({
      __qaSource: POST_MESSAGE_SOURCE,
      kind: 'network.failure',
      entry: {
        method: startMethod, url,
        status: 0, statusText: String(err),
        timestamp: Date.now(),
      },
    });
    throw err;
  }
};

// === XMLHttpRequest wrapper ===
const origOpen = XMLHttpRequest.prototype.open;
const origSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function (method: string, url: string | URL, ...rest: unknown[]) {
  (this as any).__qaMethod = method;
  (this as any).__qaUrl = String(url);
  return origOpen.call(this, method, url, ...(rest as []));
};
XMLHttpRequest.prototype.send = function (...args) {
  this.addEventListener('loadend', () => {
    if (this.status >= 400 || this.status === 0) {
      post({
        __qaSource: POST_MESSAGE_SOURCE,
        kind: 'network.failure',
        entry: {
          method: (this as any).__qaMethod ?? 'GET',
          url: (this as any).__qaUrl ?? '',
          status: this.status,
          statusText: this.statusText,
          timestamp: Date.now(),
        },
      });
    }
  });
  return origSend.apply(this, args as []);
};

// === console.error wrapper ===
const origError = console.error;
console.error = function (...args: unknown[]) {
  post({
    __qaSource: POST_MESSAGE_SOURCE,
    kind: 'console.error',
    entry: {
      message: args.map(a => String(a)).join(' '),
      source: 'console.error',
      timestamp: Date.now(),
    },
  });
  return origError.apply(this, args as []);
};

// === window.onerror ===
window.addEventListener('error', (e) => {
  post({
    __qaSource: POST_MESSAGE_SOURCE,
    kind: 'console.error',
    entry: {
      message: e.message ?? String(e.error),
      stack: e.error?.stack,
      source: 'window.onerror',
      timestamp: Date.now(),
    },
  });
});

// === unhandledrejection ===
window.addEventListener('unhandledrejection', (e) => {
  post({
    __qaSource: POST_MESSAGE_SOURCE,
    kind: 'console.error',
    entry: {
      message: String(e.reason),
      stack: (e.reason as { stack?: string })?.stack,
      source: 'unhandledrejection',
      timestamp: Date.now(),
    },
  });
});
```

- [ ] **Step 17.2 — Build to verify TS**

```bash
npm run build
```

- [ ] **Step 17.3 — Commit**

```bash
git add .
git commit -m "MAIN-world content script: fetch/XHR/console monkey-patch"
```

---

### Task 18: ISOLATED-world buffer + postMessage receiver

**Files:**
- Create: `src/content-iso/buffer.ts`, `tests/unit/content-iso-buffer.test.ts`

- [ ] **Step 18.1 — Write failing tests**

```ts
import { describe, it, expect } from 'vitest';
import { ConsoleErrorEntry, NetworkFailureEntry } from '@/shared/types';
import { Buffers, ingestMessage } from '@/content-iso/buffer';

describe('content-iso buffer', () => {
  it('ignores message without source marker', () => {
    const b = new Buffers();
    ingestMessage(b, { foo: 1 } as unknown);
    expect(b.consoleErrors).toHaveLength(0);
    expect(b.networkFailures).toHaveLength(0);
  });

  it('ingests console.error', () => {
    const b = new Buffers();
    ingestMessage(b, {
      __qaSource: 'qa-ext',
      kind: 'console.error',
      entry: { message: 'oops', source: 'console.error', timestamp: 1 },
    });
    expect(b.consoleErrors).toHaveLength(1);
    expect(b.consoleErrors[0]!.count).toBe(1);
  });

  it('dedups consecutive identical errors', () => {
    const b = new Buffers();
    for (let i = 0; i < 5; i++) {
      ingestMessage(b, {
        __qaSource: 'qa-ext', kind: 'console.error',
        entry: { message: 'same', source: 'console.error', timestamp: i },
      });
    }
    expect(b.consoleErrors).toHaveLength(1);
    expect(b.consoleErrors[0]!.count).toBe(5);
  });

  it('ingests network.failure', () => {
    const b = new Buffers();
    ingestMessage(b, {
      __qaSource: 'qa-ext', kind: 'network.failure',
      entry: { method: 'GET', url: '/api', status: 500, statusText: 'err', timestamp: 1 },
    });
    expect(b.networkFailures).toHaveLength(1);
  });
});
```

- [ ] **Step 18.2 — Run tests (fail)**

- [ ] **Step 18.3 — Implement `src/content-iso/buffer.ts`**

```ts
import type { ConsoleErrorEntry, NetworkFailureEntry, MainToIsoMessage } from '@/shared/types';
import { POST_MESSAGE_SOURCE } from '@/shared/constants';
import { dedupePush } from '@/lib/ring-buffer';

export class Buffers {
  consoleErrors: ConsoleErrorEntry[] = [];
  networkFailures: NetworkFailureEntry[] = [];
}

export function ingestMessage(buf: Buffers, raw: unknown): void {
  if (!raw || typeof raw !== 'object') return;
  const msg = raw as Partial<MainToIsoMessage>;
  if (msg.__qaSource !== POST_MESSAGE_SOURCE) return;
  if (msg.kind === 'console.error' && msg.entry) {
    dedupePush(buf.consoleErrors, { ...msg.entry, count: 1 });
  } else if (msg.kind === 'network.failure' && msg.entry) {
    dedupePush(buf.networkFailures, { ...msg.entry, count: 1 });
  }
}
```

- [ ] **Step 18.4 — Run tests (pass)**

- [ ] **Step 18.5 — Commit**

```bash
git add .
git commit -m "content-iso 버퍼 + postMessage 수신"
```

---

### Task 19: Shadow DOM overlay (highlight only)

**Files:**
- Create: `src/content-iso/overlay.ts`

- [ ] **Step 19.1 — Implement `src/content-iso/overlay.ts`**

```ts
const HOST_ID = '__qa-overlay-host';
const OPEN_MODE = (import.meta.env.MODE !== 'production');

export class Overlay {
  private host: HTMLDivElement | null = null;
  private root: ShadowRoot | null = null;
  private rect: HTMLDivElement | null = null;

  mount(): void {
    if (this.host) return;
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.host.style.cssText = `
      position: fixed; inset: 0;
      pointer-events: none;
      z-index: 2147483647;
    `;
    this.root = this.host.attachShadow({ mode: OPEN_MODE ? 'open' : 'closed' });
    this.root.innerHTML = `
      <style>
        :host { all: initial; }
        .rect {
          position: fixed;
          pointer-events: none;
          outline: 2px solid #e74c3c;
          outline-offset: 1px;
          background: rgba(231, 76, 60, 0.08);
          transition: top 60ms, left 60ms, width 60ms, height 60ms;
          box-sizing: border-box;
        }
      </style>
      <div class="rect" style="top:0;left:0;width:0;height:0"></div>
    `;
    this.rect = this.root.querySelector('.rect') as HTMLDivElement;
    document.documentElement.appendChild(this.host);
  }

  unmount(): void {
    this.host?.remove();
    this.host = null; this.root = null; this.rect = null;
  }

  highlight(el: Element | null): void {
    if (!this.rect) return;
    if (!el) {
      this.rect.style.cssText = 'position:fixed;pointer-events:none;width:0;height:0;outline:2px solid #e74c3c;background:rgba(231,76,60,0.08);box-sizing:border-box;';
      return;
    }
    const r = el.getBoundingClientRect();
    this.rect.style.top = `${r.top}px`;
    this.rect.style.left = `${r.left}px`;
    this.rect.style.width = `${r.width}px`;
    this.rect.style.height = `${r.height}px`;
  }
}
```

- [ ] **Step 19.2 — Commit**

```bash
git add .
git commit -m "Shadow DOM highlight overlay (read-only)"
```

---

### Task 20: Selection mode (hover/click/ESC, parent chain)

**Files:**
- Create: `src/content-iso/selection-mode.ts`

- [ ] **Step 20.1 — Implement `src/content-iso/selection-mode.ts`**

```ts
import { Overlay } from './overlay';
import { buildSelector, buildLabel } from '@/lib/selector';
import { sanitizeOuterHTML } from '@/lib/sanitize-html';
import type { PickedElement } from '@/shared/types';

const BLOCK_EVENTS = [
  'pointerdown', 'mousedown', 'mouseup',
  'click', 'auxclick', 'dblclick',
  'contextmenu', 'submit',
] as const;

type Callbacks = {
  onPicked: (payload: PickedElement) => void;
  onCancelled: () => void;
};

export class SelectionMode {
  private overlay = new Overlay();
  private active = false;
  private currentTarget: Element | null = null;
  private parentChain: Element[] = [];
  private currentDepth = 0;

  constructor(private cb: Callbacks) {}

  start(): void {
    if (this.active) return;
    this.active = true;
    this.overlay.mount();
    document.body.style.cursor = 'crosshair';
    BLOCK_EVENTS.forEach(t =>
      document.addEventListener(t, this.blockAll, true)
    );
    document.addEventListener('keydown', this.handleKey, true);
    document.addEventListener('mousemove', this.handleMove, true);
    document.addEventListener('click', this.handleClick, true);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.overlay.unmount();
    document.body.style.cursor = '';
    BLOCK_EVENTS.forEach(t =>
      document.removeEventListener(t, this.blockAll, true)
    );
    document.removeEventListener('keydown', this.handleKey, true);
    document.removeEventListener('mousemove', this.handleMove, true);
    document.removeEventListener('click', this.handleClick, true);
    this.currentTarget = null;
    this.parentChain = [];
    this.currentDepth = 0;
  }

  setDepth(depth: number): PickedElement | null {
    if (this.parentChain.length === 0) return null;
    this.currentDepth = Math.max(0, Math.min(depth, this.parentChain.length - 1));
    const el = this.parentChain[this.currentDepth]!;
    this.overlay.highlight(el);
    return this.toPayload(el);
  }

  private blockAll = (e: Event): void => {
    if (!this.active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  private handleKey = (e: KeyboardEvent): void => {
    if (!this.active) return;
    if (e.key === 'Escape') {
      this.stop();
      this.cb.onCancelled();
      return;
    }
    // Block other keys
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  private handleMove = (e: MouseEvent): void => {
    if (!this.active) return;
    const el = e.target as Element | null;
    if (!el || el === this.currentTarget) return;
    this.currentTarget = el;
    this.overlay.highlight(el);
  };

  private handleClick = (e: MouseEvent): void => {
    if (!this.active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const el = e.target as Element | null;
    if (!el) return;
    this.parentChain = computeParentChain(el);
    this.currentDepth = 0;
    const payload = this.toPayload(el);
    this.overlay.highlight(el);
    // Keep overlay alive but stop intercepting page events
    BLOCK_EVENTS.forEach(t =>
      document.removeEventListener(t, this.blockAll, true)
    );
    document.removeEventListener('mousemove', this.handleMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.body.style.cursor = '';
    this.cb.onPicked(payload);
  };

  private toPayload(el: Element): PickedElement {
    return {
      selector: buildSelector(el),
      outerHTML: sanitizeOuterHTML(el),
      parentChainSummary: this.parentChain.map(buildLabel),
      maxDepth: Math.max(0, this.parentChain.length - 1),
      currentDepth: this.currentDepth,
    };
  }
}

function computeParentChain(start: Element): Element[] {
  const chain: Element[] = [];
  let cur: Element | null = start;
  while (cur && cur !== document.body) {
    chain.push(cur);
    cur = cur.parentElement;
  }
  return chain;
}
```

- [ ] **Step 20.2 — Build**

```bash
npm run build
```

- [ ] **Step 20.3 — Commit**

```bash
git add .
git commit -m "선택 모드: hover/click/ESC + parent chain"
```

---

### Task 21: ISOLATED-world router (message handling)

**Files:**
- Modify: `src/content-iso/index.ts`

- [ ] **Step 21.1 — Implement `src/content-iso/index.ts`**

```ts
import { Buffers, ingestMessage } from './buffer';
import { SelectionMode } from './selection-mode';
import { captureUserAgent } from '@/lib/ua-parse';
import { scrubPii } from '@/lib/sanitize-pii';
import type { PanelToContent, ContentToPanel, CapturedSnapshot } from '@/shared/types';

const buf = new Buffers();
let selection: SelectionMode | null = null;

// === MAIN-world postMessage receiver ===
window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (e.origin !== window.location.origin) return;
  ingestMessage(buf, e.data);
});

// === panel messages (relayed via background) ===
chrome.runtime.onMessage.addListener((msg: PanelToContent, _sender, sendResponse) => {
  switch (msg.kind) {
    case 'selection.start': {
      ensureSelection();
      selection!.start();
      sendResponse({ ok: true });
      return false;
    }
    case 'selection.cancel': {
      selection?.stop();
      sendResponse({ ok: true });
      return false;
    }
    case 'selection.depthChange': {
      const payload = selection?.setDepth(msg.depth);
      if (payload) relay({ kind: 'selection.updated', payload });
      sendResponse({ ok: true });
      return false;
    }
    case 'capture.snapshot': {
      buildSnapshot().then(snap => {
        sendResponse({ kind: 'capture.snapshot.result', payload: snap });
      });
      return true; // keep channel open for async
    }
  }
  return false;
});

function ensureSelection() {
  if (selection) return;
  selection = new SelectionMode({
    onPicked: (payload) => relay({ kind: 'selection.picked', payload }),
    onCancelled: () => relay({ kind: 'selection.cancelled' }),
  });
}

function relay(msg: ContentToPanel) {
  chrome.runtime.sendMessage({ kind: 'content.relay', payload: msg }).catch(() => {});
}

async function buildSnapshot(): Promise<CapturedSnapshot> {
  const ua = await captureUserAgent();
  return {
    url: scrubPii(window.location.href),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    ua,
    consoleErrors: structuredClone(buf.consoleErrors),
    networkFailures: structuredClone(buf.networkFailures.map(n => ({
      ...n, url: scrubPii(n.url),
    }))),
    capturedAt: Date.now(),
  };
}
```

- [ ] **Step 21.2 — Build verify**

```bash
npm run build
```

- [ ] **Step 21.3 — Commit**

```bash
git add .
git commit -m "content-iso 메시지 라우터 + 스냅샷 생성"
```

---


## Phase 6: Background Service Worker

### Task 22: Background message router skeleton

**Files:**
- Modify: `src/background/index.ts`

- [ ] **Step 22.1 — Implement basic router**

```ts
import type { PanelToBg, BgToPanel, BootstrapResponse } from '@/shared/types';
import { handleBootstrap } from './panel-bootstrap';
import { handleIssueSubmit } from './issue-submit';
import { handleTokenTest } from './token-test';
import { saveMapping, deleteMapping } from './mapping-store';
import { bindTab, getBoundTab, rebindToActive, watchTabClosed } from './routing';

console.debug('[qa-ext] background worker booted');

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url) return;
  bindTab(tab.id, tab.url);
  await chrome.sidePanel.setOptions({ tabId: tab.id, path: 'src/panel/index.html', enabled: true });
  await chrome.sidePanel.open({ tabId: tab.id });
});

chrome.runtime.onMessage.addListener((msg: PanelToBg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.kind) {
        case 'panel.bootstrap': {
          const bound = getBoundTab();
          if (!bound) { sendResponse({ ok: false, code: 'no_tab' }); return; }
          const result: BootstrapResponse = await handleBootstrap(bound.tabId, bound.url);
          sendResponse({ ok: true, payload: result });
          return;
        }
        case 'issue.submit': {
          const result = await handleIssueSubmit(msg.payload);
          sendResponse(result);
          return;
        }
        case 'token.test': {
          const result = await handleTokenTest(msg.mappingId);
          sendResponse(result);
          return;
        }
        case 'mapping.save': {
          await saveMapping(msg.mapping);
          sendResponse({ ok: true });
          return;
        }
        case 'mapping.delete': {
          await deleteMapping(msg.id);
          sendResponse({ ok: true });
          return;
        }
        case 'tab.rebind': {
          const bound = await rebindToActive();
          sendResponse({ ok: !!bound, payload: bound });
          return;
        }
        case 'forward.toContent': {
          const bound = getBoundTab();
          if (!bound) { sendResponse({ ok: false, code: 'no_tab' }); return; }
          try {
            const resp = await chrome.tabs.sendMessage(bound.tabId, msg.payload);
            sendResponse({ ok: true, payload: resp });
          } catch {
            sendResponse({ ok: false, code: 'tab_gone' });
          }
          return;
        }
      }
    } catch (err) {
      sendResponse({ ok: false, code: 'unknown', message: String(err) });
    }
  })();
  return true; // async response
});

// Relay content-script messages (selection.picked etc.) back to panel
chrome.runtime.onMessage.addListener((msg: any) => {
  if (msg?.kind === 'content.relay') {
    chrome.runtime.sendMessage<BgToPanel>({ kind: 'content.relay', payload: msg.payload }).catch(() => {});
  }
});

// Detect tab close and notify panel
watchTabClosed((tabId) => {
  chrome.runtime.sendMessage<BgToPanel>({ kind: 'tab.gone' }).catch(() => {});
});
```

- [ ] **Step 22.2 — Commit (stubs not yet implemented; build will fail until next tasks complete)**

Skip commit until Task 24.

---

### Task 23: Routing module (tab binding + close detection)

**Files:**
- Create: `src/background/routing.ts`, `tests/integration/routing.test.ts`

- [ ] **Step 23.1 — Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import chrome from 'sinon-chrome';
import { bindTab, getBoundTab, watchTabClosed, rebindToActive } from '@/background/routing';

beforeEach(() => { chrome.flush(); });

describe('routing', () => {
  it('bindTab / getBoundTab', () => {
    bindTab(42, 'https://x.com');
    expect(getBoundTab()).toEqual({ tabId: 42, url: 'https://x.com' });
  });

  it('watchTabClosed fires when bound tab closes', () => {
    bindTab(42, 'https://x.com');
    let firedId: number | null = null;
    watchTabClosed((tabId) => { firedId = tabId; });
    // Simulate Chrome firing the listener
    const listener = chrome.tabs.onRemoved.addListener.firstCall.args[0];
    listener(42);
    expect(firedId).toBe(42);
    expect(getBoundTab()).toBeNull();
  });

  it('watchTabClosed does not fire for unrelated tab', () => {
    bindTab(42, 'https://x.com');
    let firedId: number | null = null;
    watchTabClosed((tabId) => { firedId = tabId; });
    const listener = chrome.tabs.onRemoved.addListener.firstCall.args[0];
    listener(99);
    expect(firedId).toBeNull();
    expect(getBoundTab()).not.toBeNull();
  });
});
```

- [ ] **Step 23.2 — Run test (fail)**

- [ ] **Step 23.3 — Implement `src/background/routing.ts`**

```ts
interface BoundTab { tabId: number; url: string; }

let bound: BoundTab | null = null;

export function bindTab(tabId: number, url: string): void {
  bound = { tabId, url };
}

export function getBoundTab(): BoundTab | null {
  return bound;
}

export function clearBound(): void {
  bound = null;
}

export async function rebindToActive(): Promise<BoundTab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return null;
  bound = { tabId: tab.id, url: tab.url };
  return bound;
}

export function watchTabClosed(cb: (tabId: number) => void): void {
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (bound?.tabId === tabId) {
      const closed = bound.tabId;
      bound = null;
      cb(closed);
    }
  });
}
```

- [ ] **Step 23.4 — Run tests (pass)**

- [ ] **Step 23.5 — Commit**

```bash
git add .
git commit -m "탭 바인딩 + 닫힘 감지 routing 모듈"
```

---

### Task 24: panel.bootstrap handler

**Files:**
- Create: `src/background/panel-bootstrap.ts`, `tests/integration/panel-bootstrap.test.ts`

- [ ] **Step 24.1 — Write failing test**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import chrome from 'sinon-chrome';
import { handleBootstrap } from '@/background/panel-bootstrap';

beforeEach(() => {
  chrome.flush();
});

describe('handleBootstrap', () => {
  it('returns null activeMappingId when storage empty', async () => {
    chrome.storage.local.get.resolves({});
    const result = await handleBootstrap(1, 'https://x.com');
    expect(result.activeMappingId).toBeNull();
    expect(result.allCandidates).toEqual([]);
    expect(result.tabId).toBe(1);
    expect(result.hostOnly).toBe('x.com');
  });

  it('picks best mapping', async () => {
    chrome.storage.local.get.resolves({
      qaExt: {
        schemaVersion: 1,
        mappings: [
          { id: 'a', name: 'A', urlPatterns: ['*.vercel.app'], repo: 'o/r', token: 't', lastVerifiedAt: null, createdAt: 0 },
          { id: 'b', name: 'B', urlPatterns: ['myapp-*-myorg.vercel.app'], repo: 'o/r', token: 't', lastVerifiedAt: null, createdAt: 0 },
        ],
      },
    });
    const result = await handleBootstrap(1, 'https://myapp-feat-myorg.vercel.app/');
    expect(result.activeMappingId).toBe('b');
    expect(new Set(result.allCandidates)).toEqual(new Set(['a', 'b']));
  });
});
```

- [ ] **Step 24.2 — Run test (fail)**

- [ ] **Step 24.3 — Implement `src/background/panel-bootstrap.ts`**

```ts
import type { BootstrapResponse } from '@/shared/types';
import { loadMappings } from './mapping-store';
import { pickBestMapping, candidateMappings } from '@/lib/pick-mapping';
import { normalizeUrl } from '@/lib/url-pattern';

export async function handleBootstrap(tabId: number, url: string): Promise<BootstrapResponse> {
  const mappings = await loadMappings();
  const best = pickBestMapping(mappings, url);
  const cands = candidateMappings(mappings, url);
  return {
    activeMappingId: best?.id ?? null,
    allCandidates: cands,
    tabId,
    url,
    hostOnly: normalizeUrl(url),
  };
}
```

- [ ] **Step 24.4 — Run tests (pass)**

- [ ] **Step 24.5 — Commit**

```bash
git add .
git commit -m "panel.bootstrap 핸들러"
```

---

### Task 25: GitHub API wrapper

**Files:**
- Create: `src/background/github-api.ts`, `tests/integration/github-api.test.ts`

- [ ] **Step 25.1 — Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ghCreateIssue, ghCheckAuth, ghCheckRepo } from '@/background/github-api';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

describe('github-api', () => {
  it('ghCreateIssue returns ok on 201', async () => {
    (fetch as any).mockResolvedValue(new Response(
      JSON.stringify({ number: 7, html_url: 'https://github.com/o/r/issues/7' }),
      { status: 201, headers: { 'content-type': 'application/json' } }
    ));
    const result = await ghCreateIssue('token', 'o/r', 'T', 'B');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.number).toBe(7);
      expect(result.htmlUrl).toContain('/issues/7');
    }
  });

  it('ghCreateIssue maps 401 to auth', async () => {
    (fetch as any).mockResolvedValue(new Response('', { status: 401 }));
    const result = await ghCreateIssue('t', 'o/r', 'T', 'B');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('auth');
  });

  it('ghCheckAuth returns 200', async () => {
    (fetch as any).mockResolvedValue(new Response('{"login":"u"}', { status: 200 }));
    const result = await ghCheckAuth('t');
    expect(result.status).toBe(200);
  });
});
```

- [ ] **Step 25.2 — Run test (fail)**

- [ ] **Step 25.3 — Implement `src/background/github-api.ts`**

```ts
import type { IssueSubmitResult } from '@/shared/types';
import { GITHUB_API_BASE, GITHUB_API_VERSION, TIMEOUT_ISSUE_SUBMIT, TIMEOUT_TOKEN_TEST }
  from '@/shared/constants';
import { mapHttpToErrorCode, parseRetryAfter } from '@/lib/http-errors';

function authHeaders(token: string): HeadersInit {
  return {
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };
}

export async function ghCreateIssue(
  token: string, repo: string, title: string, body: string,
): Promise<IssueSubmitResult> {
  const url = `${GITHUB_API_BASE}/repos/${repo}/issues`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body }),
      signal: AbortSignal.timeout(TIMEOUT_ISSUE_SUBMIT),
    });
  } catch (err) {
    return { ok: false, code: 'network', message: String(err) };
  }
  if (res.status === 201) {
    const j = await res.json();
    return { ok: true, number: j.number, htmlUrl: j.html_url };
  }
  const code = mapHttpToErrorCode(res.status, res.headers);
  const retryAfter = code === 'rate_limit' ? parseRetryAfter(res.headers, Date.now()) : undefined;
  const text = await res.text().catch(() => '');
  return { ok: false, code, message: text.slice(0, 200), retryAfter };
}

export async function ghCheckAuth(token: string): Promise<{ status: number }> {
  try {
    const res = await fetch(`${GITHUB_API_BASE}/user`, {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(TIMEOUT_TOKEN_TEST),
    });
    return { status: res.status };
  } catch {
    return { status: 0 };
  }
}

export async function ghCheckRepo(token: string, repo: string): Promise<{ status: number }> {
  try {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${repo}`, {
      headers: authHeaders(token),
      signal: AbortSignal.timeout(TIMEOUT_TOKEN_TEST),
    });
    return { status: res.status };
  } catch {
    return { status: 0 };
  }
}
```

- [ ] **Step 25.4 — Run tests (pass)**

- [ ] **Step 25.5 — Commit**

```bash
git add .
git commit -m "GitHub API wrapper (create issue + auth/repo checks)"
```

---

### Task 26: Token test handler

**Files:**
- Create: `src/background/token-test.ts`, `tests/integration/token-test.test.ts`

- [ ] **Step 26.1 — Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import chrome from 'sinon-chrome';
import { handleTokenTest } from '@/background/token-test';

beforeEach(() => {
  chrome.flush();
  vi.stubGlobal('fetch', vi.fn());
});

describe('handleTokenTest', () => {
  it('returns ok when both checks pass', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [{
        id: 'a', name: 'A', urlPatterns: ['x.com'], repo: 'o/r',
        token: 't', lastVerifiedAt: null, createdAt: 0,
      }]},
    });
    chrome.storage.local.set.resolves();
    (fetch as any).mockResolvedValueOnce(new Response('{"login":"u"}', { status: 200 }));
    (fetch as any).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    const result = await handleTokenTest('a');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.repo).toBe('o/r');
  });

  it('returns auth failure on 401', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [{
        id: 'a', name: 'A', urlPatterns: ['x.com'], repo: 'o/r',
        token: 't', lastVerifiedAt: null, createdAt: 0,
      }]},
    });
    (fetch as any).mockResolvedValueOnce(new Response('', { status: 401 }));
    const result = await handleTokenTest('a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.step).toBe('auth');
  });

  it('returns repo failure on 404', async () => {
    chrome.storage.local.get.resolves({
      qaExt: { schemaVersion: 1, mappings: [{
        id: 'a', name: 'A', urlPatterns: ['x.com'], repo: 'o/r',
        token: 't', lastVerifiedAt: null, createdAt: 0,
      }]},
    });
    (fetch as any).mockResolvedValueOnce(new Response('{"login":"u"}', { status: 200 }));
    (fetch as any).mockResolvedValueOnce(new Response('', { status: 404 }));
    const result = await handleTokenTest('a');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.step).toBe('repo');
  });
});
```

- [ ] **Step 26.2 — Run test (fail)**

- [ ] **Step 26.3 — Implement `src/background/token-test.ts`**

```ts
import type { TokenTestResult } from '@/shared/types';
import { ghCheckAuth, ghCheckRepo } from './github-api';
import { getMapping, touchVerified } from './mapping-store';

export async function handleTokenTest(mappingId: string): Promise<TokenTestResult> {
  const m = await getMapping(mappingId);
  if (!m) {
    return { ok: false, step: 'auth', status: 0, message: '매핑을 찾을 수 없어요' };
  }
  const auth = await ghCheckAuth(m.token);
  if (auth.status !== 200) {
    return { ok: false, step: 'auth', status: auth.status,
             message: auth.status === 0 ? '네트워크 오류' : `인증 실패 (HTTP ${auth.status})` };
  }
  const repo = await ghCheckRepo(m.token, m.repo);
  if (repo.status !== 200) {
    return { ok: false, step: 'repo', status: repo.status,
             message: repo.status === 0 ? '네트워크 오류' : `레포 접근 불가 (HTTP ${repo.status})` };
  }
  const now = Date.now();
  await touchVerified(mappingId, now);
  return { ok: true, repo: m.repo, verifiedAt: now };
}
```

- [ ] **Step 26.4 — Run tests (pass)**

- [ ] **Step 26.5 — Commit**

```bash
git add .
git commit -m "토큰 테스트 핸들러 (2단계: 인증 + 레포)"
```

---

### Task 27: Issue submit handler with throttle queue

**Files:**
- Create: `src/background/issue-submit.ts`, `tests/integration/issue-submit.test.ts`

- [ ] **Step 27.1 — Write failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import chrome from 'sinon-chrome';
import { handleIssueSubmit, _resetThrottle } from '@/background/issue-submit';
import type { IssueDraft } from '@/shared/types';

const mkDraft = (mappingId: string, finalBody = 'body'): IssueDraft => ({
  mappingId, title: 'T', userDescription: 'U', collected: {} as any,
  finalBody, bodyOverridden: false,
});

beforeEach(() => {
  chrome.flush();
  vi.stubGlobal('fetch', vi.fn());
  _resetThrottle();
  chrome.storage.local.get.resolves({
    qaExt: { schemaVersion: 1, mappings: [{
      id: 'a', name: 'A', urlPatterns: ['x.com'], repo: 'o/r',
      token: 't', lastVerifiedAt: null, createdAt: 0,
    }]},
  });
});

describe('handleIssueSubmit', () => {
  it('returns ok on 201', async () => {
    (fetch as any).mockResolvedValue(new Response(
      JSON.stringify({ number: 5, html_url: 'https://github.com/o/r/issues/5' }),
      { status: 201 }
    ));
    const result = await handleIssueSubmit(mkDraft('a'));
    expect(result.ok).toBe(true);
  });

  it('returns error when mapping not found', async () => {
    const result = await handleIssueSubmit(mkDraft('missing'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('not_found');
  });

  it('returns auth error on 401', async () => {
    (fetch as any).mockResolvedValue(new Response('', { status: 401 }));
    const result = await handleIssueSubmit(mkDraft('a'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('auth');
  });
});
```

- [ ] **Step 27.2 — Run test (fail)**

- [ ] **Step 27.3 — Implement `src/background/issue-submit.ts`**

```ts
import type { IssueDraft, IssueSubmitResult } from '@/shared/types';
import { ghCreateIssue } from './github-api';
import { getMapping } from './mapping-store';
import { SUBMIT_THROTTLE_MS } from '@/shared/constants';

let lastSubmitAt = 0;
const queue: (() => void)[] = [];
let processing = false;

export function _resetThrottle() { lastSubmitAt = 0; queue.length = 0; processing = false; }

async function waitTurn(): Promise<void> {
  return new Promise(resolve => {
    queue.push(resolve);
    if (!processing) drain();
  });
}

async function drain(): Promise<void> {
  processing = true;
  while (queue.length > 0) {
    const next = queue.shift()!;
    const wait = Math.max(0, lastSubmitAt + SUBMIT_THROTTLE_MS - Date.now());
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastSubmitAt = Date.now();
    next();
  }
  processing = false;
}

export async function handleIssueSubmit(draft: IssueDraft): Promise<IssueSubmitResult> {
  const m = await getMapping(draft.mappingId);
  if (!m) {
    return { ok: false, code: 'not_found', message: '매핑을 찾을 수 없어요' };
  }
  await waitTurn();
  return ghCreateIssue(m.token, m.repo, draft.title, draft.finalBody);
}
```

- [ ] **Step 27.4 — Run tests (pass)**

- [ ] **Step 27.5 — Commit**

```bash
git add .
git commit -m "이슈 등록 핸들러 + 1초 throttle 큐"
```

---

### Task 28: Wire up background router & build smoke

**Files:**
- Already created in Task 22 + 23

- [ ] **Step 28.1 — Build**

```bash
npm run build
```
Expected: success, no TS errors.

- [ ] **Step 28.2 — Manual smoke**

1. Reload extension in `chrome://extensions`
2. Inspect service worker — should boot without errors
3. Click extension icon on any URL — side panel opens with placeholder

- [ ] **Step 28.3 — Commit**

```bash
git add .
git commit -m "background 라우터 통합 + 빌드 검증"
```

---


## Phase 7: Side Panel UI

### Task 29: Panel store (Zustand state machine)

**Files:**
- Create: `src/panel/store.ts`, `tests/unit/panel-store.test.ts`

- [ ] **Step 29.1 — Write failing tests**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { usePanelStore } from '@/panel/store';

beforeEach(() => {
  usePanelStore.setState(usePanelStore.getInitialState(), true);
});

describe('panel store', () => {
  it('starts in BOOTSTRAP', () => {
    expect(usePanelStore.getState().screen).toBe('BOOTSTRAP');
  });

  it('transitions BOOTSTRAP → MATCHED.IDLE on bootstrap with match', () => {
    usePanelStore.getState().onBootstrap({
      activeMappingId: 'a', allCandidates: ['a'], tabId: 1, url: 'https://x.com', hostOnly: 'x.com',
    });
    const s = usePanelStore.getState();
    expect(s.screen).toBe('MATCHED.IDLE');
    expect(s.activeMappingId).toBe('a');
  });

  it('transitions to NO_MATCH when no mapping', () => {
    usePanelStore.getState().onBootstrap({
      activeMappingId: null, allCandidates: [], tabId: 1, url: 'https://x.com', hostOnly: 'x.com',
    });
    expect(usePanelStore.getState().screen).toBe('NO_MATCH');
  });

  it('enters PICK on startSelection', () => {
    usePanelStore.getState().onBootstrap({
      activeMappingId: 'a', allCandidates: ['a'], tabId: 1, url: 'https://x.com', hostOnly: 'x.com',
    });
    usePanelStore.getState().startSelection();
    expect(usePanelStore.getState().screen).toBe('MATCHED.PICK');
  });

  it('PICK → EDIT on selectionPicked', () => {
    usePanelStore.getState().onBootstrap({
      activeMappingId: 'a', allCandidates: ['a'], tabId: 1, url: 'https://x.com', hostOnly: 'x.com',
    });
    usePanelStore.getState().startSelection();
    usePanelStore.getState().onPicked({
      selector: '#x', outerHTML: '<div/>', parentChainSummary: ['div'], maxDepth: 0, currentDepth: 0,
    });
    expect(usePanelStore.getState().screen).toBe('MATCHED.EDIT');
  });

  it('resets form on successful submit', () => {
    const s = usePanelStore.getState();
    s.onBootstrap({ activeMappingId: 'a', allCandidates: ['a'], tabId: 1, url: '', hostOnly: '' });
    s.startSelection();
    s.onPicked({ selector: '#x', outerHTML: '<div/>', parentChainSummary: ['div'], maxDepth: 0, currentDepth: 0 });
    s.setTitle('T'); s.setUserDescription('D');
    s.onSubmitSuccess({ ok: true, number: 1, htmlUrl: 'https://x' });
    const after = usePanelStore.getState();
    expect(after.screen).toBe('MATCHED.IDLE');
    expect(after.title).toBe('');
    expect(after.userDescription).toBe('');
  });

  it('preserves form on submit failure', () => {
    const s = usePanelStore.getState();
    s.onBootstrap({ activeMappingId: 'a', allCandidates: ['a'], tabId: 1, url: '', hostOnly: '' });
    s.startSelection();
    s.onPicked({ selector: '#x', outerHTML: '<div/>', parentChainSummary: ['div'], maxDepth: 0, currentDepth: 0 });
    s.setTitle('T'); s.setUserDescription('D');
    s.onSubmitFailure({ ok: false, code: 'auth', message: 'oops' });
    const after = usePanelStore.getState();
    expect(after.screen).toBe('MATCHED.EDIT');
    expect(after.title).toBe('T');
    expect(after.lastError?.code).toBe('auth');
  });

  it('TAB_GONE transition from any state', () => {
    usePanelStore.getState().onTabGone();
    expect(usePanelStore.getState().screen).toBe('TAB_GONE');
  });
});
```

- [ ] **Step 29.2 — Run tests (fail)**

- [ ] **Step 29.3 — Implement `src/panel/store.ts`**

```ts
import { create } from 'zustand';
import type { BootstrapResponse, PickedElement, CapturedSnapshot,
              IssueSubmitResult, ErrorCode } from '@/shared/types';

type Screen = 'BOOTSTRAP' | 'NO_MATCH' | 'MATCHED.IDLE' | 'MATCHED.PICK'
            | 'MATCHED.EDIT' | 'SUBMIT' | 'TAB_GONE';

interface PanelState {
  screen: Screen;
  tabId: number | null;
  url: string;
  hostOnly: string;
  activeMappingId: string | null;
  allCandidates: string[];

  // selection
  picked: PickedElement | null;
  currentDepth: number;

  // form
  title: string;
  userDescription: string;
  finalBody: string;
  bodyOverridden: boolean;
  collected: { ua?: any; viewport?: any; consoleErrors?: any[]; networkFailures?: any[] } | null;

  // status
  lastError: { code: ErrorCode; message: string; retryAfter?: number } | null;
  lastSuccess: { number: number; htmlUrl: string } | null;
}

interface PanelActions {
  onBootstrap(r: BootstrapResponse): void;
  startSelection(): void;
  cancelSelection(): void;
  onPicked(p: PickedElement): void;
  onUpdated(p: PickedElement): void;
  setDepth(d: number): void;
  setTitle(t: string): void;
  setUserDescription(d: string): void;
  setFinalBody(b: string): void;
  enterBodyOverride(): void;
  startSubmit(): void;
  onSubmitSuccess(r: IssueSubmitResult & { ok: true }): void;
  onSubmitFailure(r: IssueSubmitResult & { ok: false }): void;
  dismissToast(): void;
  changeMapping(id: string): void;
  onTabGone(): void;
  resetForm(): void;
}

const initial: PanelState = {
  screen: 'BOOTSTRAP', tabId: null, url: '', hostOnly: '',
  activeMappingId: null, allCandidates: [],
  picked: null, currentDepth: 0,
  title: '', userDescription: '', finalBody: '', bodyOverridden: false, collected: null,
  lastError: null, lastSuccess: null,
};

export const usePanelStore = create<PanelState & PanelActions>((set, get) => ({
  ...initial,
  onBootstrap(r) {
    set({
      tabId: r.tabId, url: r.url, hostOnly: r.hostOnly,
      activeMappingId: r.activeMappingId, allCandidates: r.allCandidates,
      screen: r.activeMappingId ? 'MATCHED.IDLE' : 'NO_MATCH',
    });
  },
  startSelection() { set({ screen: 'MATCHED.PICK', picked: null }); },
  cancelSelection() { set({ screen: 'MATCHED.IDLE' }); },
  onPicked(p) { set({ picked: p, currentDepth: p.currentDepth, screen: 'MATCHED.EDIT' }); },
  onUpdated(p) { set({ picked: p, currentDepth: p.currentDepth }); },
  setDepth(d) { set({ currentDepth: d }); },
  setTitle(t) { set({ title: t }); },
  setUserDescription(d) { set({ userDescription: d }); },
  setFinalBody(b) { set({ finalBody: b }); },
  enterBodyOverride() { set({ bodyOverridden: true }); },
  startSubmit() { set({ screen: 'SUBMIT', lastError: null }); },
  onSubmitSuccess(r) {
    set({
      screen: 'MATCHED.IDLE',
      title: '', userDescription: '', finalBody: '', bodyOverridden: false,
      picked: null, currentDepth: 0, collected: null,
      lastSuccess: { number: r.number, htmlUrl: r.htmlUrl }, lastError: null,
    });
  },
  onSubmitFailure(r) {
    set({ screen: 'MATCHED.EDIT', lastError: r });
  },
  dismissToast() { set({ lastSuccess: null }); },
  changeMapping(id) { set({ activeMappingId: id }); },
  onTabGone() { set({ screen: 'TAB_GONE' }); },
  resetForm() {
    set({
      title: '', userDescription: '', finalBody: '', bodyOverridden: false,
      picked: null, currentDepth: 0, collected: null, lastError: null,
    });
  },
}));
```

- [ ] **Step 29.4 — Run tests (pass)**

- [ ] **Step 29.5 — Commit**

```bash
git add .
git commit -m "Panel Zustand 스토어 + 상태 머신"
```

---

### Task 30: Messaging hook + bootstrap on mount

**Files:**
- Create: `src/panel/hooks/useMessaging.ts`, `src/panel/hooks/useBootstrap.ts`

- [ ] **Step 30.1 — Create `src/panel/hooks/useMessaging.ts`**

```ts
import { useEffect } from 'react';
import { usePanelStore } from '../store';
import type { BgToPanel, ContentToPanel } from '@/shared/types';

export function useMessaging(): void {
  const store = usePanelStore.getState;

  useEffect(() => {
    const listener = (msg: BgToPanel) => {
      if (msg.kind === 'tab.gone') {
        store().onTabGone();
        return;
      }
      if (msg.kind === 'content.relay') {
        const inner = msg.payload as ContentToPanel;
        if (inner.kind === 'selection.picked') store().onPicked(inner.payload);
        if (inner.kind === 'selection.updated') store().onUpdated(inner.payload);
        if (inner.kind === 'selection.cancelled') store().cancelSelection();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
}

export async function sendToBg<T = unknown>(msg: unknown): Promise<T> {
  return chrome.runtime.sendMessage(msg);
}

export async function sendToContent(msg: unknown): Promise<unknown> {
  return chrome.runtime.sendMessage({ kind: 'forward.toContent', payload: msg });
}
```

- [ ] **Step 30.2 — Create `src/panel/hooks/useBootstrap.ts`**

```ts
import { useEffect } from 'react';
import { usePanelStore } from '../store';
import { sendToBg } from './useMessaging';
import type { BootstrapResponse } from '@/shared/types';

export function useBootstrap(): void {
  useEffect(() => {
    sendToBg<{ ok: boolean; payload?: BootstrapResponse }>({ kind: 'panel.bootstrap' })
      .then((res) => {
        if (res.ok && res.payload) usePanelStore.getState().onBootstrap(res.payload);
      })
      .catch(() => {});
  }, []);
}
```

- [ ] **Step 30.3 — Commit**

```bash
git add .
git commit -m "Panel 메시징 + bootstrap 훅"
```

---

### Task 31: Panel components — header & bindings

**Files:**
- Create: `src/panel/components/TabBindingBar.tsx`, `src/panel/components/MappingHeader.tsx`

- [ ] **Step 31.1 — `TabBindingBar.tsx`**

```tsx
import { usePanelStore } from '../store';
import { sendToBg } from '../hooks/useMessaging';

export function TabBindingBar() {
  const { screen, url, tabId } = usePanelStore();
  if (screen === 'BOOTSTRAP') return null;
  if (screen === 'TAB_GONE') {
    return (
      <div className="bar bar-warn">
        ⚠️ 원래 탭이 닫혔습니다 — 입력 내용 보존됨
        <button onClick={() => sendToBg({ kind: 'tab.rebind' })}>현재 탭으로 전환</button>
      </div>
    );
  }
  return (
    <div className="bar">
      🔗 <span className="url-clip">{url}</span> (탭 #{tabId})
    </div>
  );
}
```

- [ ] **Step 31.2 — `MappingHeader.tsx`**

```tsx
import { usePanelStore } from '../store';

export function MappingHeader() {
  const { activeMappingId, allCandidates, screen, changeMapping } = usePanelStore();
  if (screen === 'BOOTSTRAP' || screen === 'NO_MATCH' || screen === 'TAB_GONE') return null;
  if (!activeMappingId) return null;
  return (
    <div className="mapping-header">
      <strong>📌 {activeMappingId}</strong>
      {allCandidates.length > 1 && (
        <select value={activeMappingId} onChange={(e) => changeMapping(e.target.value)}>
          {allCandidates.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      )}
    </div>
  );
}
```

> Note: `allCandidates` carries mapping IDs only. Look up names from another store slice if needed; for MVP the ID is shown.

- [ ] **Step 31.3 — Commit**

```bash
git add .
git commit -m "Panel TabBindingBar + MappingHeader"
```

---

### Task 32: Panel components — NoMatchPrompt

**Files:**
- Create: `src/panel/components/NoMatchPrompt.tsx`

- [ ] **Step 32.1 — Implement**

```tsx
import { usePanelStore } from '../store';

export function NoMatchPrompt() {
  const { screen, hostOnly } = usePanelStore();
  if (screen !== 'NO_MATCH') return null;
  const openOptions = (prefill: boolean) => {
    const q = prefill ? `?prefillHost=${encodeURIComponent(hostOnly)}` : '';
    chrome.runtime.openOptionsPage();
    // Note: openOptionsPage doesn't pass URL params; prefill happens via storage-or-message instead.
    // For MVP we set a sessionStorage key that Options page reads on mount.
    if (prefill) chrome.storage.session.set?.({ prefillHost: hostOnly });
  };
  return (
    <div className="no-match">
      <div className="icon">📭</div>
      <p>이 URL에 등록된 레포가 없습니다</p>
      <button className="primary" onClick={() => openOptions(true)}>
        ➕ 현재 도메인으로 매핑 추가 ({hostOnly})
      </button>
      <button onClick={() => openOptions(false)}>⚙️ 설정 열기</button>
    </div>
  );
}
```

- [ ] **Step 32.2 — Commit**

```bash
git add .
git commit -m "Panel NoMatchPrompt + 옵션 페이지 prefill"
```

---

### Task 33: Panel components — SelectionPanel + DepthSlider

**Files:**
- Create: `src/panel/components/SelectionPanel.tsx`

- [ ] **Step 33.1 — Implement**

```tsx
import { usePanelStore } from '../store';
import { sendToContent } from '../hooks/useMessaging';

export function SelectionPanel() {
  const { screen, picked, currentDepth, setDepth } = usePanelStore();
  if (screen === 'BOOTSTRAP' || screen === 'NO_MATCH' || screen === 'TAB_GONE') return null;

  const onPickClick = () => {
    if (screen === 'MATCHED.PICK') {
      sendToContent({ kind: 'selection.cancel' });
      usePanelStore.getState().cancelSelection();
    } else {
      sendToContent({ kind: 'selection.start' });
      usePanelStore.getState().startSelection();
    }
  };

  const onDepthChange = (d: number) => {
    setDepth(d);
    sendToContent({ kind: 'selection.depthChange', depth: d });
  };

  return (
    <div className="selection-panel">
      <button className="pick" onClick={onPickClick}>
        {screen === 'MATCHED.PICK' ? '선택 취소 (ESC)' : '🎯 Element 선택'}
      </button>
      {screen === 'MATCHED.EDIT' && picked && (
        <div className="slider-row">
          <label>선택 범위:</label>
          <button onClick={() => onDepthChange(Math.max(0, currentDepth - 1))}>◀</button>
          <input
            type="range"
            min={0}
            max={picked.maxDepth}
            value={currentDepth}
            onChange={(e) => onDepthChange(parseInt(e.target.value, 10))}
          />
          <button onClick={() => onDepthChange(Math.min(picked.maxDepth, currentDepth + 1))}>▶</button>
          <span className="depth-label" title={picked.parentChainSummary[currentDepth]}>
            {picked.parentChainSummary[currentDepth] ?? '?'}
          </span>
        </div>
      )}
      {picked && (
        <div className="selector-preview" title={picked.selector}>
          <code>{picked.selector}</code>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 33.2 — Commit**

```bash
git add .
git commit -m "Panel SelectionPanel + DepthSlider"
```

---

### Task 34: Panel components — IssueForm + BodyEditor + SubmitBar

**Files:**
- Create: `src/panel/components/IssueForm.tsx`

- [ ] **Step 34.1 — Implement**

```tsx
import { useEffect, useMemo } from 'react';
import { usePanelStore } from '../store';
import { sendToBg, sendToContent } from '../hooks/useMessaging';
import { formatIssueBody, applyBodyBudget } from '@/lib/format-body';
import { BODY_BUDGET, BODY_WARN_THRESHOLD } from '@/shared/constants';
import type { IssueDraft, IssueSubmitResult } from '@/shared/types';

export function IssueForm() {
  const s = usePanelStore();
  if (s.screen !== 'MATCHED.EDIT' && s.screen !== 'SUBMIT') return null;

  // Refresh collected snapshot whenever we enter EDIT
  useEffect(() => {
    if (!s.picked) return;
    sendToContent({ kind: 'capture.snapshot' }).then((res: any) => {
      if (res?.ok && res.payload?.kind === 'capture.snapshot.result') {
        usePanelStore.setState({ collected: res.payload.payload });
      }
    });
  }, [s.picked?.selector]);

  const finalBody = useMemo(() => {
    if (s.bodyOverridden) return s.finalBody;
    if (!s.picked || !s.collected) return '';
    const collected = {
      ...s.collected,
      selectedDepth: s.currentDepth,
      selector: s.picked.selector,
      parentChainSummary: s.picked.parentChainSummary,
      outerHTML: s.picked.outerHTML,
    } as any;
    return applyBodyBudget(formatIssueBody(s.userDescription, collected));
  }, [s.userDescription, s.collected, s.picked, s.currentDepth, s.bodyOverridden, s.finalBody]);

  useEffect(() => {
    if (!s.bodyOverridden) usePanelStore.setState({ finalBody });
  }, [finalBody, s.bodyOverridden]);

  const onSubmit = async () => {
    if (!s.activeMappingId || !s.picked || !s.collected) return;
    if (!s.title.trim() || !s.userDescription.trim()) return;
    usePanelStore.getState().startSubmit();
    const draft: IssueDraft = {
      mappingId: s.activeMappingId,
      title: s.title,
      userDescription: s.userDescription,
      collected: {
        ...s.collected,
        selectedDepth: s.currentDepth,
        selector: s.picked.selector,
        parentChainSummary: s.picked.parentChainSummary,
        outerHTML: s.picked.outerHTML,
      } as any,
      finalBody: s.finalBody,
      bodyOverridden: s.bodyOverridden,
    };
    const result = await sendToBg<IssueSubmitResult>({ kind: 'issue.submit', payload: draft });
    if (result.ok) usePanelStore.getState().onSubmitSuccess(result);
    else usePanelStore.getState().onSubmitFailure(result);
  };

  const size = (s.finalBody ?? '').length;
  const sizeClass = size > BODY_BUDGET ? 'red' : (size > BODY_WARN_THRESHOLD ? 'yellow' : '');

  return (
    <>
      <input
        className="title-input"
        placeholder="제목 (예: 카드 배경색 깨짐)"
        value={s.title}
        maxLength={80}
        onChange={(e) => s.setTitle(e.target.value)}
      />
      <textarea
        className="desc-textarea"
        placeholder="어떻게 깨졌나요? 무슨 동작을 했을 때 발생했나요?"
        value={s.userDescription}
        rows={4}
        onChange={(e) => s.setUserDescription(e.target.value)}
      />

      <div className="collected-summary">
        ✓ 콘솔 {s.collected?.consoleErrors?.length ?? 0} ·
        ✓ 네트워크 {s.collected?.networkFailures?.length ?? 0} ·
        ✓ HTML {(s.picked?.outerHTML?.length ?? 0)}자
      </div>

      <details
        open={s.bodyOverridden}
        onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) s.enterBodyOverride(); }}
      >
        <summary>📝 본문 편집</summary>
        {s.bodyOverridden && (
          <p className="hint">직접 편집하면 자동 정보가 다시 갱신되지 않아요</p>
        )}
        <textarea
          className="body-editor"
          value={s.bodyOverridden ? s.finalBody : finalBody}
          rows={12}
          onChange={(e) => { s.enterBodyOverride(); s.setFinalBody(e.target.value); }}
        />
      </details>

      <div className="submit-bar">
        <span className={`size ${sizeClass}`}>{size.toLocaleString()} / {BODY_BUDGET.toLocaleString()}자</span>
        <button
          className="submit"
          disabled={s.screen === 'SUBMIT' || !s.title.trim() || !s.userDescription.trim()}
          onClick={onSubmit}
        >
          {s.screen === 'SUBMIT' ? '⏳ 등록 중...' : 'GitHub에 등록 →'}
        </button>
      </div>
    </>
  );
}
```

- [ ] **Step 34.2 — Commit**

```bash
git add .
git commit -m "Panel IssueForm + BodyEditor + SubmitBar"
```

---

### Task 35: Panel components — Toast + InlineError

**Files:**
- Create: `src/panel/components/Toast.tsx`, `src/panel/components/InlineError.tsx`

- [ ] **Step 35.1 — `Toast.tsx`**

```tsx
import { useEffect } from 'react';
import { usePanelStore } from '../store';

export function Toast() {
  const { lastSuccess, dismissToast } = usePanelStore();
  useEffect(() => {
    if (!lastSuccess) return;
    const id = setTimeout(dismissToast, 5_000);
    return () => clearTimeout(id);
  }, [lastSuccess]);
  if (!lastSuccess) return null;
  return (
    <div className="toast toast-success">
      ✅ 이슈 #{lastSuccess.number} 등록됨
      <a href={lastSuccess.htmlUrl} target="_blank" rel="noreferrer">[ 보기 → ]</a>
      <button onClick={dismissToast}>✕</button>
    </div>
  );
}
```

- [ ] **Step 35.2 — `InlineError.tsx`**

```tsx
import { usePanelStore } from '../store';

const MESSAGES: Record<string, string> = {
  auth: '토큰이 만료되었거나 잘못되었어요',
  forbidden: 'Issues 쓰기 권한이 없어요. fine-grained PAT 의 "Issues: Write" 권한을 확인하세요',
  rate_limit: 'GitHub API 사용량 초과',
  not_found: '레포를 찾을 수 없어요. 매핑의 레포 경로를 확인하세요',
  validation: '이슈 형식이 잘못되었어요. 제목/본문을 확인하세요.',
  network: '네트워크 연결 실패',
  unknown: '알 수 없는 오류',
};

export function InlineError() {
  const { lastError } = usePanelStore();
  if (!lastError) return null;
  const msg = MESSAGES[lastError.code] ?? lastError.message;
  const retry = lastError.retryAfter
    ? ` (약 ${Math.ceil(lastError.retryAfter / 60)}분 후 재시도 가능)` : '';
  return (
    <div className="inline-error">
      ⚠️ {msg}{retry}
      {(lastError.code === 'auth' || lastError.code === 'forbidden' || lastError.code === 'not_found') && (
        <button onClick={() => chrome.runtime.openOptionsPage()}>설정 열기</button>
      )}
    </div>
  );
}
```

- [ ] **Step 35.3 — Commit**

```bash
git add .
git commit -m "Panel Toast + InlineError 컴포넌트"
```

---

### Task 36: Panel App + styling

**Files:**
- Modify: `src/panel/main.tsx`
- Create: `src/panel/App.tsx`, `src/panel/styles.css`

- [ ] **Step 36.1 — Create `src/panel/App.tsx`**

```tsx
import { useBootstrap } from './hooks/useBootstrap';
import { useMessaging } from './hooks/useMessaging';
import { TabBindingBar } from './components/TabBindingBar';
import { MappingHeader } from './components/MappingHeader';
import { NoMatchPrompt } from './components/NoMatchPrompt';
import { SelectionPanel } from './components/SelectionPanel';
import { IssueForm } from './components/IssueForm';
import { Toast } from './components/Toast';
import { InlineError } from './components/InlineError';

export function App() {
  useBootstrap();
  useMessaging();
  return (
    <div className="panel-root">
      <TabBindingBar />
      <MappingHeader />
      <NoMatchPrompt />
      <SelectionPanel />
      <InlineError />
      <IssueForm />
      <Toast />
    </div>
  );
}
```

- [ ] **Step 36.2 — `src/panel/styles.css`**

```css
:root {
  --fg: #1f2937;
  --muted: #6b7280;
  --bg: #ffffff;
  --border: #e5e7eb;
  --primary: #5b8def;
  --danger: #e74c3c;
  --warn: #f39c12;
  --success: #16a085;
}

* { box-sizing: border-box; }

body { margin: 0; font: 13px/1.5 -apple-system, BlinkMacSystemFont, sans-serif; color: var(--fg); }

.panel-root { padding: 12px; }

.bar { font-size: 11px; color: var(--muted); padding: 6px 8px; border-bottom: 1px solid var(--border); }
.bar-warn { background: #fdf3f1; color: var(--danger); }
.url-clip { display: inline-block; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }

.mapping-header { padding: 10px 4px; font-size: 13px; }

.no-match { text-align: center; padding: 24px 8px; }
.no-match .icon { font-size: 32px; }
.no-match button { display: block; margin: 8px auto; padding: 8px 12px; border: 1px solid var(--border); background: #fff; border-radius: 6px; cursor: pointer; }
.no-match button.primary { background: var(--primary); color: #fff; border-color: var(--primary); }

.selection-panel { padding: 8px 0; }
.selection-panel .pick { width: 100%; padding: 10px; background: var(--primary); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
.slider-row { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
.slider-row input[type=range] { flex: 1; }
.depth-label { font-size: 11px; color: var(--muted); white-space: nowrap; max-width: 120px; overflow: hidden; text-overflow: ellipsis; }
.selector-preview { font-size: 11px; color: var(--muted); margin-top: 6px; padding: 6px 8px; background: #f9fafb; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.title-input, .desc-textarea, .body-editor {
  width: 100%; padding: 8px 10px; border: 1px solid var(--border); border-radius: 4px;
  font: inherit; margin-top: 8px;
}
.body-editor { font-family: ui-monospace, Menlo, monospace; font-size: 11px; }

.collected-summary { font-size: 11px; color: var(--muted); padding: 8px 0; }
.hint { font-size: 10px; color: var(--warn); margin: 4px 0; }

.submit-bar { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-top: 1px solid var(--border); margin-top: 12px; }
.size.yellow { color: var(--warn); }
.size.red { color: var(--danger); }
.submit { padding: 10px 16px; background: var(--primary); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }
.submit:disabled { opacity: 0.5; cursor: not-allowed; }

.toast { position: fixed; bottom: 12px; left: 12px; right: 12px; background: #fff; border-left: 4px solid var(--success); padding: 10px 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); border-radius: 4px; display: flex; gap: 10px; align-items: center; font-size: 12px; }
.toast a { color: var(--primary); text-decoration: none; }
.toast button { margin-left: auto; border: none; background: transparent; cursor: pointer; color: var(--muted); }

.inline-error { background: #fdf3f1; color: var(--danger); padding: 10px; border-radius: 4px; margin-top: 8px; font-size: 12px; }
.inline-error button { margin-left: 8px; padding: 3px 8px; border: 1px solid currentColor; background: transparent; color: var(--danger); border-radius: 3px; cursor: pointer; font-size: 11px; }
```

- [ ] **Step 36.3 — `src/panel/main.tsx`**

```tsx
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(<App />);
```

- [ ] **Step 36.4 — Build + manual smoke**

```bash
npm run build
```

Reload extension. Click icon. Verify:
1. Panel boots, shows NO_MATCH (no mappings yet)
2. "현재 도메인 매핑 추가" opens options page

- [ ] **Step 36.5 — Commit**

```bash
git add .
git commit -m "Panel App + 스타일 통합"
```

---


## Phase 8: Options Page

### Task 37: Options store

**Files:**
- Create: `src/options/store.ts`

- [ ] **Step 37.1 — Implement**

```ts
import { create } from 'zustand';
import type { Mapping } from '@/shared/types';

interface OptionsState {
  mappings: Mapping[];
  dirty: Record<string, boolean>; // mapping id → unsaved?
  prefillHost: string | null;
  testResults: Record<string, { ok: boolean; message: string; at: number }>;
}

interface OptionsActions {
  load(): Promise<void>;
  upsertLocal(m: Mapping): void;
  markDirty(id: string, dirty: boolean): void;
  removeLocal(id: string): void;
  setTestResult(id: string, r: { ok: boolean; message: string }): void;
  setPrefillHost(h: string | null): void;
}

export const useOptionsStore = create<OptionsState & OptionsActions>((set, get) => ({
  mappings: [],
  dirty: {},
  prefillHost: null,
  testResults: {},

  async load() {
    const res = await chrome.runtime.sendMessage({ kind: 'panel.bootstrap' }).catch(() => null);
    // Re-using bootstrap is wasteful; use storage directly via dedicated message
    const raw = await chrome.storage.local.get('qaExt');
    const schema = raw?.qaExt;
    const mappings: Mapping[] = (schema && schema.schemaVersion === 1) ? schema.mappings : [];
    const prefillRaw = await (chrome.storage as any).session?.get('prefillHost').catch(() => ({})) ?? {};
    set({ mappings, prefillHost: prefillRaw.prefillHost ?? null });
    if (prefillRaw.prefillHost) (chrome.storage as any).session?.remove('prefillHost');
  },

  upsertLocal(m) {
    const list = [...get().mappings];
    const idx = list.findIndex(x => x.id === m.id);
    if (idx >= 0) list[idx] = m; else list.push(m);
    set({ mappings: list });
  },

  markDirty(id, dirty) {
    const d = { ...get().dirty };
    if (dirty) d[id] = true; else delete d[id];
    set({ dirty: d });
  },

  removeLocal(id) {
    set({ mappings: get().mappings.filter(m => m.id !== id) });
  },

  setTestResult(id, r) {
    set({ testResults: { ...get().testResults, [id]: { ...r, at: Date.now() } } });
  },

  setPrefillHost(h) { set({ prefillHost: h }); },
}));
```

- [ ] **Step 37.2 — Commit**

```bash
git add .
git commit -m "Options Zustand 스토어"
```

---

### Task 38: Options components — MappingRow

**Files:**
- Create: `src/options/components/MappingRow.tsx`

- [ ] **Step 38.1 — Implement**

```tsx
import { useState } from 'react';
import type { Mapping } from '@/shared/types';
import { useOptionsStore } from '../store';

interface Props { mapping: Mapping; }

export function MappingRow({ mapping }: Props) {
  const [draft, setDraft] = useState<Mapping>(mapping);
  const [showToken, setShowToken] = useState(false);
  const { dirty, testResults, markDirty, removeLocal, setTestResult, upsertLocal } = useOptionsStore();

  const isDirty = !!dirty[mapping.id];
  const tr = testResults[mapping.id];

  const update = <K extends keyof Mapping>(key: K, value: Mapping[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    markDirty(mapping.id, true);
  };

  const onSave = async () => {
    await chrome.runtime.sendMessage({ kind: 'mapping.save', mapping: draft });
    upsertLocal(draft);
    markDirty(mapping.id, false);
  };

  const onDelete = async () => {
    if (!confirm(`매핑 "${mapping.name}" 을 삭제할까요?`)) return;
    await chrome.runtime.sendMessage({ kind: 'mapping.delete', id: mapping.id });
    removeLocal(mapping.id);
  };

  const onTest = async () => {
    if (isDirty) { alert('먼저 저장해주세요'); return; }
    const result = await chrome.runtime.sendMessage({ kind: 'token.test', mappingId: mapping.id });
    if (result.ok) setTestResult(mapping.id, { ok: true, message: `✅ ${result.repo} 접근 가능` });
    else setTestResult(mapping.id, { ok: false, message: `❌ ${result.message} (step: ${result.step})` });
  };

  const useCurrentDomain = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      const host = new URL(tab.url).host;
      update('urlPatterns', [host]);
    }
  };

  return (
    <div className="mapping-row">
      <div className="row-header">
        <input className="name" value={draft.name} onChange={(e) => update('name', e.target.value)} placeholder="이름" />
        <div>
          <button onClick={onTest}>🔍 토큰 테스트</button>
          <button className="danger" onClick={onDelete}>삭제</button>
        </div>
      </div>

      <label>URL 패턴 (쉼표 구분)</label>
      <input value={draft.urlPatterns.join(', ')}
             onChange={(e) => update('urlPatterns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
      <button className="link" onClick={useCurrentDomain}>현재 도메인 사용</button>

      <label>레포 (owner/name)</label>
      <input value={draft.repo} onChange={(e) => update('repo', e.target.value)} />

      <label>토큰</label>
      <div className="token-row">
        <input type={showToken ? 'text' : 'password'} value={draft.token}
               onChange={(e) => update('token', e.target.value)} />
        <button onClick={() => setShowToken(!showToken)}>{showToken ? '숨기기' : '표시'}</button>
      </div>
      <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer">
        fine-grained PAT 발급 가이드 →
      </a>

      {tr && <div className={`test-result ${tr.ok ? 'ok' : 'err'}`}>{tr.message}</div>}
      {mapping.lastVerifiedAt && <div className="muted">마지막 검증: {new Date(mapping.lastVerifiedAt).toLocaleString()}</div>}

      <button className={`save ${isDirty ? 'dirty' : ''}`} disabled={!isDirty} onClick={onSave}>
        저장
      </button>
    </div>
  );
}
```

- [ ] **Step 38.2 — Commit**

```bash
git add .
git commit -m "Options MappingRow 컴포넌트"
```

---

### Task 39: Options App + prefill + ThreatModelNotice

**Files:**
- Create: `src/options/OptionsApp.tsx`, `src/options/styles.css`
- Modify: `src/options/main.tsx`

- [ ] **Step 39.1 — `OptionsApp.tsx`**

```tsx
import { useEffect } from 'react';
import { useOptionsStore } from './store';
import { MappingRow } from './components/MappingRow';
import type { Mapping } from '@/shared/types';

function newMapping(host?: string | null): Mapping {
  return {
    id: crypto.randomUUID(),
    name: host ?? '새 매핑',
    urlPatterns: host ? [host] : [],
    repo: '',
    token: '',
    lastVerifiedAt: null,
    createdAt: Date.now(),
  };
}

export function OptionsApp() {
  const { mappings, prefillHost, load, upsertLocal, markDirty, setPrefillHost } = useOptionsStore();

  useEffect(() => { load(); }, []);

  // Prefill: when load resolves with a prefillHost, immediately scaffold a new mapping row.
  useEffect(() => {
    if (prefillHost) {
      const m = newMapping(prefillHost);
      upsertLocal(m);
      markDirty(m.id, true);
      setPrefillHost(null);
    }
  }, [prefillHost]);

  const addBlank = () => {
    const m = newMapping();
    upsertLocal(m);
    markDirty(m.id, true);
  };

  return (
    <div className="options-root">
      <h1>⚙️ QA 이슈 리포터 설정</h1>
      <div className="threat-notice">
        ⚠️ <strong>위협 모델</strong>: 이 확장은 <code>fetch / XMLHttpRequest / console.error</code> 를 페이지 컨텍스트에서 monkey-patch 합니다.
        동일 origin 의 페이지 스크립트가 캡처된 데이터를 관찰할 수 있어요. <strong>내부 신뢰 앱 전용</strong>입니다.
        토큰은 디스크에 평문 저장됩니다. <strong>fine-grained PAT (Issues: Write 권한, 단일 레포)</strong> 사용을 권장합니다.
      </div>

      <div className="mappings">
        {mappings.map(m => <MappingRow key={m.id} mapping={m} />)}
      </div>

      <button className="add" onClick={addBlank}>＋ 새 매핑 추가</button>
    </div>
  );
}
```

- [ ] **Step 39.2 — `src/options/styles.css`**

```css
body { margin: 0; font: 14px/1.5 -apple-system, BlinkMacSystemFont, sans-serif; background: #f4f5f7; color: #1f2937; }
.options-root { max-width: 720px; margin: 24px auto; padding: 24px; background: #fff; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
h1 { font-size: 20px; margin: 0 0 16px 0; }
.threat-notice { background: #fffbea; border-left: 4px solid #f39c12; padding: 12px; border-radius: 4px; margin-bottom: 24px; font-size: 12px; color: #7a5300; }
.mapping-row { border: 1px solid #e5e7eb; border-radius: 6px; padding: 16px; margin-bottom: 12px; }
.mapping-row label { display: block; font-size: 11px; color: #6b7280; margin: 8px 0 4px; text-transform: uppercase; letter-spacing: 0.04em; }
.mapping-row input { width: 100%; padding: 7px 9px; border: 1px solid #d4d8de; border-radius: 4px; font: inherit; box-sizing: border-box; }
.mapping-row .row-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.mapping-row .name { width: auto; flex: 1; margin-right: 12px; font-weight: 600; }
.mapping-row button { padding: 4px 10px; border: 1px solid #d4d8de; background: #f3f4f6; border-radius: 4px; cursor: pointer; font-size: 12px; margin-left: 4px; }
.mapping-row button.danger { color: #c0392b; border-color: #f3c4be; background: #fdf3f1; }
.mapping-row button.link { background: none; border: none; color: #5b8def; padding: 0; font-size: 11px; margin-top: 4px; cursor: pointer; }
.token-row { display: flex; gap: 6px; }
.token-row input { flex: 1; font-family: ui-monospace, Menlo, monospace; }
.test-result { padding: 8px 10px; border-radius: 4px; margin: 8px 0; font-size: 12px; }
.test-result.ok { background: #e6f7ef; color: #0a7a3b; border-left: 3px solid #16a085; }
.test-result.err { background: #fdecea; color: #c0392b; border-left: 3px solid #e74c3c; }
.muted { color: #6b7280; font-size: 11px; margin-top: 4px; }
.save { padding: 8px 16px !important; background: #5b8def !important; color: #fff !important; border-color: #5b8def !important; opacity: 0.4; cursor: not-allowed; margin-top: 12px !important; }
.save.dirty { opacity: 1; cursor: pointer; }
.add { width: 100%; padding: 12px; background: #fff; border: 2px dashed #c0c5cc !important; color: #5b8def !important; font-weight: 600; border-radius: 6px; cursor: pointer; font: inherit; }
a { color: #5b8def; text-decoration: none; font-size: 11px; }
```

- [ ] **Step 39.3 — `src/options/main.tsx`**

```tsx
import { createRoot } from 'react-dom/client';
import { OptionsApp } from './OptionsApp';
import './styles.css';

createRoot(document.getElementById('root')!).render(<OptionsApp />);
```

- [ ] **Step 39.4 — Build + manual verify**

```bash
npm run build
```

Reload extension. Settings:
1. Open options page
2. Add new mapping with current domain
3. Fill repo + valid token, click "토큰 테스트" → ✅
4. Click "저장"
5. Open the page matching that domain → click extension icon → side panel shows mapping
6. Element selection works, slider works, submit registers GitHub issue

- [ ] **Step 39.5 — Commit**

```bash
git add .
git commit -m "Options App + 위협 모델 안내 + prefill"
```

---

## Phase 9: E2E Tests

### Task 40: Mock GitHub HTTP server

**Files:**
- Create: `scripts/mock-github-server.ts`

- [ ] **Step 40.1 — Implement**

```ts
import { createServer, IncomingMessage, ServerResponse } from 'node:http';

interface Scenario {
  user: { status: number; body?: object };
  repo: { status: number; body?: object };
  createIssue: { status: number; body?: object; headers?: Record<string, string> };
}

const DEFAULT: Scenario = {
  user: { status: 200, body: { login: 'qa-bot' } },
  repo: { status: 200, body: { full_name: 'o/r' } },
  createIssue: { status: 201, body: { number: 1, html_url: 'http://mock/issues/1' } },
};

let scenario: Scenario = DEFAULT;
let issueCounter = 0;

function send(res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...extra });
  res.end(JSON.stringify(body));
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'PUT' && req.url === '/scenario') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try { scenario = JSON.parse(body); res.writeHead(200); res.end('ok'); }
      catch { res.writeHead(400); res.end('bad'); }
    });
    return;
  }
  if (req.url === '/reset') {
    scenario = DEFAULT; issueCounter = 0;
    res.writeHead(200); res.end('ok');
    return;
  }
  if (req.url?.startsWith('/user')) {
    send(res, scenario.user.status, scenario.user.body ?? {});
    return;
  }
  if (req.url?.startsWith('/repos/') && req.method === 'GET') {
    send(res, scenario.repo.status, scenario.repo.body ?? {});
    return;
  }
  if (req.url?.match(/^\/repos\/[^/]+\/[^/]+\/issues$/) && req.method === 'POST') {
    issueCounter += 1;
    const body = scenario.createIssue.body
      ?? { number: issueCounter, html_url: `http://mock/issues/${issueCounter}` };
    send(res, scenario.createIssue.status, body, scenario.createIssue.headers ?? {});
    return;
  }
  res.writeHead(404); res.end('not found');
});

const port = parseInt(process.env.MOCK_PORT ?? '4870', 10);
server.listen(port, () => console.log(`mock-github on :${port}`));
```

- [ ] **Step 40.2 — Verify it starts**

```bash
npx tsx scripts/mock-github-server.ts &
sleep 1
curl -s http://localhost:4870/user
kill %1
```
Expected: `{"login":"qa-bot"}`

- [ ] **Step 40.3 — Commit**

```bash
git add .
git commit -m "Mock GitHub HTTP 서버 (E2E 용)"
```

---

### Task 41: Playwright config + first E2E

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/load-extension.spec.ts`

- [ ] **Step 41.1 — `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  fullyParallel: false, // extensions need persistent context, serial is safer
  use: {
    headless: false, // extensions require headed mode (use Xvfb in CI)
  },
  webServer: {
    command: 'npx tsx scripts/mock-github-server.ts',
    port: 4870,
    reuseExistingServer: true,
  },
});
```

- [ ] **Step 41.2 — `tests/e2e/load-extension.spec.ts`**

```ts
import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';

const EXT_PATH = path.resolve(process.cwd(), 'dist');

test('extension loads and content scripts inject', async () => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
    ],
  });

  // Wait for service worker
  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  expect(sw.url()).toContain('background');

  // Visit a page and verify content scripts loaded
  const page = await context.newPage();
  const messages: string[] = [];
  page.on('console', (m) => messages.push(m.text()));
  await page.goto('https://example.com');
  await page.waitForTimeout(500);

  const joined = messages.join('\n');
  expect(joined).toContain('content-main loaded');
  expect(joined).toContain('content-iso loaded');

  await context.close();
});
```

- [ ] **Step 41.3 — Run E2E**

```bash
npm run build
npx playwright install chromium
npm run test:e2e
```
Expected: 1 passed.

- [ ] **Step 41.4 — Commit**

```bash
git add .
git commit -m "Playwright 설정 + 확장 로드 smoke E2E"
```

---

### Task 42: E2E — golden path (configure → select → submit)

**Files:**
- Create: `tests/e2e/golden-path.spec.ts`, `tests/e2e/fixtures/test-page.html`

- [ ] **Step 42.1 — `tests/e2e/fixtures/test-page.html`**

```html
<!doctype html>
<html><body>
  <h1>Test Page</h1>
  <button id="cta">CTA</button>
  <div class="card"><span>card content</span></div>
</body></html>
```

- [ ] **Step 42.2 — `tests/e2e/golden-path.spec.ts`**

```ts
import { test, expect, chromium, Page } from '@playwright/test';
import path from 'node:path';

const EXT_PATH = path.resolve(process.cwd(), 'dist');
const FIXTURE = `file://${path.resolve(__dirname, 'fixtures/test-page.html')}`;

// Patch GITHUB_API_BASE for E2E — flag via env or runtime constant override.
// MVP approach: tests run against real github.com; for full mock, build a debug variant.
// Below uses a sentinel — adapt to your CI strategy.

test.skip('TODO: full golden path requires GITHUB_API_BASE override mechanism', async () => {
  // 1) load extension
  // 2) open options page via chrome-extension://{id}/src/options/index.html
  // 3) add mapping (name, pattern matching file://, repo, fake token)
  // 4) navigate to FIXTURE
  // 5) open side panel directly via chrome-extension://{id}/src/panel/index.html?tabId=...
  // 6) trigger selection
  // 7) click element on FIXTURE page
  // 8) fill title + description
  // 9) submit → assert mock server received POST with expected body shape
});
```

> Note: full golden-path E2E requires a debug build that points `GITHUB_API_BASE` at `http://localhost:4870`. Add an env-driven constant override before running this test (see "Open question" at plan tail).

- [ ] **Step 42.3 — Commit (skip-marked test)**

```bash
git add .
git commit -m "E2E golden path skeleton (debug-build 의존)"
```

---

### Task 43: Remaining E2E scenarios (skipped placeholders)

Add skeleton specs for items 2–7 from §8.4 of the spec. Each marked `.skip` until debug-build override lands; the goal is to enumerate the scenarios so they're not forgotten.

**Files:**
- Create: `tests/e2e/no-match.spec.ts`, `tests/e2e/token-test.spec.ts`,
          `tests/e2e/body-override.spec.ts`, `tests/e2e/throttle.spec.ts`,
          `tests/e2e/auth-error.spec.ts`, `tests/e2e/tab-gone.spec.ts`

- [ ] **Step 43.1 — Create each file with a `test.skip(...)` describing the scenario as plain English, mirroring §8.4 of the spec**

Example for `no-match.spec.ts`:
```ts
import { test } from '@playwright/test';

test.skip('NO_MATCH UI shows when no mapping matches current URL', async () => {
  // 1) Load extension with empty storage
  // 2) Navigate to any URL with no configured mapping
  // 3) Open side panel
  // 4) Assert: NoMatchPrompt visible
  // 5) Click "현재 도메인으로 매핑 추가" → assert options page opens with prefill
});
```

- [ ] **Step 43.2 — Commit**

```bash
git add .
git commit -m "E2E 시나리오 skeleton (구현은 debug-build 셋업 후)"
```

---

## Phase 10: Polish

### Task 44: README + 알려진 제한

**Files:**
- Create: `README.md`

- [ ] **Step 44.1 — Write README**

```markdown
# QA 이슈 리포터 (Chrome Extension)

비개발자 QA 가 웹 페이지에서 element 단위로 GitHub Issue 를 등록하는 도구.

## 설치

1. `npm install`
2. `npm run build`
3. Chrome `chrome://extensions` → "개발자 모드 ON" → "압축해제된 확장 프로그램 로드" → `dist/`

## 사용법

1. 확장 아이콘 클릭 → 사이드 패널 오픈
2. (첫 실행) "현재 도메인 매핑 추가" → 설정 페이지에서 repo + fine-grained PAT 입력 → 저장
3. "🎯 Element 선택" → 페이지에서 element 클릭
4. 사이드 패널에서 슬라이더로 부모 영역 조정
5. 제목 + 설명 입력 → "GitHub에 등록"

## ⚠️ 위협 모델 (반드시 읽기)

- 이 확장은 페이지 컨텍스트에서 `fetch / XMLHttpRequest / console.error` 를 monkey-patch 합니다.
- 동일 origin 의 페이지 스크립트가 캡처된 데이터를 관찰할 수 있어요.
- **내부 신뢰 앱 QA 전용**. 적대적 사이트 / 신뢰할 수 없는 사이트에 설치 금지.
- 토큰은 `chrome.storage.local` 에 평문 저장됩니다. 머신 액세스 권한이 있는 사람은 읽을 수 있어요.

## fine-grained PAT 권장

GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
- Resource owner: 대상 레포 owner
- Repository access: 단일 레포만 선택
- Permissions: Issues = **Read and write**

## 알려진 제한 (MVP)

- iframe 내부 element 선택 미지원
- 스크린샷 미지원 (GitHub REST API 의 직접 첨부 미지원)
- 전역 단축키 미지원 (수동 아이콘 클릭만)
- 토큰 평문 저장 (위 참조)
- 적대적 사이트 설치 금지
- 자동 생성 id (`:r0:`, `__abc` 등) 의 selector 안정성 낮음

## 개발

```
npm run dev          # Vite watch
npm run build        # 프로덕션 빌드
npm test             # unit + integration
npm run test:e2e     # Playwright E2E (mock GitHub 서버 자동 기동)
npm run coverage     # 커버리지
```

## 라이선스 / 기여

(MVP — 별도 명시 전까지 사내 사용)
```

- [ ] **Step 44.2 — Commit**

```bash
git add .
git commit -m "README + 위협 모델 + 알려진 제한"
```

---

### Task 45: Manual QA dogfood sentinels

**Files:**
- Create: `docs/manual-qa-checklist.md`

- [ ] **Step 45.1 — Copy §8.5 of spec into checklist file (markdown checkboxes)**

```markdown
# Manual QA Checklist

Spec: `docs/superpowers/specs/2026-05-23-qa-issue-reporter-extension-design.md` §8.5

## 매니페스트 / 권한
- [ ] 신규 설치 시 `webRequest` 권한 노출 안 됨 (회귀 catch)

## 기본 흐름
- [ ] 빈 매핑 상태에서 패널 → NO_MATCH UI
- [ ] 와일드카드 패턴 5종 등록 (host, *.X, *-X-*, localhost:port, apex)
- [ ] 유효 / 만료 / 잘못된 레포 토큰 각각 테스트 → 메시지 정확성

## 선택 모드
- [ ] 일반 element / 인터랙티브 (button, input) / SVG / 텍스트 노드
- [ ] 슬라이더 0 → max 끝까지, body/html 제외
- [ ] ESC 로 선택 모드 해제, 다른 키 차단

## 캡처
- [ ] 페이지 로드 직후 발생한 에러 포함
- [ ] 100회 반복 에러 → count 표시
- [ ] 거대한 페이지에서 60K 자르기 동작

## 본문 편집
- [ ] 자동 생성 → 편집 → 자동 재생성 안 됨
- [ ] 펼침 → 접음 → 다시 펼침 → 마지막 내용 유지

## 등록
- [ ] GitHub 실제 이슈 생성 확인 + 보기 링크 동작
- [ ] 토큰 무효화 → 401 메시지 + 폼 보존 → 토큰 수정 → 재시도 성공
- [ ] 5개 연속 등록 → throttle 큐잉 (간격 ≥ 1초)

## 탭 / SPA
- [ ] 등록 중 탭 닫음 → TAB_GONE UI
- [ ] pushState 후 ① 같은 dedup 버퍼 유지 ② collected.url 새 URL 반영

## 매핑 / 도메인
- [ ] 2개 이상 매칭 시 드롭다운 표시 / 변경 동작
- [ ] lastVerifiedAt 24h 초과 시 silent 재검증
- [ ] "현재 도메인 사용" — chrome:// 탭에서 비활성, 일반 탭에서 동작

## 도그푸딩 sentinels (시드 버그 5종)
배포 전 의도적으로 심어두고 QA 워크플로우로 5건 등록 → 등록된 본문이 expected fields 포함 확인

- [ ] sentinel 1: 슬라이더 라벨 일부러 잘못 표기 (`tag.WRONG-class`)
- [ ] sentinel 2: 옵션 페이지 타이틀 오타
- [ ] sentinel 3: 토스트 노출 시간 의도적으로 0.5s로 단축
- [ ] sentinel 4: NoMatchPrompt 의 "현재 도메인" 표시 누락
- [ ] sentinel 5: 토큰 테스트 성공 후 lastVerifiedAt 안 갱신
```

- [ ] **Step 45.2 — Commit**

```bash
git add .
git commit -m "Manual QA 체크리스트 + 도그푸딩 sentinels"
```

---

### Task 46: Production build + final verification

- [ ] **Step 46.1 — Production build**

```bash
npm run build
```

- [ ] **Step 46.2 — Run full test suite**

```bash
npm test
npm run lint
```
Expected: all pass.

- [ ] **Step 46.3 — Manual install + smoke**

1. Reload extension
2. Run through 5 happy-path scenarios from spec §8.5
3. Verify no `webRequest` permission in install prompt

- [ ] **Step 46.4 — Tag v0.1.0**

```bash
git tag v0.1.0
git log --oneline | head -20
```

- [ ] **Step 46.5 — Commit final**

```bash
# Should be nothing to commit; verify clean
git status
```

---

## Open Questions for Implementation

1. **E2E debug-build for GitHub API override** — The mock GitHub server is in place, but E2E tests (Tasks 42–43) need a way for the extension to point its API at `http://localhost:4870` during tests. Options:
   - Env-var-driven constant injection at build time (Vite `define`)
   - Read from `chrome.storage.local.debug.apiBase` if set
   - Separate `vite build --mode test` output

   Decide during Task 42 implementation. Recommended: env-driven `define` (`process.env.QA_EXT_API_BASE`) wired into `src/shared/constants.ts`.

2. **Icon design** — Placeholders shipped in Task 2. Replace before any external distribution.

3. **CI configuration** — Plan calls for parallel `lint/unit/integ` and serial `e2e`. The actual `.github/workflows/ci.yml` is left to whichever CI provider the team uses; design it after Task 46.

4. **Real-world dogfooding** — Spec §8.5 includes "도그푸딩 sentinel". Decide on cadence (every release? every PR?) and add to release checklist.

---

## Self-Review Summary

**Spec coverage** — All 11 sections of the design doc map to plan tasks:

| Spec § | Plan Tasks |
|---|---|
| §1 Overview / 위협 모델 | Tasks 39 (notice), 44 (README) |
| §2 결정 사항 | covered throughout |
| §3 아키텍처 | Tasks 1–2 (manifest), 17–21 (content), 22–28 (background), 29–36 (panel), 37–39 (options) |
| §4 데이터 모델 | Task 5 (types), 6 (url-pattern), 7 (pick-mapping), 8 (migrate), 14 (format-body), 15 (UA) |
| §5 데이터 플로우 | Tasks 17 (MAIN monkey-patch), 18 (buffer), 19 (overlay), 20 (selection), 21 (router), 22–27 (background) |
| §6 UI 상세 | Tasks 29–36 (panel), 37–39 (options) |
| §7 에러 처리 | Task 13 (http-errors), 25 (api wrapper), 27 (submit), 35 (inline error) |
| §8 테스트 전략 | Tasks 3 (Vitest), 40 (mock server), 41–43 (E2E), 45 (manual QA) |
| §9 Out of Scope | Task 44 (README) |
| §10 Future Hardening | Task 44 (README) |
| §11 결정 이력 | implicit in spec; no separate task |

**Placeholder scan** — No "TBD" / "TODO" / "fill in later" in implementation steps. Open Questions section at tail intentionally flagged for decisions deferred to implementation.

**Type consistency** — `PanelToBg`, `ContentToPanel`, `IssueDraft`, `CollectedData`, `Mapping` defined once in Task 5 and re-used by name everywhere. Verify with `tsc --noEmit` (Task 5.3 + every build step).

**Granularity** — Each task averages 4–5 steps at 2–5 min each. Total estimated effort: 12–18 hours of focused work, spread over ~2 weeks with QA buffer.

