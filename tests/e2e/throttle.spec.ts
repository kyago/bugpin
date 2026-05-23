import { test } from '@playwright/test';

test.skip('Submit throttle queues 2 rapid submissions with ≥1s gap', async () => {
  // 1) Configure mock to delay or simply respond fast
  // 2) Submit issue A
  // 3) Within 100ms, submit issue B
  // 4) Assert: second POST to /issues arrives ≥1s after first
});
