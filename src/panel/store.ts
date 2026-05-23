import { create } from 'zustand';
import type {
  BootstrapResponse,
  PickedElement,
  IssueSubmitResult,
  ErrorCode,
} from '@/shared/types';

type Screen =
  | 'BOOTSTRAP'
  | 'NO_MATCH'
  | 'MATCHED.IDLE'
  | 'MATCHED.PICK'
  | 'MATCHED.EDIT'
  | 'SUBMIT'
  | 'TAB_GONE';

interface PanelState {
  screen: Screen;
  tabId: number | null;
  url: string;
  hostOnly: string;
  activeMappingId: string | null;
  allCandidates: string[];

  // selection
  picked: PickedElement | null;
  currentDepth: number;

  // form
  title: string;
  userDescription: string;
  finalBody: string;
  bodyOverridden: boolean;
  collected: {
    ua?: unknown;
    viewport?: unknown;
    consoleErrors?: unknown[];
    networkFailures?: unknown[];
  } | null;

  // status
  lastError: { code: ErrorCode; message: string; retryAfter?: number } | null;
  lastSuccess: { number: number; htmlUrl: string } | null;
}

interface PanelActions {
  onBootstrap(r: BootstrapResponse): void;
  startSelection(): void;
  cancelSelection(): void;
  onPicked(p: PickedElement): void;
  onUpdated(p: PickedElement): void;
  setDepth(d: number): void;
  setTitle(t: string): void;
  setUserDescription(d: string): void;
  setFinalBody(b: string): void;
  enterBodyOverride(): void;
  startSubmit(): void;
  onSubmitSuccess(r: IssueSubmitResult & { ok: true }): void;
  onSubmitFailure(r: IssueSubmitResult & { ok: false }): void;
  dismissToast(): void;
  changeMapping(id: string): void;
  onTabGone(): void;
  resetForm(): void;
}

const initial: PanelState = {
  screen: 'BOOTSTRAP',
  tabId: null,
  url: '',
  hostOnly: '',
  activeMappingId: null,
  allCandidates: [],
  picked: null,
  currentDepth: 0,
  title: '',
  userDescription: '',
  finalBody: '',
  bodyOverridden: false,
  collected: null,
  lastError: null,
  lastSuccess: null,
};

export const usePanelStore = create<PanelState & PanelActions>((set) => ({
  ...initial,
  onBootstrap(r) {
    set({
      tabId: r.tabId,
      url: r.url,
      hostOnly: r.hostOnly,
      activeMappingId: r.activeMappingId,
      allCandidates: r.allCandidates,
      screen: r.activeMappingId ? 'MATCHED.IDLE' : 'NO_MATCH',
    });
  },
  startSelection() {
    set({ screen: 'MATCHED.PICK', picked: null });
  },
  cancelSelection() {
    set({ screen: 'MATCHED.IDLE' });
  },
  onPicked(p) {
    set({ picked: p, currentDepth: p.currentDepth, screen: 'MATCHED.EDIT' });
  },
  onUpdated(p) {
    set({ picked: p, currentDepth: p.currentDepth });
  },
  setDepth(d) {
    set({ currentDepth: d });
  },
  setTitle(t) {
    set({ title: t });
  },
  setUserDescription(d) {
    set({ userDescription: d });
  },
  setFinalBody(b) {
    set({ finalBody: b });
  },
  enterBodyOverride() {
    set({ bodyOverridden: true });
  },
  startSubmit() {
    set({ screen: 'SUBMIT', lastError: null });
  },
  onSubmitSuccess(r) {
    set({
      screen: 'MATCHED.IDLE',
      title: '',
      userDescription: '',
      finalBody: '',
      bodyOverridden: false,
      picked: null,
      currentDepth: 0,
      collected: null,
      lastSuccess: { number: r.number, htmlUrl: r.htmlUrl },
      lastError: null,
    });
  },
  onSubmitFailure(r) {
    set({ screen: 'MATCHED.EDIT', lastError: r });
  },
  dismissToast() {
    set({ lastSuccess: null });
  },
  changeMapping(id) {
    set({ activeMappingId: id });
  },
  onTabGone() {
    set({ screen: 'TAB_GONE' });
  },
  resetForm() {
    set({
      title: '',
      userDescription: '',
      finalBody: '',
      bodyOverridden: false,
      picked: null,
      currentDepth: 0,
      collected: null,
      lastError: null,
    });
  },
}));
