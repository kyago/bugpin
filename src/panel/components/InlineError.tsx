import { usePanelStore } from '../store';

const MESSAGES: Record<string, string> = {
  auth: '토큰이 만료되었거나 잘못되었어요.',
  forbidden: 'Issues 쓰기 권한이 없어요. fine-grained PAT 의 "Issues: Write" 권한을 확인하세요.',
  rate_limit: 'GitHub API 사용량 초과.',
  not_found:
    '이슈 등록 실패 (404). 가능한 원인:\n' +
    '① 레포 경로 오타 (owner/repo 형식 확인)\n' +
    '② 토큰의 "Issues" 권한이 Read-only — Read and write 로 재발급 필요\n' +
    '③ 레포의 Issues 기능이 비활성화됨 (레포 Settings → Features → Issues 체크)',
  validation: '이슈 형식이 잘못되었어요. 제목/본문을 확인하세요.',
  network: '네트워크 연결 실패.',
  unknown: '알 수 없는 오류.',
};

export function InlineError() {
  const { lastError } = usePanelStore();
  if (!lastError) return null;
  const msg = MESSAGES[lastError.code] ?? lastError.message;
  const retry = lastError.retryAfter
    ? ` (약 ${Math.ceil(lastError.retryAfter / 60)}분 후 재시도 가능)` : '';
  // Show GitHub's actual response body alongside our canned message when present
  const apiDetail = lastError.message && lastError.message.trim().length > 0
    ? lastError.message
    : null;
  return (
    <div className="inline-error">
      <div className="inline-error-title">⚠️ {msg.split('\n')[0]}{retry}</div>
      {msg.includes('\n') && (
        <ul className="inline-error-causes">
          {msg.split('\n').slice(1).map((line, i) => <li key={i}>{line}</li>)}
        </ul>
      )}
      {apiDetail && (
        <details className="inline-error-detail">
          <summary>GitHub 응답 상세</summary>
          <pre>{apiDetail}</pre>
        </details>
      )}
      {(lastError.code === 'auth' || lastError.code === 'forbidden' || lastError.code === 'not_found') && (
        <button onClick={() => chrome.runtime.openOptionsPage()}>설정 열기</button>
      )}
    </div>
  );
}
