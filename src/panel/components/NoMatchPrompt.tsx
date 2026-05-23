import { usePanelStore } from '../store';

export function NoMatchPrompt() {
  const { screen, hostOnly } = usePanelStore();
  if (screen !== 'NO_MATCH') return null;
  const openOptions = (prefill: boolean) => {
    chrome.runtime.openOptionsPage();
    // Note: openOptionsPage doesn't pass URL params; prefill happens via storage instead.
    // For MVP we set a session storage key that Options page reads on mount.
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
