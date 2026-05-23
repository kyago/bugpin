import { test } from '@playwright/test';

test.skip('NO_MATCH UI shows when no mapping matches current URL', async () => {
  // 1) Load extension with empty storage
  // 2) Navigate to any URL with no configured mapping
  // 3) Open side panel
  // 4) Assert: NoMatchPrompt visible
  // 5) Click "현재 도메인으로 매핑 추가" → assert options page opens with prefill
});
