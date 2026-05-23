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
