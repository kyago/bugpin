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
          let bound = getBoundTab();
          if (!bound) bound = await rebindToActive();
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
          // Try bound tab first; if missing or unreachable, fall back to active tab
          // (service worker may have restarted, losing module-level bound state).
          let bound = getBoundTab();
          if (!bound) {
            console.debug('[qa-ext bg] no bound tab, re-binding to active');
            bound = await rebindToActive();
          }
          if (!bound) {
            console.warn('[qa-ext bg] forward.toContent FAILED: no active tab');
            sendResponse({ ok: false, code: 'no_tab' });
            return;
          }
          console.debug('[qa-ext bg] forward.toContent', { bound, payload: msg.payload });
          try {
            const resp = await chrome.tabs.sendMessage(bound.tabId, msg.payload);
            console.debug('[qa-ext bg] forward.toContent OK, resp:', resp);
            sendResponse({ ok: true, payload: resp });
          } catch (err) {
            console.warn('[qa-ext bg] forward.toContent THREW (content script not loaded — page needs refresh):', err);
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
