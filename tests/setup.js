import chrome from 'sinon-chrome';
globalThis.chrome = chrome;
beforeEach(() => {
    chrome.flush();
});
