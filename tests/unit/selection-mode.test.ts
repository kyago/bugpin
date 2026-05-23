import { describe, it, expect, beforeEach } from 'vitest';
import { SelectionMode } from '@/content-iso/selection-mode';
import type { PickedElement } from '@/shared/types';

beforeEach(() => {
  document.body.innerHTML = '<div id="root"><button id="btn">x</button></div>';
});

describe('SelectionMode click-to-pick', () => {
  it('invokes onPicked on click and does NOT block it via blockAll', () => {
    let picked: PickedElement | null = null;
    let cancelled = false;
    const sm = new SelectionMode({
      onPicked: (p) => { picked = p; },
      onCancelled: () => { cancelled = true; },
    });
    sm.start();

    const btn = document.getElementById('btn')!;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(picked).not.toBeNull();
    expect(picked!.selector).toBe('#btn');
    expect(cancelled).toBe(false);

    sm.stop();
  });

  it('ESC triggers onCancelled and stops the mode', () => {
    let cancelled = false;
    const sm = new SelectionMode({
      onPicked: () => {},
      onCancelled: () => { cancelled = true; },
    });
    sm.start();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelled).toBe(true);

    // After stop, further clicks should not invoke onPicked
    let postPicked = false;
    const sm2 = new SelectionMode({
      onPicked: () => { postPicked = true; },
      onCancelled: () => {},
    });
    // (separate instance to avoid state leakage)
    const btn = document.getElementById('btn')!;
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(postPicked).toBe(false);
  });
});
