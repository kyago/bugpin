import { describe, it, expect, beforeEach } from 'vitest';
import { usePanelStore } from '@/panel/store';

beforeEach(() => {
  usePanelStore.setState(usePanelStore.getInitialState(), true);
});

describe('panel store', () => {
  it('starts in BOOTSTRAP', () => {
    expect(usePanelStore.getState().screen).toBe('BOOTSTRAP');
  });

  it('transitions BOOTSTRAP → MATCHED.IDLE on bootstrap with match', () => {
    usePanelStore.getState().onBootstrap({
      activeMappingId: 'a', allCandidates: ['a'], tabId: 1, url: 'https://x.com', hostOnly: 'x.com',
    });
    const s = usePanelStore.getState();
    expect(s.screen).toBe('MATCHED.IDLE');
    expect(s.activeMappingId).toBe('a');
  });

  it('transitions to NO_MATCH when no mapping', () => {
    usePanelStore.getState().onBootstrap({
      activeMappingId: null, allCandidates: [], tabId: 1, url: 'https://x.com', hostOnly: 'x.com',
    });
    expect(usePanelStore.getState().screen).toBe('NO_MATCH');
  });

  it('enters PICK on startSelection', () => {
    usePanelStore.getState().onBootstrap({
      activeMappingId: 'a', allCandidates: ['a'], tabId: 1, url: 'https://x.com', hostOnly: 'x.com',
    });
    usePanelStore.getState().startSelection();
    expect(usePanelStore.getState().screen).toBe('MATCHED.PICK');
  });

  it('PICK → EDIT on selectionPicked', () => {
    usePanelStore.getState().onBootstrap({
      activeMappingId: 'a', allCandidates: ['a'], tabId: 1, url: 'https://x.com', hostOnly: 'x.com',
    });
    usePanelStore.getState().startSelection();
    usePanelStore.getState().onPicked({
      selector: '#x', outerHTML: '<div/>', parentChainSummary: ['div'], maxDepth: 0, currentDepth: 0,
    });
    expect(usePanelStore.getState().screen).toBe('MATCHED.EDIT');
  });

  it('resets form on successful submit', () => {
    const s = usePanelStore.getState();
    s.onBootstrap({ activeMappingId: 'a', allCandidates: ['a'], tabId: 1, url: '', hostOnly: '' });
    s.startSelection();
    s.onPicked({ selector: '#x', outerHTML: '<div/>', parentChainSummary: ['div'], maxDepth: 0, currentDepth: 0 });
    s.setTitle('T'); s.setUserDescription('D');
    s.onSubmitSuccess({ ok: true, number: 1, htmlUrl: 'https://x' });
    const after = usePanelStore.getState();
    expect(after.screen).toBe('MATCHED.IDLE');
    expect(after.title).toBe('');
    expect(after.userDescription).toBe('');
  });

  it('preserves form on submit failure', () => {
    const s = usePanelStore.getState();
    s.onBootstrap({ activeMappingId: 'a', allCandidates: ['a'], tabId: 1, url: '', hostOnly: '' });
    s.startSelection();
    s.onPicked({ selector: '#x', outerHTML: '<div/>', parentChainSummary: ['div'], maxDepth: 0, currentDepth: 0 });
    s.setTitle('T'); s.setUserDescription('D');
    s.onSubmitFailure({ ok: false, code: 'auth', message: 'oops' });
    const after = usePanelStore.getState();
    expect(after.screen).toBe('MATCHED.EDIT');
    expect(after.title).toBe('T');
    expect(after.lastError?.code).toBe('auth');
  });

  it('TAB_GONE transition from any state', () => {
    usePanelStore.getState().onTabGone();
    expect(usePanelStore.getState().screen).toBe('TAB_GONE');
  });
});
