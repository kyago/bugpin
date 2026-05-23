import { create } from 'zustand';
import type { Mapping } from '@/shared/types';

interface OptionsState {
  mappings: Mapping[];
  dirty: Record<string, boolean>; // mapping id → unsaved?
  prefillHost: string | null;
  testResults: Record<string, { ok: boolean; message: string; at: number }>;
}

interface OptionsActions {
  load(): Promise<void>;
  upsertLocal(m: Mapping): void;
  markDirty(id: string, dirty: boolean): void;
  removeLocal(id: string): void;
  setTestResult(id: string, r: { ok: boolean; message: string }): void;
  setPrefillHost(h: string | null): void;
}

export const useOptionsStore = create<OptionsState & OptionsActions>((set, get) => ({
  mappings: [],
  dirty: {},
  prefillHost: null,
  testResults: {},

  async load() {
    const raw = await chrome.storage.local.get('qaExt');
    const schema = raw?.qaExt;
    const mappings: Mapping[] = (schema && schema.schemaVersion === 1) ? schema.mappings : [];
    type SessionLike = { get?: (k: string) => Promise<Record<string, unknown>>; remove?: (k: string) => Promise<void> };
    const sessionApi = (chrome.storage as unknown as { session?: SessionLike }).session;
    let prefillHost: string | null = null;
    if (sessionApi?.get) {
      try {
        const r = await sessionApi.get('prefillHost');
        prefillHost = (r?.prefillHost as string) ?? null;
        if (prefillHost) await sessionApi.remove?.('prefillHost');
      } catch { /* ignore */ }
    }
    set({ mappings, prefillHost });
  },

  upsertLocal(m) {
    const list = [...get().mappings];
    const idx = list.findIndex(x => x.id === m.id);
    if (idx >= 0) list[idx] = m; else list.push(m);
    set({ mappings: list });
  },

  markDirty(id, dirty) {
    const d = { ...get().dirty };
    if (dirty) d[id] = true; else delete d[id];
    set({ dirty: d });
  },

  removeLocal(id) {
    set({ mappings: get().mappings.filter(m => m.id !== id) });
  },

  setTestResult(id, r) {
    set({ testResults: { ...get().testResults, [id]: { ...r, at: Date.now() } } });
  },

  setPrefillHost(h) { set({ prefillHost: h }); },
}));
