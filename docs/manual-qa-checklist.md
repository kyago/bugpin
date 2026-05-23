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
