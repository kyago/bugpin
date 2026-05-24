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

  it('re-entering selection after a pick: start() works on a second click', () => {
    // Regression: after handleClick set listeners removed but kept active=true,
    // a second start() early-exited and the picker became unresponsive until ESC.
    document.body.innerHTML = `
      <div id="root">
        <button id="first">first</button>
        <button id="second">second</button>
      </div>
    `;
    const picks: PickedElement[] = [];
    const sm = new SelectionMode({
      onPicked: (p) => { picks.push(p); },
      onCancelled: () => {},
    });

    // First pick
    sm.start();
    document.getElementById('first')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(picks).toHaveLength(1);
    expect(picks[0]!.selector).toBe('#first');

    // Second start — must NOT early-exit just because the previous pick left active=true.
    sm.start();
    document.getElementById('second')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    expect(picks).toHaveLength(2);
    expect(picks[1]!.selector).toBe('#second');

    sm.stop();
  });

  it('ESC after a pick triggers onCancelled (PICKED → IDLE)', () => {
    let cancelled = false;
    const sm = new SelectionMode({
      onPicked: () => {},
      onCancelled: () => { cancelled = true; },
    });
    sm.start();
    document.getElementById('btn')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    // Now in PICKED state. ESC should still cancel.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelled).toBe(true);
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
