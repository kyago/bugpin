/// <reference types="vite/client" />
const HOST_ID = '__qa-overlay-host';
const OPEN_MODE = (import.meta.env.MODE !== 'production');

export class Overlay {
  private host: HTMLDivElement | null = null;
  private root: ShadowRoot | null = null;
  private rect: HTMLDivElement | null = null;

  mount(): void {
    if (this.host) return;
    this.host = document.createElement('div');
    this.host.id = HOST_ID;
    this.host.style.cssText = `
      position: fixed; inset: 0;
      pointer-events: none;
      z-index: 2147483647;
    `;
    this.root = this.host.attachShadow({ mode: OPEN_MODE ? 'open' : 'closed' });
    this.root.innerHTML = `
      <style>
        :host { all: initial; }
        .rect {
          position: fixed;
          pointer-events: none;
          outline: 2px solid #e74c3c;
          outline-offset: 1px;
          background: rgba(231, 76, 60, 0.08);
          transition: top 60ms, left 60ms, width 60ms, height 60ms;
          box-sizing: border-box;
        }
      </style>
      <div class="rect" style="top:0;left:0;width:0;height:0"></div>
    `;
    this.rect = this.root.querySelector('.rect') as HTMLDivElement;
    document.documentElement.appendChild(this.host);
  }

  unmount(): void {
    this.host?.remove();
    this.host = null; this.root = null; this.rect = null;
  }

  highlight(el: Element | null): void {
    if (!this.rect) return;
    if (!el) {
      this.rect.style.cssText = 'position:fixed;pointer-events:none;width:0;height:0;outline:2px solid #e74c3c;background:rgba(231,76,60,0.08);box-sizing:border-box;';
      return;
    }
    const r = el.getBoundingClientRect();
    this.rect.style.top = `${r.top}px`;
    this.rect.style.left = `${r.left}px`;
    this.rect.style.width = `${r.width}px`;
    this.rect.style.height = `${r.height}px`;
  }
}
