import { usePanelStore } from '../store';
import { sendToContent } from '../hooks/useMessaging';

export function SelectionPanel() {
  const { screen, picked, currentDepth, setDepth } = usePanelStore();
  if (screen === 'BOOTSTRAP' || screen === 'NO_MATCH' || screen === 'TAB_GONE') return null;

  const onPickClick = () => {
    if (screen === 'MATCHED.PICK') {
      sendToContent({ kind: 'selection.cancel' });
      usePanelStore.getState().cancelSelection();
    } else {
      sendToContent({ kind: 'selection.start' });
      usePanelStore.getState().startSelection();
    }
  };

  const onDepthChange = (d: number) => {
    setDepth(d);
    sendToContent({ kind: 'selection.depthChange', depth: d });
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
