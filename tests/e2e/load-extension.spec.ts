import { test, expect, chromium } from '@playwright/test';
import path from 'node:path';

const EXT_PATH = path.resolve(process.cwd(), 'dist');

test('extension loads and content scripts inject', async () => {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
    ],
  });

  let sw = context.serviceWorkers()[0];
  if (!sw) sw = await context.waitForEvent('serviceworker');
  expect(sw.url()).toContain('background');

  const page = await context.newPage();
  const messages: string[] = [];
  page.on('console', (m) => messages.push(m.text()));
  await page.goto('https://example.com');
  await page.waitForTimeout(500);

  const joined = messages.join('\n');
  expect(joined).toContain('content-main loaded');
  expect(joined).toContain('content-iso loaded');

  await context.close();
});
