import { defineConfig } from '@playwright/test';

// FR-TST-03: a globally set key never reaches the test servers.
const env = { ...process.env, TYPESAFE_API_KEY: '', TYPESAFE_BASE_URL: '' };
// Ports overridable only so two agents can run suites side by side; defaults are the spec's.
const MOCK = process.env.PW_MOCK_PORT || '8790';
const STATIC = process.env.PW_STATIC_PORT || '8080';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.spec.mjs',
  fullyParallel: false,
  workers: 1,
  use: { trace: 'off', video: 'off', screenshot: 'off', baseURL: `http://127.0.0.1:${STATIC}` },
  webServer: [
    { command: `node tools/jev-proxy.mjs --port ${MOCK} --mock-upstream`, url: `http://127.0.0.1:${MOCK}/`, env, reuseExistingServer: false },
    { command: `node tools/jev-proxy.mjs --port ${STATIC} --no-api`, url: `http://127.0.0.1:${STATIC}/`, env, reuseExistingServer: false },
  ],
  projects: [
    // Tests tagged @mobile run only in the mobile project (E09); everything else desktop only.
    { name: 'desktop', grepInvert: /@mobile/, use: { viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', grep: /@mobile/, use: { viewport: { width: 375, height: 812 } } },
  ],
});
