# Anchor 기반 Selector 생성 알고리즘 — 설계

- **Issue**: [kyago/bugpin#1](https://github.com/kyago/bugpin/issues/1)
- **작성일**: 2026-05-26
- **대상 모듈**: `src/lib/anchor-selector.ts` (신규), `src/lib/selector.ts`, `src/content-iso/selection-mode.ts`, `src/lib/format-body.ts`, `src/shared/types.ts`, `src/panel/components/SelectionPanel.tsx`, `src/panel/components/IssueForm.tsx`

## 1. 배경

현재 `src/lib/selector.ts:buildSelector`는 클릭된 element에서 부모로 거슬러 올라가며 단순 `nth-child` 누적 경로를 생성한다.

```
body > main:nth-child(4) > section.bg-cream:nth-child(8) > div.mx-auto:nth-child(1) > div.flex:nth-child(2)
```

한계:
- 형제 노드 순서나 DOM 구조가 살짝만 바뀌어도 selector가 무효화된다 (리포터·개발자 시점 차이로 재현 불가).
- 어느 컴포넌트인지 selector만 봐서는 한눈에 들어오지 않는다.
- 자동 생성 id (`:r0:`, `__abc` 등) 가 `#id` 단축 분기에 그대로 들어가 더 깨지기 쉽다 (README "알려진 제한"에도 명시됨).

## 2. 목표

1. selector가 가능한 한 **의미 있는 anchor**를 기준으로 짧게 생성되도록 한다.
2. anchor가 잡힌 경우, 사람이 읽기 쉬운 **anchor 체인**과 가능한 경우 **소스 파일명**을 별도 필드로 추출해 이슈 본문과 패널에 노출한다.
3. anchor를 하나도 찾지 못하는 페이지에서는 기존 nth-child 동작이 회귀 없이 유지된다.
4. depth 슬라이더(부모 영역 확장) 의미는 그대로다 — selector는 항상 **클릭된 원본 element 기준**.

비목표:
- 기존 PickedElement / CollectedData 메시지 protocol 의 구조 변경. 신규 정보는 옵셔널 필드로만 추가.
- iframe 내부 element 지원, 스크린샷, 토큰 저장 방식 변경 등 별개 항목.

## 3. 공개 API

### 3.1 신규 모듈 `src/lib/anchor-selector.ts`

```ts
export interface PickInfo {
  selector: string;
  anchorChain: string[];       // 예: ["Pricing", "product-card"]
  sourceFile: string | null;   // data-sentry-source-file 값 (있을 때만)
}

export function buildPickInfo(el: Element): PickInfo;
```

`buildPickInfo` 동작:
1. `findAnchor(el)` — tier 1 부터 6 까지 순서대로 `closest()` 로 상향 탐색.
2. anchor 가 발견되면 `buildRelativeSelector(anchor, el)` 로 anchor 부터 target 까지 selector 구성. anchor === target 이면 anchor selector 단독.
3. anchor 의 `querySelectorAll(selector).length > 1` 이면 anchor selector 끝에 `:nth-of-type(n)` 부여로 유일화.
4. anchor 체인 수집: anchor 노드부터 위로 추가 anchor 가 있으면 모은 뒤, 최종 배열은 **바깥쪽 → 안쪽** 순서로 정렬해 반환 (이슈 예시 `Pricing → product-card` 와 동일 방향). 최대 3개.
5. anchor 가 하나도 없으면 fallback 으로 기존 nth-child 알고리즘 (`buildNthChildSelector`) 실행. `anchorChain = []`, `sourceFile = null`.
6. tier 2 (data-sentry-component) anchor 가 잡힌 경우, **같은 노드**의 `data-sentry-source-file` 값을 `sourceFile` 로 추출.

### 3.2 기존 모듈 `src/lib/selector.ts`

- `buildLabel(el)` 그대로 유지 (panel UI 에서 사용 중).
- `buildSelector(el)` 는 `anchor-selector.ts` 내부의 private `buildNthChildSelector` 로 흡수. 외부 export 제거.

## 4. Anchor 우선순위 (확정)

| Tier | Matcher | 비고 |
|------|---------|-----|
| 1 | `[data-block]` | 의도적 하위 랜드마크 |
| 2 | `[data-sentry-component]` | 같은 노드의 `data-sentry-source-file` 도 함께 추출 |
| 3 | `[data-section]` | `data-testid` 는 **제외** (prod 빌드에서 제거되는 경우가 많음) |
| 4 | `[id]` (auto-id 제외) | auto-id 정규식: `/^:r[0-9a-z]+:?$/` 또는 `/^[0-9]+$/` |
| 5 | `[role]` + 있으면 `[aria-label]` 결합 | aria-label 값은 `CSS.escape` 적용 |
| 6 | 시맨틱 태그 (`section`, `article`, `main`, `nav`, `header`, `footer`) | |
| 7 | nth-child fallback (기존 로직) | anchor 미존재 시 |

### 4.1 Anchor selector 표현 규칙

| Tier | selector 형식 | 예 |
|------|--------------|----|
| 1 | `[data-block="..."]` | `[data-block="product-card"]` |
| 2 | `[data-sentry-component="..."]` | `[data-sentry-component="Pricing"]` |
| 3 | `[data-section="..."]` | `[data-section="hero"]` |
| 4 | `#id` (CSS.escape 적용) | `#checkout-form` |
| 5 | `[role="X"]` 또는 `[role="X"][aria-label="Y"]` (aria-label 은 CSS.escape) | `[role="button"][aria-label="장바구니"]` |
| 6 | 태그명 소문자 | `section` |

### 4.2 anchorChain 라벨 규칙

| Tier | label 값 |
|------|--------|
| 1 | `data-block` 값 |
| 2 | `data-sentry-component` 값 |
| 3 | `data-section` 값 |
| 4 | `#` + id |
| 5 | `aria-label` 이 있으면 그 값, 없으면 `role` 값 |
| 6 | 태그명 소문자 |

체인은 **바깥쪽 → 안쪽** 순서로 최대 3개. 예: 클릭된 element 가 `data-sentry-component="Pricing"` 안의 `data-block="product-card"` 안이라면 `anchorChain = ["Pricing", "product-card"]` (Pricing 이 바깥, product-card 가 안쪽).

### 4.3 auto-id 정규식

```ts
const isAutoId = (id: string): boolean =>
  /^:r[0-9a-z]+:?$/.test(id) || /^[0-9]+$/.test(id);
```

- React 18 `useId` 패턴 `:r0:`, `:r1a:` 등 제거.
- 순수 숫자 id (`123`) 제거.
- `__next`, `__nuxt` 등 의도적 `__` prefix 는 **유지** (Next.js / Nuxt 루트는 anchor 로 쓸 수 있다).

### 4.4 다중 매치 유일화

anchor selector 가 페이지 상에서 `document.querySelectorAll(anchorSelector).length > 1` 이면:

1. anchor 노드의 parent 기준 동일 tag 형제들 사이의 index 를 구해 `:nth-of-type(n)` 을 append. 같은 부모 아래 형제로만 매치가 모이는 경우 이 단계에서 유일화된다.
2. `:nth-of-type` 부여 후에도 `document.querySelectorAll(...).length > 1` 이면 (즉 매치가 형제가 아닌 다른 부모들에 흩어진 경우) anchor 채택을 포기하고 tier 7 nth-child fallback 으로 전환. `anchorChain = []`, `sourceFile = null`.

## 5. 데이터 흐름

### 5.1 타입 변경 (`src/shared/types.ts`)

```ts
export interface PickedElement {
  selector: string;
  outerHTML: string;
  parentChainSummary: string[];
  maxDepth: number;
  currentDepth: number;
  anchorChain?: string[];          // 신규 (옵셔널)
  sourceFile?: string | null;      // 신규 (옵셔널)
}

export interface CollectedData extends CapturedSnapshot {
  selectedDepth: number;
  selector: string;
  parentChainSummary: string[];
  outerHTML: string;
  anchorChain?: string[];          // 신규
  sourceFile?: string | null;      // 신규
}
```

옵셔널이므로 storage 에 저장된 기존 draft 와도 호환된다.

### 5.2 호출부

- `src/content-iso/selection-mode.ts:144`
  현재: `selector: buildSelector(el)` 만 채움.
  변경: `const info = buildPickInfo(el); { selector: info.selector, anchorChain: info.anchorChain, sourceFile: info.sourceFile, ... }`.
- `src/panel/components/IssueForm.tsx:30-36, 55-61`
  현재: `s.picked` 의 일부 필드만 spread 해 `CollectedData` 를 구성.
  변경: `anchorChain` 과 `sourceFile` 도 명시적으로 복사.

### 5.3 출력 — 이슈 본문 (`src/lib/format-body.ts`)

`- **Selector**:` 라인 위에 다음을 삽입한다:

```
- **Anchor 체인**: A → B → C        ← anchorChain.length > 0 일 때만
- **소스 파일**: Pricing.tsx          ← sourceFile != null 일 때만
```

라인 순서: Anchor 체인 → 소스 파일 → Selector.

### 5.4 출력 — 패널 (`src/panel/components/SelectionPanel.tsx`)

현재 label / depth 슬라이더 위쪽에 anchor 체인을 별도 줄로 표시. `anchorChain.length === 0` 이면 해당 줄을 노출하지 않는다. 스타일은 기존 label 라인과 동일 톤 (작은 모노스페이스, secondary text color).

## 6. depth 슬라이더와의 관계

selector / anchorChain / sourceFile 은 **클릭된 원본 element 기준** 으로 한 번만 산출되어 `picked` 에 고정 저장. depth 슬라이더 조정은 `outerHTML` 과 `parentChainSummary` 만 갱신하며 selector 는 재계산하지 않는다 (기존 패턴 유지).

## 7. 에러 / 엣지 케이스

| 상황 | 동작 |
|------|------|
| `el === document.documentElement` 또는 `el === document.body` | tier 6 시맨틱 fallback도 못 잡으므로 nth-child 알고리즘 진입. body 도달 시 `'body'` 반환. |
| `el` 자체가 anchor | anchor selector 단독 반환. `buildRelativeSelector` 의 상대 경로 부분은 빈 문자열. |
| 같은 tier 의 anchor 가 같은 ancestor 체인 안에 여러 개 | `closest()` 는 가장 가까운 것을 반환하므로 자동 해결됨. anchorChain 수집 시 추가 매치를 더 위에서 찾으면 함께 채움 (최대 3개). |
| anchor selector 가 페이지 상 여러 노드와 매치 | §4.4 절차대로 처리 — 형제면 `:nth-of-type` 으로 유일화, 흩어져 있으면 anchor 채택 포기 후 nth-child fallback. |
| aria-label 값에 따옴표 / 특수문자 | `CSS.escape` 로 이스케이프. |
| `closest()` / `CSS.escape` 미지원 환경 | 둘 다 jsdom / happy-dom / 모든 evergreen 브라우저에서 지원. 별도 polyfill 없음. |

## 8. 테스트 전략

### 8.1 신규 unit test `tests/unit/anchor-selector.test.ts`

다음 시나리오를 happy-dom 환경에서 fixture DOM 으로 검증:

- tier 별 매처 우선순위 (각 tier 가 상위 tier 부재 시에만 선택되는지).
- auto-id 정규식 — `:r0:`, `:r1a:`, `123` 은 reject; `__next`, `checkout-form` 은 accept.
- anchor === target 케이스.
- 같은 tier 매처 페이지 상 다중 존재 시 `:nth-of-type` 부여 확인.
- anchor 없는 fixture 에서 fallback nth-child 결과가 기존 `buildSelector` 와 동일한지 (회귀 안전망).
- aria-label 이스케이프 — 따옴표 포함 값이 selector 에 안전하게 들어가는지.
- `data-sentry-component` 매칭 시 같은 노드의 `data-sentry-source-file` 추출.
- 다중 anchor 체인 (최대 3개 수집).

### 8.2 기존 테스트 갱신

- `tests/unit/selector.test.ts` — `buildSelector` export 제거에 맞춰 `buildLabel` 위주로 재정리. `buildSelector` 의 nth-child 회귀 검증은 8.1 의 fallback 케이스로 이전.
- `tests/unit/selection-mode.test.ts` — fixture 에 anchor 속성이 없으므로 기존 assertion 그대로 통과해야 함. `picked.anchorChain` 이 `[]` 인지 1개 케이스 추가.
- `tests/unit/format-body.test.ts` — 신규 라인 두 종 (Anchor 체인 / 소스 파일) 의 조건부 렌더링 케이스 추가:
  - anchorChain 있고 sourceFile 있음 → 두 라인 모두 출력.
  - anchorChain 있고 sourceFile null → Anchor 체인만 출력.
  - anchorChain 비어 있음 → 두 라인 모두 출력 안 함.

### 8.3 E2E (`tests/e2e/fixtures/test-page.html`)

기존 fixture 에 anchor 속성이 있는 영역을 추가:

```html
<section data-sentry-component="Demo" data-sentry-source-file="Demo.tsx">
  <div data-block="card">
    <button id="primary-cta">Click</button>
  </div>
</section>
```

E2E 시나리오에서 이 영역을 픽 → 이슈 본문 mock GitHub 페이로드에 `Anchor 체인: Demo → card`, `소스 파일: Demo.tsx` 라인이 포함되는지 검증.

## 9. 마이그레이션 / 호환성

- `PickedElement` / `CollectedData` 신규 필드는 모두 옵셔널 — 기존 storage 의 draft 와 호환.
- 신규 메시지 전송 시에도 panel store / message handler 가 unknown field 를 reject 하지 않음 (조사 완료).
- README "알려진 제한" 의 *"자동 생성 id 의 selector 안정성 낮음"* 항목은 이번 변경으로 해소 — README 도 함께 갱신한다.

## 10. 영향 받지 않는 영역

- `src/background/issue-submit.ts` (본문 markdown 만 사용)
- `src/background/github-api.ts` (payload 통과)
- `src/panel/store.ts` (느슨한 타입, 옵셔널 필드 추가 무영향)
- panel hooks / messaging
- 매핑 / 라우팅 / 토큰 저장 영역

## 11. 참고

- Sentry: From Unreadable CSS Selectors to Clear Component Names (https://blog.sentry.io/improving-developer-experience-from-unreadable-css-selectors-to-clear-component-names)
- swc-plugin-component-annotate (https://github.com/scttcper/swc-plugin-component-annotate)
- optimal-select (https://github.com/autarc/optimal-select)
