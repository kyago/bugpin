interface BoundTab { tabId: number; url: string; }

let bound: BoundTab | null = null;

export function bindTab(tabId: number, url: string): void {
  bound = { tabId, url };
}

export function getBoundTab(): BoundTab | null {
  return bound;
}

export function clearBound(): void {
  bound = null;
}

export async function rebindToActive(): Promise<BoundTab | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url) return null;
  bound = { tabId: tab.id, url: tab.url };
  return bound;
}

export function watchTabClosed(cb: (tabId: number) => void): void {
  chrome.tabs.onRemoved.addListener((tabId) => {
    if (bound?.tabId === tabId) {
      const closed = bound.tabId;
      bound = null;
      cb(closed);
    }
  });
}
