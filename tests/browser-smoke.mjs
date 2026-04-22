import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';

/**
 * Browser smoke for the React connection path.
 *
 * This intentionally checks only UI wiring for the Signify boundary: generated
 * passcode, connect, connected status, and client summary rendering. KERIA
 * correctness belongs to `pnpm keria:smoke`.
 */
const appUrl = process.env.BROWSER_SMOKE_URL ?? 'http://127.0.0.1:5173';
const uiPreferencesStorageKey = 'signify-react-ts:ui-preferences:v1';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const canReachApp = async () => {
  try {
    const response = await fetch(appUrl);
    return response.ok;
  } catch {
    return false;
  }
};

const waitForApp = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await canReachApp()) {
      return;
    }
    await sleep(500);
  }

  throw new Error(`Vite app did not become reachable at ${appUrl}`);
};

const startViteIfNeeded = async () => {
  if (await canReachApp()) {
    return null;
  }

  const child = spawn('pnpm', ['exec', 'vite', '--host', '127.0.0.1'], {
    stdio: 'ignore',
    env: {
      ...process.env,
      BROWSER: 'none',
    },
  });

  await waitForApp();
  return child;
};

const textContent = (page, selector) =>
  page.$eval(selector, (element) => element.textContent ?? '');

const routeUrl = (path) => new URL(path, appUrl).toString();

const passcodeValue = (page) =>
  page.$eval('#outlined-password-input', (element) => element.value ?? '');

const chromeArgs =
  process.env.CI === 'true' ? ['--no-sandbox', '--disable-setuid-sandbox'] : [];

const vite = await startViteIfNeeded();
const browser = await puppeteer.launch({
  headless: 'new',
  args: chromeArgs,
});

try {
  const page = await browser.newPage();

  await page.goto(appUrl, { waitUntil: 'networkidle0' });
  await page.evaluate((key) => {
    globalThis.localStorage.removeItem(key);
  }, uiPreferencesStorageKey);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="ui-sound-toggle"]', {
    timeout: 10000,
  });
  const soundToggleBeforeOperations = await page.evaluate(() => {
    const toggle = globalThis.document.querySelector(
      '[data-testid="ui-sound-toggle"]'
    );
    const operations = globalThis.document.querySelector(
      '[data-testid="operations-indicator"]'
    );
    return toggle?.nextElementSibling === operations;
  });
  if (!soundToggleBeforeOperations) {
    throw new Error('Expected sound toggle immediately before operations indicator');
  }
  const defaultSoundMuted = await page.$eval(
    '[data-testid="ui-sound-toggle"]',
    (element) => element.getAttribute('aria-pressed')
  );
  if (defaultSoundMuted !== 'false') {
    throw new Error(`Expected sound enabled by default, got aria-pressed=${defaultSoundMuted}`);
  }
  await page.click('[data-testid="ui-sound-toggle"]');
  await page.waitForFunction(
    () =>
      globalThis.document
        .querySelector('[data-testid="ui-sound-toggle"]')
        ?.getAttribute('aria-pressed') === 'true',
    { timeout: 10000 }
  );
  const persistedSoundPreference = await page.evaluate((key) => {
    const text = globalThis.localStorage.getItem(key);
    return text === null ? null : JSON.parse(text);
  }, uiPreferencesStorageKey);
  if (persistedSoundPreference?.hoverSoundMuted !== true) {
    throw new Error('Expected muted sound preference to persist');
  }
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('[data-testid="ui-sound-toggle"]', {
    timeout: 10000,
  });
  const restoredSoundMuted = await page.$eval(
    '[data-testid="ui-sound-toggle"]',
    (element) => element.getAttribute('aria-pressed')
  );
  if (restoredSoundMuted !== 'true') {
    throw new Error(`Expected muted sound preference after reload, got ${restoredSoundMuted}`);
  }

  for (const path of ['/dashboard', '/contacts', '/identifiers', '/credentials', '/client']) {
    await page.goto(routeUrl(path), { waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="connection-required"]', {
      timeout: 10000,
    });
  }

  await page.goto(appUrl, { waitUntil: 'networkidle0' });

  await page.click('[data-testid="connect-open"]');
  await page.waitForSelector('[data-testid="connect-dialog"]');
  await page.click('[data-testid="generate-passcode"]');
  await page.waitForFunction(
    () =>
      globalThis.document.querySelector(
        '[data-testid="app-loading-overlay"]'
      ) !== null ||
      globalThis.document.querySelector('#outlined-password-input')?.value
        .length >= 21,
    { timeout: 10000 }
  );
  await page.waitForFunction(
    () =>
      globalThis.document.querySelector('#outlined-password-input')?.value
        .length >= 21,
    { timeout: 10000 }
  );
  const generatedPasscode = await passcodeValue(page);
  if (generatedPasscode.length < 21) {
    throw new Error(`Expected generated passcode, got ${generatedPasscode}`);
  }
  await page.click('[data-testid="connect-submit"]');
  await page.waitForSelector('[data-testid="app-loading-overlay"]', {
    timeout: 10000,
  });
  await page.waitForSelector('[data-testid="connect-dialog"]', {
    hidden: true,
    timeout: 30000,
  });
  await page.waitForSelector('[data-testid="app-loading-overlay"]', {
    hidden: true,
    timeout: 10000,
  });
  await page.waitForSelector('[data-testid="dashboard-view"]', {
    timeout: 10000,
  });
  if (!page.url().endsWith('/dashboard')) {
    throw new Error(`Expected post-connect /dashboard route, got ${page.url()}`);
  }

  await page.click('[data-testid="nav-open"]');
  await page.waitForSelector('[data-testid="nav-identifiers"]', {
    timeout: 10000,
  });
  await page.click('[data-testid="nav-identifiers"]');
  await page.waitForSelector('[data-testid="identifier-table"]', {
    timeout: 10000,
  });
  const identifierTableText = await textContent(page, '[data-testid="identifier-table"]');
  for (const expectedHeader of ['Name', 'AID', 'Actions']) {
    if (!identifierTableText.includes(expectedHeader)) {
      throw new Error(`Identifier table is missing ${expectedHeader} header`);
    }
  }
  if (!page.url().endsWith('/identifiers')) {
    throw new Error(`Expected drawer navigation to /identifiers, got ${page.url()}`);
  }

  const identifierStatus = await page.$('[data-testid="identifier-action-status"]');
  if (identifierStatus !== null) {
    const identifierStatusText = await textContent(
      page,
      '[data-testid="identifier-action-status"]'
    );
    if (identifierStatusText.includes('Unable to load identifiers')) {
      throw new Error(identifierStatusText);
    }
  }

  await sleep(500);
  await page.click('[data-testid="nav-open"]');
  await page.waitForSelector('[data-testid="nav-client"]', {
    timeout: 10000,
  });
  await page.click('[data-testid="nav-client"]');
  await page.waitForSelector('[data-testid="client-summary"]', {
    timeout: 10000,
  });
  if (!page.url().endsWith('/client')) {
    throw new Error(`Expected drawer navigation to /client, got ${page.url()}`);
  }

  const controller = await textContent(page, '[data-testid="controller-aid"]');
  const agent = await textContent(page, '[data-testid="agent-aid"]');

  if (!controller.includes('E') || !agent.includes('E')) {
    throw new Error(
      `Client summary did not render expected AIDs: controller=${controller}, agent=${agent}`
    );
  }

  console.log(
    JSON.stringify(
      {
        status: 'passed',
        controller,
        agent,
      },
      null,
      2
    )
  );
} finally {
  await browser.close();
  if (vite !== null) {
    vite.kill('SIGTERM');
  }
}
