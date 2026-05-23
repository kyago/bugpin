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
