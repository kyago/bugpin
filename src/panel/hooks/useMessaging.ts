import { useEffect } from 'react';
import { usePanelStore } from '../store';
import type { BgToPanel, ContentToPanel } from '@/shared/types';

export function useMessaging(): void {
  const store = usePanelStore.getState;

  useEffect(() => {
    const listener = (msg: BgToPanel) => {
      if (msg.kind === 'tab.gone') {
        store().onTabGone();
        return;
      }
      if (msg.kind === 'content.relay') {
        const inner = msg.payload as ContentToPanel;
        if (inner.kind === 'selection.picked') store().onPicked(inner.payload);
        if (inner.kind === 'selection.updated') store().onUpdated(inner.payload);
        if (inner.kind === 'selection.cancelled') store().cancelSelection();
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    return () => chrome.runtime.onMessage.removeListener(listener);
  }, []);
}

export async function sendToBg<T = unknown>(msg: unknown): Promise<T> {
  return chrome.runtime.sendMessage(msg);
}

export async function sendToContent(msg: unknown): Promise<unknown> {
  return chrome.runtime.sendMessage({ kind: 'forward.toContent', payload: msg });
}
