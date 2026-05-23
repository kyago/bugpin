import type { PanelToBg, BgToPanel, BootstrapResponse } from '@/shared/types';
import { handleBootstrap } from './panel-bootstrap';
import { handleIssueSubmit } from './issue-submit';
import { handleTokenTest } from './token-test';
import { saveMapping, deleteMapping } from './mapping-store';
import { bindTab, getBoundTab, rebindToActive, watchTabClosed } from './routing';

console.debug('[qa-ext] background worker booted');

// sidePanel.open() must be called synchronously inside the user-gesture handler;
// awaiting anything before it loses the gesture context and the call fails silently.
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  if (tab.url) bindTab(tab.id, tab.url);
  chrome.sidePanel.open({ tabId: tab.id }).catch((err) => {
    console.error('[qa-ext] sidePanel.open failed:', err);
  });
});

chrome.runtime.onMessage.addListener((msg: PanelToBg, _sender, sendResponse) => {
  (async () => {
    try {
      switch (msg.kind) {
        case 'panel.bootstrap': {
          const bound = getBoundTab();
          if (!bound) { sendResponse({ ok: false, code: 'no_tab' }); return; }
          const result: BootstrapResponse = await handleBootstrap(bound.tabId, bound.url);
          sendResponse({ ok: true, payload: result });
          return;
        }
        case 'issue.submit': {
          const result = await handleIssueSubmit(msg.payload);
          sendResponse(result);
          return;
        }
        case 'token.test': {
          const result = await handleTokenTest(msg.mappingId);
          sendResponse(result);
          return;
        }
        case 'mapping.save': {
          await saveMapping(msg.mapping);
          sendResponse({ ok: true });
          return;
        }
        case 'mapping.delete': {
          await deleteMapping(msg.id);
          sendResponse({ ok: true });
          return;
        }
        case 'tab.rebind': {
          const bound = await rebindToActive();
          sendResponse({ ok: !!bound, payload: bound });
          return;
        }
        case 'forward.toContent': {
          const bound = getBoundTab();
          if (!bound) { sendResponse({ ok: false, code: 'no_tab' }); return; }
          try {
            const resp = await chrome.tabs.sendMessage(bound.tabId, msg.payload);
            sendResponse({ ok: true, payload: resp });
          } catch {
            sendResponse({ ok: false, code: 'tab_gone' });
          }
          return;
        }
      }
    } catch (err) {
      sendResponse({ ok: false, code: 'unknown', message: String(err) });
    }
  })();
  return true; // async response
});

// Relay content-script messages (selection.picked etc.) back to panel
chrome.runtime.onMessage.addListener((msg: any) => {
  if (msg?.kind === 'content.relay') {
    chrome.runtime.sendMessage<BgToPanel>({ kind: 'content.relay', payload: msg.payload }).catch(() => {});
  }
});

// Detect tab close and notify panel
watchTabClosed((_tabId) => {
  chrome.runtime.sendMessage<BgToPanel>({ kind: 'tab.gone' }).catch(() => {});
});
