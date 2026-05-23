import { test } from '@playwright/test';

// TODO: full golden path requires GITHUB_API_BASE override mechanism.
// Strategy: env-driven Vite `define` to swap GITHUB_API_BASE at build time
// for the E2E build (point at http://localhost:4870).
test.skip('TODO: full golden path requires GITHUB_API_BASE override mechanism', async () => {
  // 1) load extension
  // 2) open options page via chrome-extension://{id}/src/options/index.html
  // 3) add mapping (name, pattern matching file://, repo, fake token)
  // 4) navigate to FIXTURE
  // 5) open side panel directly via chrome-extension://{id}/src/panel/index.html?tabId=...
  // 6) trigger selection
  // 7) click element on FIXTURE page
  // 8) fill title + description
  // 9) submit → assert mock server received POST with expected body shape
});
