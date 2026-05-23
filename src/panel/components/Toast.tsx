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
