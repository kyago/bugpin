import chrome from 'sinon-chrome';
globalThis.chrome = chrome as unknown as typeof globalThis.chrome;

beforeEach(() => {
  chrome.flush();
});
