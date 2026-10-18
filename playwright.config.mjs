import { defineConfig } from '@playwright/test';

// FR-TST-03: a globally set key never reaches the test servers.
const env = { ...process.env, TYPESAFE_API_KEY: '', TYPESAFE_BASE_URL: '' };

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  use: { trace: 'off', video: 'off', screenshot: 'off', baseURL: 'http://127.0.0.1:8080' },
  webServer: [
    { command: 'node tools/jev-proxy.mjs --port 8790 --mock-upstream', url: 'http://127.0.0.1:8790/', env, reuseExistingServer: false },
    { command: 'node tools/jev-proxy.mjs --port 8080 --no-api', url: 'http://127.0.0.1:8080/', env, reuseExistingServer: false },
  ],
  projects: [
    // Tests tagged @mobile run only in the mobile project (E09); everything else desktop only.
    { name: 'desktop', grepInvert: /@mobile/, use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', grep: /@mobile/, use: { viewport: { width: 375, height: 812 } } },
  ],
});
