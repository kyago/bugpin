import { useEffect, useMemo } from 'react';
import { usePanelStore } from '../store';
import { sendToBg, sendToContent } from '../hooks/useMessaging';
import { formatIssueBody, applyBodyBudget } from '@/lib/format-body';
import { BODY_BUDGET, BODY_WARN_THRESHOLD } from '@/shared/constants';
import type { IssueDraft, IssueSubmitResult, CollectedData } from '@/shared/types';

export function IssueForm() {
  const s = usePanelStore();
  const isActive = s.screen === 'MATCHED.EDIT' || s.screen === 'SUBMIT';

  // All hooks MUST be called unconditionally (React rules). Conditional return
  // belongs AFTER all hooks. Inactive states simply make hook bodies no-op.

  // Refresh collected snapshot whenever we enter EDIT with a picked element
  useEffect(() => {
    if (!isActive || !s.picked) return;
    sendToContent({ kind: 'capture.snapshot' }).then((res: unknown) => {
      const r = res as { ok?: boolean; payload?: { kind: string; payload: unknown } };
      if (r?.ok && r.payload?.kind === 'capture.snapshot.result') {
        usePanelStore.setState({ collected: r.payload.payload as CollectedData });
      }
    }).catch(() => { /* content script may be unreachable; ignore */ });
  }, [isActive, s.picked?.selector]);

  const finalBody = useMemo(() => {
    if (!isActive) return '';
    if (s.bodyOverridden) return s.finalBody;
    if (!s.picked || !s.collected) return '';
    const collected: CollectedData = {
      ...(s.collected as unknown as CollectedData),
      selectedDepth: s.currentDepth,
      selector: s.picked.selector,
      parentChainSummary: s.picked.parentChainSummary,
      outerHTML: s.picked.outerHTML,
      anchorChain: s.picked.anchorChain,
      sourceFile: s.picked.sourceFile,
    };
    return applyBodyBudget(formatIssueBody(s.userDescription, collected));
  }, [isActive, s.userDescription, s.collected, s.picked, s.currentDepth, s.bodyOverridden, s.finalBody]);

  useEffect(() => {
    if (!isActive) return;
    if (!s.bodyOverridden) usePanelStore.setState({ finalBody });
  }, [isActive, finalBody, s.bodyOverridden]);

  if (!isActive) return null;

  const onSubmit = async () => {
    if (!s.activeMappingId || !s.picked || !s.collected) return;
    if (!s.title.trim() || !s.userDescription.trim()) return;
    usePanelStore.getState().startSubmit();
    const draft: IssueDraft = {
      mappingId: s.activeMappingId,
      title: s.title,
      userDescription: s.userDescription,
      collected: {
        ...(s.collected as unknown as CollectedData),
        selectedDepth: s.currentDepth,
        selector: s.picked.selector,
        parentChainSummary: s.picked.parentChainSummary,
        outerHTML: s.picked.outerHTML,
        anchorChain: s.picked.anchorChain,
        sourceFile: s.picked.sourceFile,
      } as CollectedData,
      finalBody: s.finalBody,
      bodyOverridden: s.bodyOverridden,
    };
    const result = await sendToBg<IssueSubmitResult>({ kind: 'issue.submit', payload: draft });
    if (result.ok) usePanelStore.getState().onSubmitSuccess(result);
    else usePanelStore.getState().onSubmitFailure(result);
  };

  const size = (s.finalBody ?? '').length;
  const sizeClass = size > BODY_BUDGET ? 'red' : (size > BODY_WARN_THRESHOLD ? 'yellow' : '');

  return (
    <>
      <input
        className="title-input"
        placeholder="제목 (예: 카드 배경색 깨짐)"
        value={s.title}
        maxLength={80}
        onChange={(e) => s.setTitle(e.target.value)}
      />
      <textarea
        className="desc-textarea"
        placeholder="어떻게 깨졌나요? 무슨 동작을 했을 때 발생했나요?"
        value={s.userDescription}
        rows={4}
        onChange={(e) => s.setUserDescription(e.target.value)}
      />

      <div className="collected-summary">
        ✓ 콘솔 {(s.collected as { consoleErrors?: unknown[] } | null)?.consoleErrors?.length ?? 0} ·
        ✓ 네트워크 {(s.collected as { networkFailures?: unknown[] } | null)?.networkFailures?.length ?? 0} ·
        ✓ HTML {(s.picked?.outerHTML?.length ?? 0)}자
      </div>

      <details
        open={s.bodyOverridden}
        onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) s.enterBodyOverride(); }}
      >
        <summary>📝 본문 편집</summary>
        {s.bodyOverridden && (
          <p className="hint">직접 편집하면 자동 정보가 다시 갱신되지 않아요</p>
        )}
        <textarea
          className="body-editor"
          value={s.bodyOverridden ? s.finalBody : finalBody}
          rows={12}
          onChange={(e) => { s.enterBodyOverride(); s.setFinalBody(e.target.value); }}
        />
      </details>

      <div className="submit-bar">
        <span className={`size ${sizeClass}`}>{size.toLocaleString()} / {BODY_BUDGET.toLocaleString()}자</span>
        <button
          className="submit"
          disabled={s.screen === 'SUBMIT' || !s.title.trim() || !s.userDescription.trim()}
          onClick={onSubmit}
        >
          {s.screen === 'SUBMIT' ? '⏳ 등록 중...' : 'GitHub에 등록 →'}
        </button>
      </div>
    </>
  );
}
