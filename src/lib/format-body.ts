import type { CollectedData } from '@/shared/types';
import { BODY_BUDGET, BODY_CONSOLE_ERRORS_MAX, BODY_NETWORK_FAILURES_MAX,
         BODY_CONSOLE_MESSAGE_CAP, BODY_CONSOLE_STACK_CAP } from '@/shared/constants';
import { wrapInDetails } from './sanitize-html';

export function formatIssueBody(userDescription: string, c: CollectedData): string {
  const parts: string[] = [];
  parts.push(`## 설명\n${userDescription || '(설명 없음)'}\n`);
  parts.push('---');
  parts.push('## 자동 수집 정보');
  parts.push(`- **URL**: ${c.url}`);
  parts.push(`- **선택 범위**: depth +${c.selectedDepth} (${c.parentChainSummary[c.selectedDepth] ?? c.parentChainSummary.at(-1) ?? '?'})`);
  if (c.anchorChain && c.anchorChain.length > 0) {
    parts.push(`- **Anchor 체인**: ${c.anchorChain.join(' → ')}`);
  }
  if (c.sourceFile) {
    parts.push(`- **소스 파일**: ${c.sourceFile}`);
  }
  parts.push(`- **Selector**: \`${c.selector}\``);
  parts.push(`- **브라우저**: ${c.ua.browser} / ${c.ua.platform}`);
  parts.push(`- **뷰포트**: ${c.viewport.w} × ${c.viewport.h}`);
  parts.push(`- **감지 시각**: ${new Date(c.capturedAt).toISOString()}`);
  parts.push('');
  parts.push(wrapInDetails(c.outerHTML));

  if (c.consoleErrors.length > 0) {
    const slice = c.consoleErrors.slice(-BODY_CONSOLE_ERRORS_MAX);
    parts.push(`\n### 콘솔 에러 (${c.consoleErrors.length}건)\n`);
    for (const e of slice) {
      const msg = e.message.slice(0, BODY_CONSOLE_MESSAGE_CAP);
      const cnt = e.count > 1 ? ` ×${e.count}` : '';
      parts.push(`- [${e.source}${cnt}] ${msg}`);
      if (e.stack) parts.push('  ```\n' + e.stack.slice(0, BODY_CONSOLE_STACK_CAP) + '\n  ```');
    }
  }

  if (c.networkFailures.length > 0) {
    const slice = c.networkFailures.slice(-BODY_NETWORK_FAILURES_MAX);
    parts.push(`\n### 네트워크 실패 (${c.networkFailures.length}건)\n`);
    for (const n of slice) {
      const cnt = n.count > 1 ? ` ×${n.count}` : '';
      parts.push(`- ${n.method} ${n.url} → ${n.status} ${n.statusText}${cnt}`);
    }
  }

  return parts.join('\n');
}

export function applyBodyBudget(body: string): string {
  if (body.length <= BODY_BUDGET) return body;
  const footer = '\n\n_(사용자 입력 일부 생략)_';
  return body.slice(0, BODY_BUDGET - footer.length) + footer;
}
