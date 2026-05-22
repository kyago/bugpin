import { POST_MESSAGE_SOURCE } from '@/shared/constants';
import type { MainToIsoMessage } from '@/shared/types';

const origin = window.location.origin;

function post(msg: MainToIsoMessage): void {
  window.postMessage(msg, origin);
}

// === fetch wrapper ===
const origFetch = window.fetch;
window.fetch = async function (...args) {
  const startMethod = (args[1] as RequestInit | undefined)?.method ?? 'GET';
  const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url;
  try {
    const res = await origFetch.apply(this, args);
    if (res.status >= 400 || res.status === 0) {
      post({
        __qaSource: POST_MESSAGE_SOURCE,
        kind: 'network.failure',
        entry: {
          method: startMethod, url,
          status: res.status, statusText: res.statusText,
          timestamp: Date.now(),
        },
      });
    }
    return res;
  } catch (err) {
    post({
      __qaSource: POST_MESSAGE_SOURCE,
      kind: 'network.failure',
      entry: {
        method: startMethod, url,
        status: 0, statusText: String(err),
        timestamp: Date.now(),
      },
    });
    throw err;
  }
};

// === XMLHttpRequest wrapper ===
const origOpen = XMLHttpRequest.prototype.open;
const origSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function (method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
  (this as any).__qaMethod = method;
  (this as any).__qaUrl = String(url);
  return (origOpen as unknown as Function).call(this, method, url, async, username, password);
};
XMLHttpRequest.prototype.send = function (...args) {
  this.addEventListener('loadend', () => {
    if (this.status >= 400 || this.status === 0) {
      post({
        __qaSource: POST_MESSAGE_SOURCE,
        kind: 'network.failure',
        entry: {
          method: (this as any).__qaMethod ?? 'GET',
          url: (this as any).__qaUrl ?? '',
          status: this.status,
          statusText: this.statusText,
          timestamp: Date.now(),
        },
      });
    }
  });
  return origSend.apply(this, args as []);
};

// === console.error wrapper ===
const origError = console.error;
console.error = function (...args: unknown[]) {
  post({
    __qaSource: POST_MESSAGE_SOURCE,
    kind: 'console.error',
    entry: {
      message: args.map(a => String(a)).join(' '),
      source: 'console.error',
      timestamp: Date.now(),
    },
  });
  return origError.apply(this, args as []);
};

// === window.onerror ===
window.addEventListener('error', (e) => {
  post({
    __qaSource: POST_MESSAGE_SOURCE,
    kind: 'console.error',
    entry: {
      message: e.message ?? String(e.error),
      stack: e.error?.stack,
      source: 'window.onerror',
      timestamp: Date.now(),
    },
  });
});

// === unhandledrejection ===
window.addEventListener('unhandledrejection', (e) => {
  post({
    __qaSource: POST_MESSAGE_SOURCE,
    kind: 'console.error',
    entry: {
      message: String(e.reason),
      stack: (e.reason as { stack?: string })?.stack,
      source: 'unhandledrejection',
      timestamp: Date.now(),
    },
  });
});
