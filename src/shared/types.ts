// ============ Storage ============

export interface StorageSchema {
  schemaVersion: 1;
  mappings: Mapping[];
}

export interface Mapping {
  id: string;
  name: string;
  urlPatterns: string[];
  repo: string;
  token: string;
  lastVerifiedAt: number | null;
  createdAt: number;
}

// ============ Captured Data ============

export interface ConsoleErrorEntry {
  message: string;
  stack?: string;
  timestamp: number;
  source: 'console.error' | 'window.onerror' | 'unhandledrejection';
  count: number;
}

export interface NetworkFailureEntry {
  method: string;
  url: string;
  status: number;
  statusText: string;
  timestamp: number;
  count: number;
}

export interface UAInfo {
  userAgent: string;
  platform: string;
  browser: string;
}

export interface PickedElement {
  selector: string;
  outerHTML: string;
  parentChainSummary: string[];
  maxDepth: number;
  currentDepth: number;
}

export interface CapturedSnapshot {
  url: string;
  viewport: { w: number; h: number };
  ua: UAInfo;
  consoleErrors: ConsoleErrorEntry[];
  networkFailures: NetworkFailureEntry[];
  capturedAt: number;
}

export interface CollectedData extends CapturedSnapshot {
  selectedDepth: number;
  selector: string;
  parentChainSummary: string[];
  outerHTML: string;
}

// ============ Draft / Submit ============

export interface IssueDraft {
  mappingId: string;
  title: string;
  userDescription: string;
  collected: CollectedData;
  finalBody: string;
  bodyOverridden: boolean;
}

export type ErrorCode =
  | 'auth' | 'not_found' | 'forbidden'
  | 'validation' | 'rate_limit' | 'network' | 'unknown';

export type IssueSubmitResult =
  | { ok: true; number: number; htmlUrl: string }
  | { ok: false; code: ErrorCode; message: string; retryAfter?: number };

// ============ Messages ============

export type PanelToBg =
  | { kind: 'panel.bootstrap' }
  | { kind: 'issue.submit'; payload: IssueDraft }
  | { kind: 'token.test'; mappingId: string }
  | { kind: 'mapping.save'; mapping: Mapping }
  | { kind: 'mapping.delete'; id: string }
  | { kind: 'tab.rebind' } // 사용자가 "현재 탭으로 전환" 클릭
  | { kind: 'forward.toContent'; payload: PanelToContent };

export type PanelToContent =
  | { kind: 'selection.start' }
  | { kind: 'selection.cancel' }
  | { kind: 'selection.depthChange'; depth: number }
  | { kind: 'capture.snapshot' };

export type ContentToPanel =
  | { kind: 'selection.picked'; payload: PickedElement }
  | { kind: 'selection.updated'; payload: PickedElement }
  | { kind: 'selection.cancelled' }
  | { kind: 'capture.snapshot.result'; payload: CapturedSnapshot };

export type BgToPanel =
  | { kind: 'tab.gone' }
  | { kind: 'content.relay'; payload: ContentToPanel };

export interface BootstrapResponse {
  activeMappingId: string | null;
  allCandidates: string[]; // mapping ids matching current URL
  tabId: number;
  url: string;
  hostOnly: string;
}

// ============ Page MAIN-world postMessage ============

export type MainToIsoMessage =
  | { __qaSource: 'qa-ext'; kind: 'console.error'; entry: Omit<ConsoleErrorEntry, 'count'> }
  | { __qaSource: 'qa-ext'; kind: 'network.failure'; entry: Omit<NetworkFailureEntry, 'count'> };

// ============ Token Test ============

export type TokenTestResult =
  | { ok: true; repo: string; verifiedAt: number }
  | { ok: false; step: 'auth' | 'repo'; status: number; message: string };
