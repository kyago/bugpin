import { useState } from 'react';
import type { Mapping } from '@/shared/types';
import { useOptionsStore } from '../store';

interface Props { mapping: Mapping; }

export function MappingRow({ mapping }: Props) {
  const [draft, setDraft] = useState<Mapping>(mapping);
  const [showToken, setShowToken] = useState(false);
  const { dirty, testResults, markDirty, removeLocal, setTestResult, upsertLocal } = useOptionsStore();

  const isDirty = !!dirty[mapping.id];
  const tr = testResults[mapping.id];

  const update = <K extends keyof Mapping>(key: K, value: Mapping[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }));
    markDirty(mapping.id, true);
  };

  const onSave = async () => {
    await chrome.runtime.sendMessage({ kind: 'mapping.save', mapping: draft });
    upsertLocal(draft);
    markDirty(mapping.id, false);
  };

  const onDelete = async () => {
    if (!confirm(`매핑 "${mapping.name}" 을 삭제할까요?`)) return;
    await chrome.runtime.sendMessage({ kind: 'mapping.delete', id: mapping.id });
    removeLocal(mapping.id);
  };

  const onTest = async () => {
    if (isDirty) { alert('먼저 저장해주세요'); return; }
    const result = await chrome.runtime.sendMessage({ kind: 'token.test', mappingId: mapping.id });
    if (result.ok) setTestResult(mapping.id, { ok: true, message: `✅ ${result.repo} 접근 가능` });
    else setTestResult(mapping.id, { ok: false, message: `❌ ${result.message} (step: ${result.step})` });
  };

  const useCurrentDomain = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url) {
      try {
        const host = new URL(tab.url).host;
        update('urlPatterns', [host]);
      } catch { /* ignore non-URL tabs */ }
    }
  };

  return (
    <div className="mapping-row">
      <div className="row-header">
        <input className="name" value={draft.name} onChange={(e) => update('name', e.target.value)} placeholder="이름" />
        <div>
          <button onClick={onTest}>🔍 토큰 테스트</button>
          <button className="danger" onClick={onDelete}>삭제</button>
        </div>
      </div>

      <label>URL 패턴 (쉼표 구분)</label>
      <input value={draft.urlPatterns.join(', ')}
             onChange={(e) => update('urlPatterns', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
      <button className="link" onClick={useCurrentDomain}>현재 도메인 사용</button>

      <label>레포 (owner/name)</label>
      <input value={draft.repo} onChange={(e) => update('repo', e.target.value)} />

      <label>토큰</label>
      <div className="token-row">
        <input type={showToken ? 'text' : 'password'} value={draft.token}
               onChange={(e) => update('token', e.target.value)} />
        <button onClick={() => setShowToken(!showToken)}>{showToken ? '숨기기' : '표시'}</button>
      </div>
      <a href="https://github.com/settings/personal-access-tokens" target="_blank" rel="noreferrer">
        fine-grained PAT 발급 가이드 →
      </a>

      {tr && <div className={`test-result ${tr.ok ? 'ok' : 'err'}`}>{tr.message}</div>}
      {mapping.lastVerifiedAt && <div className="muted">마지막 검증: {new Date(mapping.lastVerifiedAt).toLocaleString()}</div>}

      <button className={`save ${isDirty ? 'dirty' : ''}`} disabled={!isDirty} onClick={onSave}>
        저장
      </button>
    </div>
  );
}
