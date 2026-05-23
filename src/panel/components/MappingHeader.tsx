import { usePanelStore } from '../store';

export function MappingHeader() {
  const { activeMappingId, allCandidates, screen, changeMapping } = usePanelStore();
  if (screen === 'BOOTSTRAP' || screen === 'NO_MATCH' || screen === 'TAB_GONE') return null;
  if (!activeMappingId) return null;
  return (
    <div className="mapping-header">
      <strong>📌 {activeMappingId}</strong>
      {allCandidates.length > 1 && (
        <select value={activeMappingId} onChange={(e) => changeMapping(e.target.value)}>
          {allCandidates.map(id => <option key={id} value={id}>{id}</option>)}
        </select>
      )}
    </div>
  );
}
