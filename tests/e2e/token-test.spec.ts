import { test } from '@playwright/test';

test.skip('Token test reports 200/401/404 scenarios correctly', async () => {
  // 1) Open options page
  // 2) Add mapping with valid scenario → toggle scenario via PUT /scenario
  // 3) Click "토큰 테스트" → assert ✅
  // 4) Switch scenario to 401 → assert ❌ auth
  // 5) Switch scenario to 404 → assert ❌ repo
});
