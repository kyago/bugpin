import type { ConsoleErrorEntry, NetworkFailureEntry, MainToIsoMessage } from '@/shared/types';
import { POST_MESSAGE_SOURCE } from '@/shared/constants';
import { dedupePush } from '@/lib/ring-buffer';

export class Buffers {
  consoleErrors: ConsoleErrorEntry[] = [];
  networkFailures: NetworkFailureEntry[] = [];
}

export function ingestMessage(buf: Buffers, raw: unknown): void {
  if (!raw || typeof raw !== 'object') return;
  const msg = raw as Partial<MainToIsoMessage>;
  if (msg.__qaSource !== POST_MESSAGE_SOURCE) return;
  if (msg.kind === 'console.error' && msg.entry) {
    dedupePush(buf.consoleErrors, { ...msg.entry, count: 1 });
  } else if (msg.kind === 'network.failure' && msg.entry) {
    dedupePush(buf.networkFailures, { ...msg.entry, count: 1 });
  }
}
