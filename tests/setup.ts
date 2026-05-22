import chrome from 'sinon-chrome';
// @ts-expect-error inject into globalThis
globalThis.chrome = chrome;

beforeEach(() => {
  chrome.flush();
});
