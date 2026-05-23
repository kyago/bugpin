import { describe, it, expect, beforeEach } from 'vitest';
import chrome from 'sinon-chrome';
import { bindTab, getBoundTab, watchTabClosed, rebindToActive } from '@/background/routing';

beforeEach(() => { chrome.flush(); });

describe('routing', () => {
  it('bindTab / getBoundTab', () => {
    bindTab(42, 'https://x.com');
    expect(getBoundTab()).toEqual({ tabId: 42, url: 'https://x.com' });
  });

  it('watchTabClosed fires when bound tab closes', () => {
    bindTab(42, 'https://x.com');
    let firedId: number | null = null;
    watchTabClosed((tabId) => { firedId = tabId; });
    // Simulate Chrome firing the listener
    const listener = chrome.tabs.onRemoved.addListener.firstCall.args[0];
    listener(42);
    expect(firedId).toBe(42);
    expect(getBoundTab()).toBeNull();
  });

  it('watchTabClosed does not fire for unrelated tab', () => {
    bindTab(42, 'https://x.com');
    let firedId: number | null = null;
    watchTabClosed((tabId) => { firedId = tabId; });
    const listener = chrome.tabs.onRemoved.addListener.firstCall.args[0];
    listener(99);
    expect(firedId).toBeNull();
    expect(getBoundTab()).not.toBeNull();
  });
});
