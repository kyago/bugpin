import type { ConsoleErrorEntry, NetworkFailureEntry } from '@/shared/types';
import { BUFFER_MAX, DEDUP_PREFIX_LEN } from '@/shared/constants';

type DedupEntry = ConsoleErrorEntry | NetworkFailureEntry;

export function dedupePush<T extends DedupEntry>(buf: T[], next: T): void {
  const last = buf[buf.length - 1];
  if (last && matchesLast(last, next)) {
    last.count += 1;
    last.timestamp = next.timestamp;
    return;
  }
  buf.push(next);
  if (buf.length > BUFFER_MAX) buf.shift();
}

function matchesLast(a: DedupEntry, b: DedupEntry): boolean {
  if ('message' in a && 'message' in b) {
    return a.source === b.source
      && a.message.slice(0, DEDUP_PREFIX_LEN) === b.message.slice(0, DEDUP_PREFIX_LEN);
  }
  if ('url' in a && 'url' in b) {
    return a.method === b.method && a.url === b.url && a.status === b.status;
  }
  return false;
}
