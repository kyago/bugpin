import { test } from '@playwright/test';

test.skip('401 error surfaces InlineError with form preserved', async () => {
  // 1) Set mock createIssue scenario to 401
  // 2) Submit a draft
  // 3) Assert: inline-error visible with "토큰" message
  // 4) Assert: title and description still populated (form preserved)
});
