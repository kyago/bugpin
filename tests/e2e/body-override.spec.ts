import { test } from '@playwright/test';

test.skip('Body override mode prevents auto-regeneration', async () => {
  // 1) Pick an element
  // 2) Open body editor
  // 3) Modify body
  // 4) Change userDescription
  // 5) Assert body did NOT auto-regenerate from new userDescription
});
