import { usePanelStore } from '../store';
import { sendToContent } from '../hooks/useMessaging';

type ForwardResult = { ok: boolean; code?: string; payload?: unknown };

function describeForwardError(code: string | undefined): string {
  if (code === 'no_tab') {
    return '연결된 탭이 없어요. 확장 아이콘을 다시 클릭해서 패널을 여세요.';
  }
  if (code === 'tab_gone') {
    return '페이지가 응답하지 않아요. **페이지를 새로고침(F5)** 한 뒤 다시 시도해주세요. (확장 설치/리로드 후 처음 여는 탭이면 새로고침이 필요합니다.)';
  }
  return '확장과 페이지 사이 통신 실패. 페이지를 새로고침 해주세요.';
}

export function SelectionPanel() {
  const { screen, picked, currentDepth, setDepth } = usePanelStore();
  if (screen === 'BOOTSTRAP' || screen === 'NO_MATCH' || screen === 'TAB_GONE') return null;

  const onPickClick = async () => {
    if (screen === 'MATCHED.PICK') {
      await sendToContent({ kind: 'selection.cancel' }).catch(() => {});
      usePanelStore.getState().cancelSelection();
      return;
    }
    // Optimistically switch to PICK state, but verify the message reached the content script.
    usePanelStore.getState().startSelection();
    const result = (await sendToContent({ kind: 'selection.start' }).catch(() => null)) as ForwardResult | null;
    if (!result || result.ok === false) {
      usePanelStore.getState().cancelSelection();
      usePanelStore.getState().onSubmitFailure({
        ok: false,
        code: 'network',
        message: describeForwardError(result?.code),
      });
    }
  };

  const onDepthChange = (d: number) => {
    setDepth(d);
    sendToContent({ kind: 'selection.depthChange', depth: d }).catch(() => {});
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
