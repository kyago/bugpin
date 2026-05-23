import type { TokenTestResult } from '@/shared/types';
import { ghCheckAuth, ghCheckRepo } from './github-api';
import { getMapping, touchVerified } from './mapping-store';

export async function handleTokenTest(mappingId: string): Promise<TokenTestResult> {
  const m = await getMapping(mappingId);
  if (!m) {
    return { ok: false, step: 'auth', status: 0, message: '매핑을 찾을 수 없어요' };
  }
  const auth = await ghCheckAuth(m.token);
  if (auth.status !== 200) {
    return { ok: false, step: 'auth', status: auth.status,
             message: auth.status === 0 ? '네트워크 오류' : `인증 실패 (HTTP ${auth.status})` };
  }
  const repo = await ghCheckRepo(m.token, m.repo);
  if (repo.status !== 200) {
    return { ok: false, step: 'repo', status: repo.status,
             message: repo.status === 0 ? '네트워크 오류' : `레포 접근 불가 (HTTP ${repo.status})` };
  }
  const now = Date.now();
  await touchVerified(mappingId, now);
  return { ok: true, repo: m.repo, verifiedAt: now };
}
