# QA Issue Reporter — Chrome Extension Design

**작성일**: 2026-05-23
**상태**: 설계 완료 (구현 계획 수립 단계로 이행 예정)

---

## 1. 개요

비개발자 QA 가 웹 페이지에서 발견한 UI/기능 이슈를 element 단위로 정확히 지목해서 GitHub Issue 로 등록할 수 있는 Chrome 확장 도구.

### 1.1 핵심 기능

1. **URL 패턴별 레포 매핑** — 현재 URL 에 매칭되는 매핑을 자동 선택. 토큰 테스트 기능 포함.
2. **Element 선택 + 부모 확장 슬라이더** — element 를 클릭한 뒤 사이드 패널의 슬라이더로 부모 방향으로 선택 범위 확장.
3. **자동 정보 수집 + GitHub Issue 등록** — 선택한 영역의 selector, URL, 브라우저 정보, 뷰포트, 콘솔 에러, 네트워크 실패, HTML 스니펫을 자동 첨부.

### 1.2 위협 모델

내부 신뢰 앱 QA 용도. MAIN-world content script 가 페이지 컨텍스트의 console / fetch / XHR 을 monkey-patch 하므로, 동일 origin 의 페이지 스크립트가 캡처된 데이터를 관찰할 수 있음. **적대적 사이트 / 신뢰할 수 없는 사이트에 설치 금지**. README 와 설정 페이지 첫 화면에 명시.

---

## 2. 요구사항 결정 사항

| 영역 | 결정 |
|---|---|
| **자동 수집 항목** | URL · Selector · UA · Viewport · Console 에러 · Network 실패 · 선택 영역 HTML 스니펫 (모두 항상 첨부, 토글 없음) |
| **이슈 등록 형태** | 단순 등록 (title + body 만, label/assignee/milestone 없음) |
| **레포 매칭 방식** | URL 와일드카드 패턴(host-only) ↔ repo + token 매핑. 다중 등록, "현재 도메인 사용" 버튼 |
| **Element 선택 UX** | element 클릭 → 사이드 패널 슬라이더로 parent 방향 확장 (depth 0..maxDepth) |
| **UI 위치** | Chrome 네이티브 사이드 패널 (`chrome.sidePanel`) |
| **진입 / 해제** | 확장 아이콘 클릭 → 패널 오픈. 패널 내 "🎯 Element 선택" 버튼 → 선택 모드. ESC → 해제 |
| **등록 후 동작** | 연속 등록 (폼 리셋, 토스트 + 이슈 링크, 패널 유지) |
| **본문 편집** | 등록 직전 markdown body 자유 편집 가능 (one-way generation, 편집 후 자동 재생성 없음) |
| **매칭 없을 때** | 패널이 열리되 NO_MATCH UI + "➕ 현재 도메인 매핑 추가" 버튼 |
| **스크린샷** | MVP 제외 (GitHub REST API 가 직접 첨부 미지원. §10 참조) |
| **토큰 테스트** | 2단계 (인증 + 레포 접근). Issues 쓰기 권한은 첫 등록 시 확인 |

---

## 3. 아키텍처

### 3.1 컴포넌트 구성

```
┌────────────────────────────────────────────────────────────────┐
│ Chrome Browser                                                 │
│                                                                │
│  ┌──────────────────┐         ┌──────────────────────────┐    │
│  │ Side Panel       │◀───────▶│ Background Service       │    │
│  │ (React app)      │ runtime │ Worker                   │    │
│  │                  │ msg     │                          │    │
│  │ - 매핑 표시      │         │ - GitHub API 호출        │    │
│  │ - 슬라이더       │         │ - 토큰 테스트 (2단계)    │    │
│  │ - 이슈 입력 폼   │         │ - chrome.storage R/W     │    │
│  │ - 본문 편집      │         │ - panel ↔ tab 라우팅     │    │
│  │ - 토스트         │         │                          │    │
│  └────────┬─────────┘         └──────────────────────────┘    │
│           │ runtime → background → tabs                        │
│           ▼                                                    │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Content Script (ISOLATED world)                         │   │
│  │ - element hover/click (Shadow DOM 오버레이)             │   │
│  │ - parent chain 계산 / selector 경로 생성                │   │
│  │ - ESC 키 핸들러                                         │   │
│  │ - MAIN world 이벤트 수신 (postMessage) → 버퍼링        │   │
│  └────────────────────────────────────────────────────────┘   │
│           ▲ window.postMessage (origin-validated)              │
│  ┌────────┴───────────────────────────────────────────────┐   │
│  │ Content Script (MAIN world)                             │   │
│  │ - window.fetch / XMLHttpRequest monkey-patch            │   │
│  │ - console.error 가로채기                                │   │
│  │ - error / unhandledrejection 이벤트 리스너              │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                                │
│  ┌────────────────────────────────────────────────────────┐   │
│  │ Options Page (React app)                                │   │
│  │ - 매핑 CRUD, 토큰 테스트, 도메인 자동 인식              │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────┘

저장소: chrome.storage.local (평문 — §8.4 트레이드오프 명시)
```

### 3.2 책임 분리

| 컴포넌트 | 책임 | 금지 |
|---|---|---|
| Side Panel | UI 상태, 사용자 입력, markdown 조립 | GitHub API 직접 호출 |
| Background SW | GitHub API · 토큰 검증 · storage R/W · 메시지 라우팅 | DOM 조작, 네트워크 가로채기 |
| Content (ISOLATED) | DOM 조작 · Shadow DOM 오버레이 · 이벤트 캐치 · 버퍼 보관 | 토큰 접근, GitHub API |
| Content (MAIN world) | fetch/XHR/console monkey-patch + postMessage | DOM 수정, storage 접근 |
| Options Page | 매핑 CRUD, 토큰 테스트 트리거 | 활성 탭 조작 |

### 3.3 MV3 Manifest

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "scripting", "tabs", "activeTab", "sidePanel"],
  "host_permissions": ["<all_urls>"],
  "background": { "service_worker": "background.js" },
  "side_panel": { "default_path": "sidepanel.html" },
  "options_page": "options.html",
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-main.js"],
      "run_at": "document_start",
      "world": "MAIN"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["content-iso.js"],
      "run_at": "document_start"
    }
  ],
  "action": { "default_title": "QA 이슈 리포터" }
}
```

> `webRequest` 권한 없음. 네트워크 캡처는 MAIN-world monkey-patch 로 수행.
> 향후 하드닝으로 `chrome.scripting.registerContentScripts` 동적 등록 전환 가능.

### 3.4 빌드 / 의존성

- TypeScript + React + Vite + `@crxjs/vite-plugin`
- 상태관리: Zustand 또는 React Context (구현 단계 결정)
- 테스트: Vitest (unit/integ), Playwright (E2E)

---

## 4. 데이터 모델

### 4.1 저장 스키마 (`chrome.storage.local`)

```ts
interface StorageSchema {
  schemaVersion: 1;
  mappings: Mapping[];
}

interface Mapping {
  id: string;                     // uuid v4
  name: string;                   // 사용자가 붙인 이름
  urlPatterns: string[];          // 와일드카드 패턴 배열
  repo: string;                   // "owner/name"
  token: string;                  // 평문 저장 (§8.4)
  lastVerifiedAt: number | null;  // epoch ms
  createdAt: number;
}
```

`migrateStorage(raw)` 함수를 day-1 부터 구현 (현재는 identity). 향후 스키마 변경 시 첫 마이그레이션이 untested 로 ship 되는 사고 방지.

### 4.2 URL 패턴 매칭

**문법** — `*` 와일드카드만 메타. 그 외 리터럴. 대소문자 무시.

**매칭 대상** — `protocol://host[:port]` 만. path / query / hash 무시. http 와 https 모두 허용.

**암시 규칙** — `*.X` 형태는 apex 도메인도 매칭 (`*.vercel.app` → `vercel.app` 도 매칭).

**구현**

```ts
function patternToRegex(pattern: string): RegExp {
  const hostOnly = pattern.split('/')[0];  // path 적었으면 무시

  const apexMatch = hostOnly.match(/^\*\.(.+)$/);
  if (apexMatch) {
    const escHost = apexMatch[1].replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`^https?://(.*\\.)?${escHost}(/.*)?$`, 'i');
  }

  const escaped = hostOnly.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped.replace(/\*/g, '.*');
  return new RegExp(`^https?://${withWildcards}(/.*)?$`, 'i');
}

function normalizeUrl(url: string): string {
  return new URL(url).host;  // port 포함
}
```

**매칭 예시**

| 패턴 | URL | 매칭 |
|---|---|---|
| `myapp.com` | `https://myapp.com/anything?x=1` | ✅ |
| `myapp-*-myorg.vercel.app` | `https://myapp-feat-login-myorg.vercel.app/products` | ✅ |
| `*.vercel.app` | `https://vercel.app/foo` | ✅ (apex) |
| `*.vercel.app` | `https://abc.vercel.app/foo` | ✅ |
| `localhost:3000` | `http://localhost:3000/dashboard` | ✅ |
| `myapp.com` | `https://staging.myapp.com/` | ❌ |

설정 입력 시 path 가 포함되면 자동으로 host 부분만 잘라 저장하고 hint 표시.

### 4.3 다중 매칭 우선순위

모든 매핑의 모든 패턴을 `(mapping, pattern)` 페어로 펼친 뒤 정렬:

```
정렬 키 (오름차순 우선):
  1) 와일드카드 개수 — 적을수록 우선
  2) 패턴 길이 — 길수록 우선
```

1등 페어의 mapping 을 선택. 동일 URL 에 2개 이상 매칭되면 사이드 패널 상단에 "변경 ▾" 드롭다운으로 수동 전환 가능 (단일 매칭 시 드롭다운 숨김).

### 4.4 이슈 등록 모델

```ts
interface IssueDraft {
  mappingId: string;
  title: string;
  userDescription: string;        // 사용자 자유 입력
  collected: CollectedData;       // 자동 수집 (불변)
  finalBody: string;              // 생성된 markdown
  bodyOverridden: boolean;        // 사용자가 본문 편집 모드 진입 여부
}

interface CollectedData {
  url: string;                    // query/hash 포함된 원본 (PII 일부 sanitize, §8.5)
  selectedDepth: number;          // 0..maxDepth (body/html 제외)
  selector: string;
  parentChainSummary: string[];   // 슬라이더 라벨
  outerHTML: string;              // 정제 + 4000자 cap (§5.4)
  userAgent: string;
  platform: string;               // 예: 'macOS 14.5'
  browser: string;                // 예: 'Chrome 138'
  viewport: { w: number; h: number };
  capturedAt: number;
  consoleErrors: ConsoleError[];
  networkFailures: NetworkFailure[];
}

interface ConsoleError {
  message: string;                // 1,000자 cap
  stack?: string;                 // 2,000자 cap
  timestamp: number;
  source: 'console.error' | 'window.onerror' | 'unhandledrejection';
  count: number;                  // dedup 카운터
}

interface NetworkFailure {
  method: string;
  url: string;                    // PII 일부 sanitize
  status: number;                 // 0 = network error/abort/CORS
  statusText: string;
  timestamp: number;
}
```

**Source-of-truth 규칙 (one-way generation)**

- `bodyOverridden === false`: `userDescription` 또는 `collected` 변경 시 `finalBody` 자동 재생성
- 사용자가 "본문 편집" 버튼 클릭 → `bodyOverridden = true`. 이후 `finalBody` 가 단일 source of truth, `userDescription` 변경은 무시
- 본문 편집 모드 재오픈 시 자동 재생성 **없음** (편집 내용 보존)
- 제출 payload 는 항상 `finalBody`
- 연속 등록 시 폼 리셋: `bodyOverridden = false` 로 초기화

### 4.5 본문 크기 예산

GitHub 이슈 body 하드 리밋 **65,536자**. 안전 예산 **60,000자**, 5KB 헤드룸.

**자르기 우선순위** (예산 초과 시 위에서부터)

1. `outerHTML` — 4,000자로 잘라 `<details>` 접기
2. `networkFailures` — 가장 최근 20건만 유지
3. `consoleErrors` — 가장 최근 20건만 유지
4. 그래도 초과 시 자동 수집 섹션 후반부 끊고 푸터 추가
5. **사용자 입력 (`userDescription`) 단독으로 60,000자 초과 시** — 사용자 입력도 잘라내고 `(사용자 입력 일부 생략)` 푸터 추가

**계산 시점은 등록 직전.** 초과 시 토스트로 "자동 수집 정보 일부가 생략됨" 안내. `<BodySizeIndicator>` 가 실시간 표시 (55K → 노랑, 60K 초과 → 빨강, 등록 자체는 차단하지 않음).

### 4.6 `parentChainSummary` 라벨 포맷

```
${tagName}${ id ? '#'+id : '' }${ firstClass ? '.'+firstClass : '' }
  fallback: ${tagName} "${textSnippet 최대 12자}"
```

각 라벨 ≤ 30자.

**예**: `button#submit-btn.primary`, `div.product-card`, `span "장바구니에 담..."`

### 4.7 `selectedDepth` 상한

- 0 = 클릭한 element
- +N = N단계 부모
- 상한: `<body>` 직전까지. `<html>` / `<body>` 자체는 슬라이더 범위에서 제외

### 4.8 GitHub API Payload

```http
POST https://api.github.com/repos/{owner}/{repo}/issues
Authorization: Bearer {token}
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2022-11-28

{
  "title": "<draft.title>",
  "body": "<draft.finalBody>"
}
```

성공 기준: HTTP `201 Created` 만 성공. 그 외는 모두 에러 분기.

### 4.9 토큰 테스트 — 2단계

```
Step 1: GET /user
        → 200 = 인증 OK, 401 = 토큰 무효/만료

Step 2: GET /repos/{owner}/{repo}
        → 200 = 접근 OK, 404 = 없음/권한 없음

UI 표시:
  ✅ 토큰 유효, myorg/myapp 접근 가능
  ℹ️ Issues 쓰기 권한은 첫 등록 시 확인됩니다.
     (fine-grained PAT 사용 시 "Issues: Write" 권한 필요)
```

캐시: `lastVerifiedAt` 24시간 TTL. 패널 부트스트랩 시 24h 이내면 추가 호출 없음. 초과 시 silent 재검증 (Step 1만). 성공 시에만 `lastVerifiedAt` 갱신, 실패 시 노란 경고 sticky.

---

## 5. 데이터 플로우

### 5.1 페이지 로드 시 자동 캡처

```
[페이지 진입 — 매칭 여부와 무관]
   │
   ▼
content-main.js (MAIN world, document_start)
   ├─ window.fetch / XMLHttpRequest 래핑
   ├─ console.error 래핑
   ├─ window.addEventListener('error', ...) / 'unhandledrejection'
   └─ 이벤트 발생 → window.postMessage(payload, window.location.origin)

content-iso.js (ISOLATED, document_start)
   ├─ message 리스너 (origin / source / __qaSource 마커 검증)
   ├─ 검증 통과 시 ring buffer 에 push (dedup 적용)
   └─ buffer max 50건 (consoleErrors / networkFailures 각각)
```

**버퍼 스코프** — per-document. SPA route change (`history.pushState`) 에도 같은 document 면 유지. 페이지 새로고침 / 다른 origin 이동 시 새 document → 버퍼 초기화. 패널의 자동수집 표시에 hint: "이 페이지에서 발생한 에러 N건".

**왜 매칭 안 된 페이지에서도 캡처하나** — URL 변경(SPA route)마다 매칭이 변하고, 사용자가 패널 열 때 비로소 확정. 미리 깔려있어야 첫 에러를 놓치지 않음. 사용자가 패널을 열지 않으면 모든 데이터는 페이지를 떠날 때 소멸 (디스크 영속 없음).

**`postMessage` 보안**

```ts
// MAIN
window.postMessage(
  { __qaSource: 'qa-ext', type, payload },
  window.location.origin  // wildcard '*' 금지
);

// ISOLATED
window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (e.origin !== window.location.origin) return;
  if (e.data?.__qaSource !== 'qa-ext') return;
  // 버퍼 적재
});
```

**Dedup 적재 (FIFO + count)**

```ts
function push(buf: ConsoleError[], next: ConsoleError) {
  const last = buf[buf.length - 1];
  if (last && last.source === next.source
      && last.message.slice(0, 200) === next.message.slice(0, 200)) {
    last.count += 1;
    last.timestamp = next.timestamp;
    return;
  }
  buf.push(next);
  if (buf.length > 50) buf.shift();
}
```

dedup 은 직전 entry 와만 비교. `[A x100, C, A x50]` 처럼 사이에 다른 entry 가 끼면 count 가 리셋됨 (의도된 동작).

### 5.2 확장 아이콘 클릭 → 패널 열기

```
사용자: 확장 아이콘 클릭
   ▼
chrome.action.onClicked → background
   ├─ chrome.tabs.query: 현재 탭 URL
   ├─ chrome.storage.local.get('mappings')
   ├─ 매칭 (§4.2, 4.3) 실행
   ├─ chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html' })
   └─ chrome.sidePanel.open({ tabId })

패널 마운트:
   ├─ chrome.runtime.sendMessage({ kind: 'panel.bootstrap' })
   ├─ background 응답: { activeMappingId, allCandidates, tabId, url }
   └─ 패널 상태 초기화
```

**탭 바인딩**

- 패널은 열린 시점 tabId 에 바인딩. 사용자가 다른 탭으로 전환해도 **원래 탭 기준**.
- 패널 상단에 표시: `🔗 https://myapp.com/products (탭 #123)`
- 원래 탭이 닫히면 "원래 탭이 닫혔습니다 — 입력 내용 보존됨" 안내 + "현재 탭으로 전환" 버튼 → 매핑 재평가
- 명시적 전환 없이는 다른 탭 정보가 절대 draft 에 들어가지 않음

### 5.3 Element 선택 모드

```
사용자: "🎯 Element 선택" 클릭
   ▼
panel → runtime → background → tabs.sendMessage(boundTabId, { kind: 'selection.start' })

content-iso:
   ├─ Shadow host 생성 (mode: closed, position: fixed, inset: 0,
   │   pointer-events: none, z-index: 2147483647)
   ├─ Shadow root 에 SVG 기반 highlight overlay 주입
   ├─ document.body 커서: crosshair
   ├─ 이벤트 차단 (capture phase):
   │   pointerdown, mousedown, mouseup, click, auxclick, dblclick,
   │   contextmenu, submit, keydown (ESC 제외)
   ├─ mousemove(e): el = e.target → overlay rect = el.getBoundingClientRect()
   ├─ click(e): preventDefault + stopImmediatePropagation
   │             pickedElement / parentChain / selector / outerHTML 계산
   │             → panel: 'selection.picked'
   │             → 선택 모드 종료
   └─ keydown(ESC): 선택 모드 취소, overlay 제거 → panel: 'selection.cancel'
```

**Page overlay 정책 (불변)**

- Shadow DOM 오버레이는 **highlight 표시 전용 (read-only)**. 클릭 / 슬라이더 / 툴팁 등 **상호작용 element 0개**.
- 모든 컨트롤은 사이드 패널(별도 document)에 존재.

**Selector 생성**

1. element 에 `id` 가 있으면 `#${id}`
2. 없으면 부모부터 nth-child 절대 path: `body > main:nth-child(2) > section.products > div.card:nth-child(1)`
3. 클래스가 있어도 nth-child 함께 표기 (단일 클래스 매칭은 다중 가능성)

알려진 한계: auto-generated id (예: `:r0:`, `__abc`) 는 안정성 낮음. 알려진 제한으로 명시.

**iframe MVP 미지원** — 매니페스트에 `all_frames: true` 없음. content script 는 top-level frame 에만 주입. iframe 내부 element 는 hover/click 불가. 향후 same-origin iframe 지원 검토.

### 5.4 슬라이더로 부모 확장

```
패널: 슬라이더 변경 (depth = 0..maxDepth)
   ▼
panel → background → content-iso: 'selection.depthChange', depth
   ▼
content-iso:
   target = parentChain[depth]
   overlay 재배치 = target.getBoundingClientRect()
   selector / outerHTML 재계산
   → panel: 'selection.updated'
```

- 슬라이더 값 변경 즉시 메시지 (debounce 없음, 인지 지연 회피)
- 슬라이더 양옆 `◀`/`▶` 버튼 (한 단위 이동)
- 0 = "클릭한 element", max = "최상위 (body 직전)"

### 5.5 outerHTML 정제

`element.outerHTML` 직접 첨부는 위험 (base64 이미지, inline style, secret 등). 정제 후 4,000자 cap.

**정제 단계**

1. 깊은 복제 (`element.cloneNode(true)`)
2. 다음 속성 모두 제거:
   - inline `style`
   - `src`, `srcset` (이미지/iframe 본문)
   - `data:` URL 포함된 모든 속성
   - 5,000자 초과 속성값
   - 모든 `on*` 핸들러 (`onclick`, `onerror` 등)
   - 모든 `<input>` 의 `value`, `checked`
   - `<iframe>` 의 `srcdoc`
3. `href="javascript:..."` → `href="#"` 치환
4. `<script>`, `<style>`, `<noscript>` 자식 element (텍스트 포함) 제거
5. `outerHTML` 직렬화
6. 4,000자 초과 시 끝 자르고 `... (잘림)`
7. GitHub `<details>` 블록으로 감싸기

### 5.6 이슈 등록

```
사용자: "GitHub에 등록" 버튼
   ▼
panel:
   1) collect: 버퍼 스냅샷 (dedup 이미 적용된 상태)
   2) format: markdown 본문 조립
   3) budget: §4.5 자르기 예산 적용
   4) validate: title 비어있지 않음, userDescription 1자 이상
   ▼
panel → background: 'issue.submit', payload
   ▼
background:
   ├─ throttle: POST /issues 호출 사이 최소 1초 간격 (큐잉)
   ├─ mapping = storage.get(mappingId)
   ├─ fetch with AbortSignal.timeout(30_000)
   ├─ 201 → IssueSubmitResult { ok: true, number, htmlUrl }
   └─ 그 외 → 에러 코드 매핑 (§8.1)
   ▼
panel ← background: IssueSubmitResult
   ├─ 성공: 토스트 "✅ 이슈 #N 등록 → 보기" (5초)
   │        폼 리셋 (title='', userDescription='', collected=null, bodyOverridden=false)
   │        패널 유지 (연속 등록)
   └─ 실패: 인라인 에러 표시 (폼 전부 보존, 매핑 변경 없음)
```

**`SUBMIT` 상태 동안 등록 버튼 disabled** + 스피너. 더블 클릭 / 키 연타 차단.

**탭 닫힘 자동 분기** — background 가 `chrome.tabs.sendMessage(boundTabId, ...)` 호출 시 reject 받으면 panel 에 `{ kind: 'tab.gone' }` 발송 → §5.2 의 "원래 탭이 닫혔습니다" UI 자동 표시. 등록 도중이었으면 인라인 에러: "원래 탭이 닫혔습니다 — 현재 탭으로 전환 후 재시도".

**매핑 변경 시 draft 보존** — 사용자가 설정에서 토큰 수정하고 돌아와도 draft 유지. `draft.mappingId` 는 사용자가 명시적으로 드롭다운으로 바꾸지 않는 한 유지. 매핑이 삭제된 경우엔 draft 유지 + 등록 버튼 비활성 + "이 매핑이 삭제되었습니다" 안내.

### 5.7 UA / Platform / Browser 파싱

```ts
async function captureUserAgent(): Promise<UAInfo> {
  if (navigator.userAgentData?.getHighEntropyValues) {
    const d = await navigator.userAgentData.getHighEntropyValues(
      ['platformVersion', 'fullVersionList']
    );
    const brand = d.fullVersionList.find(b => !/Not.A.Brand/.test(b.brand));
    return {
      browser: `${brand.brand} ${brand.version}`,
      platform: `${d.platform} ${d.platformVersion}`,
      userAgent: navigator.userAgent,
    };
  }
  return parseUAString(navigator.userAgent);  // regex fallback
}
```

### 5.8 메시지 Protocol

```ts
// panel ↔ background
type PanelToBg =
  | { kind: 'panel.bootstrap' }
  | { kind: 'issue.submit'; payload: IssueDraft }
  | { kind: 'token.test'; mappingId: string }
  | { kind: 'mapping.save'; mapping: Mapping }
  | { kind: 'mapping.delete'; id: string };

// panel → content-iso (background 라우팅)
type PanelToContent =
  | { kind: 'selection.start' }
  | { kind: 'selection.cancel' }
  | { kind: 'selection.depthChange'; depth: number }
  | { kind: 'capture.snapshot' };

// content-iso → panel
type ContentToPanel =
  | { kind: 'selection.picked'; payload: PickedElement }
  | { kind: 'selection.updated'; payload: PickedElement }
  | { kind: 'selection.cancelled' }
  | { kind: 'capture.snapshot.result'; payload: CapturedSnapshot };

// background → panel (단방향 알림)
type BgToPanel =
  | { kind: 'tab.gone' };

// 결과 타입
type IssueSubmitResult =
  | { ok: true; number: number; htmlUrl: string }
  | { ok: false;
      code: 'auth' | 'not_found' | 'forbidden'
          | 'validation' | 'rate_limit' | 'network' | 'unknown';
      message: string;
      retryAfter?: number; };
```

**라우팅 규칙** — panel → content-iso 는 항상 background 경유. 이유: background 가 panel ↔ tab 바인딩 상태의 단일 소스.

---

## 6. UI 상세

### 6.1 사이드 패널 상태 머신

```
BOOTSTRAP ──┬──→ NO_MATCH
            └──→ MATCHED.IDLE
                    │
                    │ "Element 선택" 클릭
                    ▼
                MATCHED.PICK ──ESC──→ MATCHED.IDLE
                    │
                    │ element 클릭
                    ▼
                MATCHED.EDIT
                    │
                    │ "등록" 클릭
                    ▼
                SUBMIT
                    │
                ┌───┴───┐
                ▼       ▼
              성공     실패
              → IDLE   → EDIT (폼 보존)

  TAB_GONE ◀── 어떤 상태에서도 전이 (boundTabId 죽음)
```

### 6.2 사이드 패널 컴포넌트 트리

```
<SidePanel>
├─ <TabBindingBar>          상단 "🔗 URL (탭 #N)" + 탭 닫힘 안내
├─ <MappingHeader>          매칭 매핑 이름 + 변경 드롭다운 (2개 이상 매칭 시만)
├─ <NoMatchPrompt>          NO_MATCH 상태
│   └─ "➕ 현재 도메인 매핑 추가" → openOptionsPage(?prefillHost=...)
├─ <SelectionPanel>         MATCHED.* 공통
│   ├─ <PickButton>          "🎯 Element 선택" / "선택 취소 (ESC)"
│   ├─ <DepthSlider>          MATCHED.EDIT 전용
│   │   ├─ <RangeInput>        0..maxDepth
│   │   └─ <ChainLabels>       parentChainSummary[depth] 툴팁
│   └─ <SelectorPreview>       1줄 clamp
├─ <IssueForm>              MATCHED.EDIT 전용
│   ├─ <TitleInput>           80자 cap
│   ├─ <DescriptionTextarea>  최소 4줄 resize-y
│   ├─ <CollectedSummary>     "✓ 콘솔 3 · ✓ 네트워크 1 · ✓ HTML 312자"
│   ├─ <BodyEditToggle>       "📝 본문 편집"
│   └─ <BodyEditor>           bodyOverridden 시 펼침, 한 번 펼치면 등록까지 유지
│       └─ <MarkdownTextarea> monospace, finalBody 직접 편집
├─ <SubmitBar>              sticky bottom
│   ├─ <SubmitButton>         "GitHub에 등록 →" (SUBMIT 동안 disabled)
│   └─ <BodySizeIndicator>    "1,240 / 60,000자" (55K → 노랑, 60K 초과 → 빨강)
└─ <ToastStack>             5초 표시, 최대 3개 stack, hover 시 일시정지
```

### 6.3 슬라이더 인터랙션

```
선택 범위: ●━━━○━━━━━━━━━━━○━━━━━━━━━○
           0   1              2          3
         button div.product  section    main
                -card                    
                (현재)

(범위에 따라 페이지의 빨간 outline 이 실시간 확장/축소)
```

### 6.4 NO_MATCH 화면

```
┌────────────────────────────────────────────────┐
│ 🔗 https://staging.unknown-app.com/products    │
├────────────────────────────────────────────────┤
│         📭                                     │
│   이 URL에 등록된 레포가 없습니다              │
│                                                │
│   ┌──────────────────────────────────────┐    │
│   │ ➕ 현재 도메인으로 매핑 추가         │    │
│   │   (staging.unknown-app.com 자동 입력) │    │
│   └──────────────────────────────────────┘    │
│                                                │
│   ┌──────────────────────────────────────┐    │
│   │ ⚙️ 설정 열기                         │    │
│   └──────────────────────────────────────┘    │
└────────────────────────────────────────────────┘
```

"➕ 매핑 추가" 클릭 → `chrome.runtime.openOptionsPage()` + `?prefillHost={host}` 쿼리스트링 → 설정 페이지가 신규 매핑 row 미리 채워서 추가.

### 6.5 설정 페이지 컴포넌트 트리

```
<OptionsPage>
├─ <Header>                          "⚙️ QA 이슈 리포터 설정"
├─ <ThreatModelNotice>               "내부 신뢰 앱 전용. 적대적 사이트 설치 금지.
│                                     토큰은 디스크에 평문 저장됨."
├─ <MappingList>
│   └─ <MappingRow> (반복)
│       ├─ <RowHeader>
│       │   ├─ <NameField>            "MyApp 프로덕션"
│       │   ├─ <ActiveBadge>          현재 활성 탭 매칭 시 "현재 페이지 매칭"
│       │   └─ <RowActions>           테스트 / 삭제
│       ├─ <UrlPatternsField>        쉼표 구분 + "현재 도메인 사용" 버튼
│       ├─ <RepoField>                "owner/name"
│       ├─ <TokenField>               password input + 표시 토글
│       ├─ <TokenTestResult>          ✅ / ❌ + 마지막 검증 시각
│       ├─ <TokenHelpLink>            "fine-grained PAT 발급 가이드 →"
│       └─ <SaveButton>               변경사항 있을 때 활성, 명시적 저장
└─ <AddMappingButton>                "＋ 새 매핑 추가"
```

저장은 **명시적 "저장" 버튼**. 페이지 이동 전 unsaved 시 confirm 다이얼로그.

**"현재 도메인 사용" 버튼** — 활성 탭 host 를 입력 필드에 채워 넣음. 사용자가 와일드카드 패턴으로 편집 가능. `chrome://` 등 비-http URL 이면 비활성.

### 6.6 토스트 / 인라인 에러

**성공 토스트**
```
┌──────────────────────────────────────────┐
│ ✅ 이슈 #123 등록됨  [ 보기 → ]   [ ✕ ] │
└──────────────────────────────────────────┘
```
"보기" → `chrome.tabs.create({ url: htmlUrl })`.

**인라인 에러** — `<SubmitBar>` 위에 표시. 폼 데이터 보존. 에러 코드별 메시지/액션은 §8.1.

### 6.7 키보드 단축키 (MVP)

| 키 | 동작 | 컨텍스트 |
|---|---|---|
| `ESC` | 선택 모드 해제 | MATCHED.PICK |
| `Cmd/Ctrl + Enter` | 이슈 등록 | MATCHED.EDIT (폼 포커스) |

전역 단축키 (`commands`) 는 v2 로 보류.

---

## 7. 에러 처리 & 엣지 케이스

### 7.1 GitHub API 에러 매핑

| HTTP | code | 사용자 메시지 | 액션 |
|---|---|---|---|
| 401 | `auth` | "토큰이 만료되었거나 잘못되었어요" | [설정 열기] [다시 시도] |
| 403 + `Retry-After` 또는 `X-RateLimit-Remaining: 0` | `rate_limit` | "GitHub API 사용량 초과. 약 N분 후 재시도 가능" | [다시 시도] (`retryAfter` 동안 disabled) |
| 403 (default) | `forbidden` | "Issues 쓰기 권한이 없어요. fine-grained PAT 의 'Issues: Write' 권한을 확인하세요" | [설정 열기] [가이드] |
| 404 | `not_found` | "레포 `owner/name` 을 찾을 수 없어요. 매핑의 레포 경로를 확인하세요" | [설정 열기] |
| 422 | `validation` | "이슈 형식이 잘못되었어요. 제목/본문을 확인하세요." (응답 `errors[]` 는 콘솔에 디버그 로그) | [본문 편집] [다시 시도] |
| 5xx | `unknown` | "GitHub 서버 오류 (5xx). 잠시 후 다시 시도해주세요" | [다시 시도] |
| network failure / timeout | `network` | "네트워크 연결 실패. 인터넷 연결을 확인하세요" | [다시 시도] |
| 기타 | `unknown` | "알 수 없는 오류 (HTTP {status}): {body[:200]}" | [다시 시도] |

폼 데이터는 모든 에러 케이스에서 보존.

### 7.2 Rate Limit 디테일

- `Retry-After` 헤더 우선, 없으면 `X-RateLimit-Reset` 사용 (`retryAfter = (Reset - now) / 1000`)
- 토스트/배너 카운트다운: "약 N분 후 재시도 가능 (M:SS 남음)"
- **카운트다운 복원**: 패널 재오픈 시 `retryAfterEpoch` 기준으로 복원. `Date.now() >= retryAfterEpoch` 시 버튼 자동 활성
- 클라이언트 측 throttle: `POST /repos/{repo}/issues` 호출에만 1초 최소 간격 (background 큐잉). 토큰 테스트 등은 영향 없음

### 7.3 네트워크 / 오프라인

- `navigator.onLine === false` 면 **배너 경고만** ("오프라인일 수 있어요"). 요청은 차단하지 않음 — 무조건 시도해서 실제 결과 surface
- `online` 이벤트 → 배너 제거
- fetch timeout 30초 (`AbortSignal.timeout(30_000)`)

### 7.4 Background SW 타임아웃 정책

| 메시지 | timeout | auto-retry |
|---|---|---|
| `panel.bootstrap` | 5s | ❌ (실패 시 "다시 시도" 버튼) |
| `capture.snapshot` | 5s | 1회 |
| `token.test` | 10s | ❌ |
| `mapping.save` / `mapping.delete` | 5s | ❌ |
| **`issue.submit`** | **30s** | **❌ (이중 등록 방지)** |

`issue.submit` 만 auto-retry 비활성. 5.1초에 응답 도착 시 자동 재시도가 같은 이슈 두 번 등록하는 사고 방지.

### 7.5 토큰 평문 저장 — 트레이드오프 명시

- `chrome.storage.local` 은 디스크에 평문 저장. Chrome 의 OS secure storage 는 확장에서 직접 접근 불가
- 확장 안에 키를 두고 암호화해도 사실상 평문과 동일
- **완화책 (스펙 명시)**
  - 설정 페이지 상단에 명시: "토큰은 디스크에 평문 저장됩니다. 머신 액세스 권한이 있는 사람은 읽을 수 있어요."
  - **fine-grained PAT 권장** — 단일 레포 `Issues: Write` 권한만. 유출 시 영향 최소화
  - 토큰 만료일을 짧게 (예: 90일) 설정 권장
  - 공유 머신 / 데모 머신에 설치 금지 안내

### 7.6 PII Sanitization (MVP)

**자동 sanitize 대상** — 캡처된 URL 의 query 파라미터. 이름 매칭 (case-insensitive):

`access_token`, `refresh_token`, `token`, `api_key`, `apikey`, `auth`, `password`, `secret`, `code`, `bearer`, `session`, `sid`, `jwt`, `id_token`

값을 `***` 로 치환.

**콘솔 메시지는 자동 sanitize 안 함** (자유 텍스트, 거짓 양성 위험).

**네트워크 캡처는 URL + status 만**. 요청/응답 헤더와 본문은 **캡처하지 않음** (스키마와 일치).

**사용자 책임** — 본문 편집 기능이 있는 이유. 등록 전 민감 정보 검토 가능.

### 7.7 매핑 삭제된 상태 draft

- draft 보존, 등록 버튼 비활성
- "이 매핑이 삭제되었습니다. 다른 매핑을 선택하거나 새로 추가하세요" 안내
- 사용자는 매핑 변경 드롭다운 또는 새 매핑 추가 후 재선택

### 7.8 Content Script 응답 없음

- `chrome.tabs.sendMessage` 실패 시:
  - 비지원 URL (`chrome://`, `chrome-extension://`, Web Store 등): "이 페이지는 지원하지 않아요"
  - 일반 URL: "페이지를 새로고침한 뒤 다시 시도해주세요"
- **동적 주입 fallback 시도 안 함** (매니페스트 모순 회피)

### 7.9 동시 등록 락

- `SUBMIT` 상태 동안 등록 버튼 disabled + 스피너
- 더블 클릭 / 키 연타 / 멀티 탭 시도 모두 차단
- `SUBMIT` 완료 (성공/실패) 시 락 해제

### 7.10 알려진 제한 (README 명시)

- iframe 내부 element 선택 미지원
- 스크린샷 미지원 (GitHub REST API 제한)
- 전역 단축키 미지원 (수동 아이콘 클릭만)
- 토큰 평문 저장
- 적대적 사이트 설치 금지
- 자동 생성 id (`:r0:`, `__abc` 등) 의 selector 안정성 낮음

---

## 8. 테스트 전략

### 8.1 테스트 피라미드

```
┌─────────────────┐
│  Manual QA      │  핵심 user journey + 도그푸딩
├─────────────────┤
│  E2E (5~8)      │  Playwright + Chrome + Node HTTP Mock
├─────────────────┤
│  Integration    │  Vitest + jsdom + sinon-chrome
│  (15~20)        │
├─────────────────┤
│  Unit (40~60)   │  Vitest, pure functions
└─────────────────┘
```

### 8.2 Unit 테스트 (Vitest)

`src/lib/*.ts` 로 pure functions 분리.

| 모듈 | 테스트 항목 |
|---|---|
| `patternToRegex` | host-only, 와일드카드, apex (`*.X` → `X`), port 보존, http/https, path/query 무시 |
| `normalizeUrl` | port 포함, path/query 제거 |
| `pickBestMapping` | wildcard count → length 정렬, 동수, 매칭 없음 → null |
| `sanitizeOuterHTML` | `on*` 제거, `javascript:` 치환, `<input value>` 제거, `<script>` 자식 제거, 4000자 cap, `<details>` wrap |
| `buildSelector` | id 우선, nth-child 절대 path, 클래스 + nth-child 조합 |
| `buildLabel` | `tag#id.class`, 30자 cap, 텍스트 fallback |
| `formatIssueBody` | 섹션 순서, markdown 이스케이프, 한국어/특수문자 |
| `applyBodyBudget` | outerHTML → networkFailures → consoleErrors 자르기 순서, **사용자 입력 단독 60K 초과 케이스** |
| `scrubPii` | 14+ query 파라미터 치환, case-insensitive |
| `dedupePush` | 동일 source/200자 prefix 매칭, count 증가, FIFO 50 cap |
| `parseRetryAfter` | `Retry-After` 정수/HTTP-date, `X-RateLimit-Reset` 우선순위 |
| `mapHttpToErrorCode` | 401/403/404/422/5xx → code, 403 + rate-limit 헤더 → rate_limit |
| `migrateStorage` | v1 → v1 identity, v0 (없음) → v1, 알 수 없는 version 처리 |

### 8.3 Integration 테스트 (Vitest + jsdom + `sinon-chrome`)

```
- background: panel.bootstrap → storage.get → 매칭 → 응답
- background: issue.submit → fetch mock → 201/4xx/5xx 분기
- background: token.test 2단계, 각 단계 성공/실패
- background: tabs.sendMessage 실패 → tab.gone 전파
- panel: state machine 전이 (BOOTSTRAP → MATCHED.* → SUBMIT)
- panel: 실패 시 폼 보존, 성공 시 리셋
- panel: 매핑 변경 드롭다운 (다중 매칭 시만)
- content-iso: postMessage origin 검증 (다른 origin reject)
- content-iso: dedup 적용된 버퍼 적재
- storage migration: schemaVersion 변환
```

**스냅샷 테스트 회피** — React UI 는 Testing Library 의 role/label 기반 assertion. 스냅샷은 빠르게 썩고 리뷰가 무의미해짐.

### 8.4 E2E 테스트 (Playwright)

**환경**

```ts
chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: false,              // CI: --headless=new 또는 Xvfb
  args: [
    `--disable-extensions-except=${EXT_PATH}`,
    `--load-extension=${EXT_PATH}`,
  ],
});

// 사이드 패널 직접 로드 (sidePanel.open() user gesture 회피)
await page.goto(`chrome-extension://${extId}/sidepanel.html?tabId=${tabId}`);
```

**Mock GitHub API** — `msw` 대신 **Node `http.createServer` 기반 단순 mock**. SW / 페이지 / content script 모두에서 동일 mock 적용.

**E2E 시나리오**

| # | 시나리오 | 검증 |
|---|---|---|
| 1 | 매칭 → element 선택 → 슬라이더 +1 → 등록 | API payload, 응답 처리, 폼 리셋 |
| 2 | 매칭 없음 → "도메인 매핑 추가" → 설정에 prefill | 라우팅, prefill |
| 3 | 새 매핑 → 토큰 테스트 (200/401/404) → 저장 | 분기, storage |
| 4 | 본문 편집 → 자동 재생성 안 됨 → 등록 | bodyOverridden |
| 5 | 연속 등록 2회 (1초 내) → 큐잉 처리 | throttle |
| 6 | 401 → 인라인 에러 + 폼 보존 → 토큰 수정 → 재시도 성공 | 폼 보존, 에러 |
| 7 | 탭 닫고 등록 시도 → TAB_GONE UI | 탭 바인딩 |

### 8.5 Manual QA 체크리스트

```
□ 매니페스트 ─ 신규 설치 시 webRequest 권한 노출 안 됨 (회귀 catch)
□ 첫 실행 ─ 빈 매핑 상태에서 패널 → NO_MATCH UI
□ 설정 ─ 와일드카드 패턴 5종 등록 (host, *.X, *-X-*, localhost:port, apex)
□ 토큰 ─ 유효/만료/잘못된 레포 각각 테스트 → 메시지 정확성
□ 선택 ─ 일반 element / 인터랙티브 (button, input) / SVG / 텍스트 노드
□ 슬라이더 ─ 0 → max 끝까지, body/html 제외
□ ESC ─ 선택 모드 해제, 다른 키 차단
□ 콘솔/네트워크 캡처 ─ 페이지 로드 직후 발생한 에러 포함
□ Dedup ─ 100회 반복 에러 → count 표시
□ 본문 ─ 자동 생성 → 편집 → 자동 재생성 안 됨
□ 60K 초과 ─ 거대한 페이지에서 자르기 동작
□ 등록 성공 ─ GitHub 실제 이슈 생성, 보기 링크 동작
□ 등록 실패 ─ 토큰 일시 무효화 → 401 메시지 + 폼 보존 → 재시도 성공
□ 연속 등록 ─ 5개 연속 → throttle + 큐잉
□ 탭 닫기 ─ 등록 중 탭 닫음 → TAB_GONE
□ SPA route ─ pushState 후 ① 같은 dedup 버퍼 유지 ② collected.url 새 URL 반영
□ 다중 매칭 ─ 2개 이상 매칭 시 드롭다운 표시 / 변경 동작
□ 토큰 24h TTL ─ lastVerifiedAt 24h 초과 시 silent 재검증
□ 본문 편집 모달 ─ 펼침 → 접음 → 다시 펼침 → 마지막 내용 유지
□ "현재 도메인 사용" ─ chrome:// 탭에서 비활성, 일반 탭에서 동작
□ 도그푸딩 sentinel ─ 시드 버그 5종 (slider mis-label, options 페이지 typo 등)
                       의도적으로 심어두고 QA 워크플로우로 5건 등록 →
                       등록된 본문이 expected fields 포함 확인
```

### 8.6 빌드 / CI

**빌드** — `vite build` 개발 / `vite build --mode production` 배포. `@crxjs/vite-plugin`.

**CI (GitHub Actions)**

```yaml
jobs:
  lint:    runs-on: ubuntu-latest          # parallel
  unit:    runs-on: ubuntu-latest          # parallel
  integ:   runs-on: ubuntu-latest          # parallel
  e2e:     runs-on: ubuntu-latest          # serial (last)
           needs: [unit, integ]
```

**커버리지 목표 (현실적)**
- Unit: 85%
- Integration: 50~60%
- 결합 branch: 75%+

`vitest --coverage` v8 provider.

### 8.7 디버깅 / 개발

- 개발 빌드: Shadow DOM `mode: 'open'` (devtools inspection 가능)
- 프로덕션 빌드: `mode: 'closed'`
- 로그 레벨: 개발 `debug`, 프로덕션 `warn` 이상만
- background 디버깅: `chrome://extensions` → "Inspect views: service worker"
- 사이드 패널 디버깅: 패널 우클릭 → Inspect
- content script 디버깅: 페이지 devtools → Sources → Content scripts

---

## 9. Out of Scope (MVP)

명시적으로 제외된 항목. 향후 확장 시 별도 설계.

- **스크린샷** — GitHub REST API 의 직접 첨부 미지원. 향후 Release Assets 또는 외부 호스트 방식 검토
- **iframe 내부 element 선택** — same-origin iframe 도 미지원. 향후 확장
- **전역 단축키** — `commands` 매니페스트 미사용. 향후 추가
- **Issue Template / Label / Assignee 지정** — 단순 등록만
- **콘솔 메시지 자동 PII sanitization** — URL query 만 적용
- **사용자 정의 PII 패턴** — 14개 query 파라미터 고정
- **여러 GitHub 계정 / Enterprise** — `api.github.com` 만 지원
- **오프라인 drafts / 큐 영속화** — 패널 닫히면 미등록 draft 소실
- **이슈 등록 후 후속 액션** — comment 추가, 라벨 부여, PR 연결 등 일체 없음
- **수정 / 삭제 / 재발송** — 등록된 이슈는 GitHub 에서 직접 관리

---

## 10. Future Hardening

향후 보안/안정성/UX 개선 후보.

- **권한 최소화** — `<all_urls>` → 매핑된 패턴에 한해 `chrome.scripting.registerContentScripts` 동적 등록
- **스크린샷 지원** — Release Assets 워크어라운드 (draft release 에 이미지 업로드 후 URL embed)
- **same-origin iframe 지원** — 매니페스트 `all_frames: true` 추가 + iframe 좌표 보정
- **단축키** — `commands` 매니페스트로 패널 토글
- **토큰 암호화** — 키 관리 방식 결정 필요 (사용자 마스터 패스워드?)
- **콘솔 메시지 PII** — 사용자 정의 정규식 패턴

---

## 11. 결정 이력 (요약)

설계 과정에서 핵심 트레이드오프와 결정:

| 항목 | 선택 | 이유 |
|---|---|---|
| UI 위치 | Native Side Panel | iframe 주입 시 페이지 CSS 충돌 / 페이지 네비게이션 시 사라짐 |
| 빌드 | TS + React + Vite | 설정 페이지의 다중 매핑 폼 상태 관리에 React 가 적합 |
| URL 매칭 | host-only 와일드카드 | 비개발자 UX 단순화. path 매칭은 over-spec |
| 스크린샷 | MVP 제외 | GitHub REST API 직접 첨부 미지원 |
| 네트워크 캡처 | MAIN-world monkey-patch | SW idle 종료 문제 회피, `webRequest` 권한 제거 |
| `postMessage` | `window.location.origin` 명시 | wildcard `*` 는 누수 위험 |
| 토큰 테스트 | 2단계 만 | Issues 쓰기 권한은 API 로 확인 불가 (정직성) |
| `issue.submit` | 30s timeout, auto-retry 없음 | 이중 등록 방지 |
| 다중 매칭 우선순위 | wildcard count + length | 가장 구체적인 패턴 자동 선택 + 수동 변경 가능 |
| 본문 편집 | one-way generation | 단순성. 편집 후 의도하지 않은 덮어쓰기 방지 |
| 본문 예산 | 60K 자르기 우선순위 | GitHub 65,536자 하드 리밋 회피 |
| 동적 주입 fallback | 미사용 | 매니페스트 일관성, 새로고침 안내가 단순함 |
