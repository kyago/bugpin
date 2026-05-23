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
