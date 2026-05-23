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

export class SelectionMode {
  private overlay = new Overlay();
  private active = false;
  private currentTarget: Element | null = null;
  private parentChain: Element[] = [];
  private currentDepth = 0;

  constructor(private cb: Callbacks) {}

  start(): void {
    if (this.active) return;
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
    if (!this.active) return;
    this.active = false;
    this.overlay.unmount();
    document.body.style.cursor = '';
    BLOCK_EVENTS.forEach(t =>
      document.removeEventListener(t, this.blockAll, true)
    );
    document.removeEventListener('keydown', this.handleKey, true);
    document.removeEventListener('mousemove', this.handleMove, true);
    document.removeEventListener('click', this.handleClick, true);
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
    if (!this.active) return;
    if (e.key === 'Escape') {
      this.stop();
      this.cb.onCancelled();
      return;
    }
    // Block other keys
    e.preventDefault();
    e.stopImmediatePropagation();
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
    // Keep overlay alive but stop intercepting page events
    BLOCK_EVENTS.forEach(t =>
      document.removeEventListener(t, this.blockAll, true)
    );
    document.removeEventListener('mousemove', this.handleMove, true);
    document.removeEventListener('click', this.handleClick, true);
    document.body.style.cursor = '';
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
