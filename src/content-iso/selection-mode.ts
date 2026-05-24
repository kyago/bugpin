import { Overlay } from './overlay';
import { buildSelector, buildLabel } from '@/lib/selector';
import { sanitizeOuterHTML } from '@/lib/sanitize-html';
import type { PickedElement } from '@/shared/types';

const BLOCK_EVENTS = [
  'pointerdown', 'mousedown', 'mouseup',
  'click', 'auxclick', 'dblclick',
  'contextmenu', 'submit',
] as const;

type Callbacks = {
  onPicked: (payload: PickedElement) => void;
  onCancelled: () => void;
};

/**
 * State machine:
 *   IDLE     — no overlay, no listeners
 *   PICKING  — overlay + crosshair + all listeners (active=true)
 *   PICKED   — overlay highlight stays, ESC listener stays, no pick listeners
 *              (active=false, parentChain.length > 0)
 *
 * Transitions:
 *   IDLE    → PICKING : start()
 *   PICKING → PICKED  : handleClick fires (element picked)
 *   PICKING → IDLE    : stop() / ESC
 *   PICKED  → PICKING : start() called again (re-pick scenario)
 *   PICKED  → IDLE    : stop() / ESC
 */
export class SelectionMode {
  private overlay = new Overlay();
  private active = false;
  private currentTarget: Element | null = null;
  private parentChain: Element[] = [];
  private currentDepth = 0;

  constructor(private cb: Callbacks) {}

  start(): void {
    if (this.active) return;
    // If we're currently in PICKED state (parentChain populated), reset first
    // so the next pick starts clean (no stale highlight, fresh listeners).
    if (this.parentChain.length > 0) {
      this.teardown();
    }
    this.active = true;
    this.overlay.mount();
    document.body.style.cursor = 'crosshair';
    // Register handleClick FIRST so it runs before blockAll on click events
    // (same-phase listeners fire in registration order; handleClick calls
    //  stopImmediatePropagation which then short-circuits blockAll).
    document.addEventListener('click', this.handleClick, true);
    document.addEventListener('mousemove', this.handleMove, true);
    document.addEventListener('keydown', this.handleKey, true);
    BLOCK_EVENTS.forEach(t =>
      document.addEventListener(t, this.blockAll, true)
    );
  }

  stop(): void {
    // Allow stop from either PICKING (active=true) or PICKED (parentChain set)
    if (!this.active && this.parentChain.length === 0) return;
    this.teardown();
  }

  /** Tear down all listeners + overlay regardless of state. */
  private teardown(): void {
    this.overlay.unmount();
    document.body.style.cursor = '';
    BLOCK_EVENTS.forEach(t =>
      document.removeEventListener(t, this.blockAll, true)
    );
    document.removeEventListener('keydown', this.handleKey, true);
    document.removeEventListener('mousemove', this.handleMove, true);
    document.removeEventListener('click', this.handleClick, true);
    this.active = false;
    this.currentTarget = null;
    this.parentChain = [];
    this.currentDepth = 0;
  }

  setDepth(depth: number): PickedElement | null {
    if (this.parentChain.length === 0) return null;
    this.currentDepth = Math.max(0, Math.min(depth, this.parentChain.length - 1));
    const el = this.parentChain[this.currentDepth]!;
    this.overlay.highlight(el);
    return this.toPayload(el);
  }

  private blockAll = (e: Event): void => {
    if (!this.active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
  };

  private handleKey = (e: KeyboardEvent): void => {
    // ESC cancels from both PICKING and PICKED states
    if (e.key === 'Escape') {
      this.stop();
      this.cb.onCancelled();
      return;
    }
    // Block other keys only while actively picking — don't interfere with
    // form input or page shortcuts after a pick.
    if (this.active) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  };

  private handleMove = (e: MouseEvent): void => {
    if (!this.active) return;
    const el = e.target as Element | null;
    if (!el || el === this.currentTarget) return;
    this.currentTarget = el;
    this.overlay.highlight(el);
  };

  private handleClick = (e: MouseEvent): void => {
    if (!this.active) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const el = e.target as Element | null;
    if (!el) return;
    this.parentChain = computeParentChain(el);
    this.currentDepth = 0;
    const payload = this.toPayload(el);
    this.overlay.highlight(el);
    // Transition PICKING → PICKED:
    // remove pick-mode listeners, keep overlay+highlight + keydown for ESC.
    BLOCK_EVENTS.forEach(t =>
      document.removeEventListener(t, this.blockAll, true)
    );
    document.removeEventListener('mousemove', this.handleMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.body.style.cursor = '';
    this.active = false;
    this.cb.onPicked(payload);
  };

  private toPayload(el: Element): PickedElement {
    return {
      selector: buildSelector(el),
      outerHTML: sanitizeOuterHTML(el),
      parentChainSummary: this.parentChain.map(buildLabel),
      maxDepth: Math.max(0, this.parentChain.length - 1),
      currentDepth: this.currentDepth,
    };
  }
}

function computeParentChain(start: Element): Element[] {
  const chain: Element[] = [];
  let cur: Element | null = start;
  while (cur && cur !== document.body) {
    chain.push(cur);
    cur = cur.parentElement;
  }
  return chain;
}
