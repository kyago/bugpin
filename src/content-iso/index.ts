import { Buffers, ingestMessage } from './buffer';
import { SelectionMode } from './selection-mode';
import { captureUserAgent } from '@/lib/ua-parse';
import { scrubPii } from '@/lib/sanitize-pii';
import type { PanelToContent, ContentToPanel, CapturedSnapshot } from '@/shared/types';

console.debug('[qa-ext content-iso] router initialized on', window.location.href);

const buf = new Buffers();
let selection: SelectionMode | null = null;

// === MAIN-world postMessage receiver ===
window.addEventListener('message', (e) => {
  if (e.source !== window) return;
  if (e.origin !== window.location.origin) return;
  ingestMessage(buf, e.data);
});

// === panel messages (relayed via background) ===
chrome.runtime.onMessage.addListener((msg: PanelToContent, _sender, sendResponse) => {
  console.debug('[qa-ext content-iso] received:', msg);
  switch (msg.kind) {
    case 'selection.start': {
      console.debug('[qa-ext content-iso] starting selection mode');
      ensureSelection();
      selection!.start();
      sendResponse({ ok: true });
      return false;
    }
    case 'selection.cancel': {
      selection?.stop();
      sendResponse({ ok: true });
      return false;
    }
    case 'selection.depthChange': {
      const payload = selection?.setDepth(msg.depth);
      if (payload) relay({ kind: 'selection.updated', payload });
      sendResponse({ ok: true });
      return false;
    }
    case 'capture.snapshot': {
      buildSnapshot().then(snap => {
        sendResponse({ kind: 'capture.snapshot.result', payload: snap });
      });
      return true; // keep channel open for async
    }
  }
  return false;
});

function ensureSelection() {
  if (selection) return;
  selection = new SelectionMode({
    onPicked: (payload) => relay({ kind: 'selection.picked', payload }),
    onCancelled: () => relay({ kind: 'selection.cancelled' }),
  });
}

function relay(msg: ContentToPanel) {
  chrome.runtime.sendMessage({ kind: 'content.relay', payload: msg }).catch(() => {});
}

async function buildSnapshot(): Promise<CapturedSnapshot> {
  const ua = await captureUserAgent();
  return {
    url: scrubPii(window.location.href),
    viewport: { w: window.innerWidth, h: window.innerHeight },
    ua,
    consoleErrors: structuredClone(buf.consoleErrors),
    networkFailures: structuredClone(buf.networkFailures.map(n => ({
      ...n, url: scrubPii(n.url),
    }))),
    capturedAt: Date.now(),
  };
}
