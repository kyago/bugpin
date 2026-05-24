import { useEffect } from 'react';
import { useOptionsStore } from './store';
import { MappingRow } from './components/MappingRow';
import type { Mapping } from '@/shared/types';

function newMapping(host?: string | null): Mapping {
  return {
    id: crypto.randomUUID(),
    name: host ?? '새 매핑',
    urlPatterns: host ? [host] : [],
    repo: '',
    token: '',
    lastVerifiedAt: null,
    createdAt: Date.now(),
  };
}

export function OptionsApp() {
  const { mappings, prefillHost, load, upsertLocal, markDirty, setPrefillHost } = useOptionsStore();

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (prefillHost) {
      const m = newMapping(prefillHost);
      upsertLocal(m);
      markDirty(m.id, true);
      setPrefillHost(null);
    }
  }, [prefillHost]);

  const addBlank = () => {
    const m = newMapping();
    upsertLocal(m);
    markDirty(m.id, true);
  };

  return (
    <div className="options-root">
      <h1>⚙️ Bugpin 설정</h1>
      <div className="threat-notice">
        ⚠️ <strong>위협 모델</strong>: 이 확장은 <code>fetch / XMLHttpRequest / console.error</code> 를 페이지 컨텍스트에서 monkey-patch 합니다.
        동일 origin 의 페이지 스크립트가 캡처된 데이터를 관찰할 수 있어요. <strong>내부 신뢰 앱 전용</strong>입니다.
        토큰은 디스크에 평문 저장됩니다. <strong>fine-grained PAT (Issues: Write 권한, 단일 레포)</strong> 사용을 권장합니다.
      </div>

      <div className="mappings">
        {mappings.map(m => <MappingRow key={m.id} mapping={m} />)}
      </div>

      <button className="add" onClick={addBlank}>＋ 새 매핑 추가</button>
    </div>
  );
}
