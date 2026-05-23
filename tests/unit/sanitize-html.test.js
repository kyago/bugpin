import { describe, it, expect, beforeEach } from 'vitest';
import { sanitizeOuterHTML, wrapInDetails } from '@/lib/sanitize-html';
beforeEach(() => { document.body.innerHTML = ''; });
describe('sanitizeOuterHTML', () => {
    it('removes inline style', () => {
        document.body.innerHTML = `<div style="color:red">x</div>`;
        const out = sanitizeOuterHTML(document.body.firstElementChild);
        expect(out).not.toContain('style');
    });
    it('removes src/srcset', () => {
        document.body.innerHTML = `<img src="data:image/png;base64,XXXX" srcset="a 1x">`;
        const out = sanitizeOuterHTML(document.body.firstElementChild);
        expect(out).not.toContain('src');
    });
    it('removes on* handlers', () => {
        document.body.innerHTML = `<button onclick="alert(1)">a</button>`;
        const out = sanitizeOuterHTML(document.body.firstElementChild);
        expect(out).not.toContain('onclick');
    });
    it('replaces javascript: href with #', () => {
        document.body.innerHTML = `<a href="javascript:alert(1)">a</a>`;
        const out = sanitizeOuterHTML(document.body.firstElementChild);
        expect(out).toContain('href="#"');
        expect(out).not.toContain('javascript:');
    });
    it('removes <input value>', () => {
        document.body.innerHTML = `<form><input type="password" value="secret"></form>`;
        const out = sanitizeOuterHTML(document.body.firstElementChild);
        expect(out).not.toContain('secret');
        expect(out).not.toContain('value=');
    });
    it('removes <script> children', () => {
        document.body.innerHTML = `<div><script>alert(1)</script>visible</div>`;
        const out = sanitizeOuterHTML(document.body.firstElementChild);
        expect(out).not.toContain('<script');
        expect(out).toContain('visible');
    });
    it('caps to 4000 chars', () => {
        const big = '<div>' + 'x'.repeat(10_000) + '</div>';
        document.body.innerHTML = big;
        const out = sanitizeOuterHTML(document.body.firstElementChild);
        expect(out.length).toBeLessThanOrEqual(4_100); // 4000 + small marker
        expect(out).toContain('(잘림)');
    });
    it('removes iframe srcdoc', () => {
        document.body.innerHTML = `<iframe srcdoc="<x>"></iframe>`;
        const out = sanitizeOuterHTML(document.body.firstElementChild);
        expect(out).not.toContain('srcdoc');
    });
    it('removes SVG <script> (lowercase tagName)', () => {
        document.body.innerHTML = `<svg><script>alert(1)</script><circle/></svg>`;
        const out = sanitizeOuterHTML(document.body.firstElementChild);
        expect(out).not.toContain('<script');
        expect(out).toContain('<circle');
    });
});
describe('wrapInDetails', () => {
    it('escapes triple backticks in HTML content', () => {
        const out = wrapInDetails('<pre>```js\ncode\n```</pre>');
        const innerStart = out.indexOf('```html\n');
        const innerEnd = out.lastIndexOf('\n```');
        const inner = out.slice(innerStart + 8, innerEnd);
        expect(inner).not.toContain('```');
        expect(inner).toContain('\\`\\`\\`');
    });
});
