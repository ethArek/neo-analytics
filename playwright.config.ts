import { defineConfig } from '@playwright/test';
import { resolve } from 'path';

const testDir = resolve(__dirname, 'frontend', 'test', 'e2e');
const port = 4173;
const baseURL = `http://127.0.0.1:${port}/`;

export default defineConfig({
  testDir,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    viewport: { width: 1280, height: 720 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    reducedMotion: 'reduce',
  },
  webServer: {
    command: `npm run dev:client -- --host 127.0.0.1 --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
