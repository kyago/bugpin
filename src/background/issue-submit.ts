import type { IssueDraft, IssueSubmitResult } from '@/shared/types';
import { ghCreateIssue } from './github-api';
import { getMapping } from './mapping-store';
import { SUBMIT_THROTTLE_MS } from '@/shared/constants';

let lastSubmitAt = 0;
const queue: (() => void)[] = [];
let processing = false;

export function _resetThrottle() { lastSubmitAt = 0; queue.length = 0; processing = false; }

async function waitTurn(): Promise<void> {
  return new Promise(resolve => {
    queue.push(resolve);
    if (!processing) drain();
  });
}

async function drain(): Promise<void> {
  processing = true;
  while (queue.length > 0) {
    const next = queue.shift()!;
    const wait = Math.max(0, lastSubmitAt + SUBMIT_THROTTLE_MS - Date.now());
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
    lastSubmitAt = Date.now();
    next();
  }
  processing = false;
}

export async function handleIssueSubmit(draft: IssueDraft): Promise<IssueSubmitResult> {
  const m = await getMapping(draft.mappingId);
  if (!m) {
    return { ok: false, code: 'not_found', message: '매핑을 찾을 수 없어요' };
  }
  await waitTurn();
  return ghCreateIssue(m.token, m.repo, draft.title, draft.finalBody);
}
