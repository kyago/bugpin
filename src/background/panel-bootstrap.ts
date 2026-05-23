import type { BootstrapResponse } from '@/shared/types';
import { loadMappings } from './mapping-store';
import { pickBestMapping, candidateMappings } from '@/lib/pick-mapping';
import { normalizeUrl } from '@/lib/url-pattern';

export async function handleBootstrap(tabId: number, url: string): Promise<BootstrapResponse> {
  const mappings = await loadMappings();
  const best = pickBestMapping(mappings, url);
  const cands = candidateMappings(mappings, url);
  return {
    activeMappingId: best?.id ?? null,
    allCandidates: cands,
    tabId,
    url,
    hostOnly: normalizeUrl(url),
  };
}
