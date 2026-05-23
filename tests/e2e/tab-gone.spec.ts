import { test } from '@playwright/test';

test.skip('TAB_GONE UI shows when bound tab is closed', async () => {
  // 1) Open side panel bound to tab A
  // 2) Close tab A
  // 3) Assert: panel shows "원래 탭이 닫혔습니다" with "현재 탭으로 전환" button
});
