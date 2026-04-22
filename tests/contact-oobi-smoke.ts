import { spawn, type ChildProcess } from 'node:child_process';
import puppeteer, { type ElementHandle, type Page } from 'puppeteer';
import { appConfig } from '../src/config';
import {
    addAgentEndRole,
    createRole,
    createWitnessedIdentifier,
    uniqueAlias,
} from './support/keria';

const appUrl =
    process.env.CONTACT_OOBI_SMOKE_URL ?? 'http://127.0.0.1:5176';

const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => {
        globalThis.setTimeout(resolve, ms);
    });

const canReachApp = async (): Promise<boolean> => {
    try {
        const response = await fetch(appUrl);
        return response.ok;
    } catch {
        return false;
    }
};

const waitForApp = async (): Promise<void> => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        if (await canReachApp()) {
            return;
        }
        await sleep(500);
    }

    throw new Error(`Vite app did not become reachable at ${appUrl}`);
};

const startViteIfNeeded = async (): Promise<ChildProcess | null> => {
    if (await canReachApp()) {
        return null;
    }

    const url = new URL(appUrl);
    const child = spawn(
        'pnpm',
        [
            'exec',
            'vite',
            '--host',
            url.hostname,
            '--port',
            url.port,
            '--strictPort',
        ],
        {
            stdio: 'ignore',
            env: {
                ...process.env,
                BROWSER: 'none',
            },
        }
    );

    await waitForApp();
    return child;
};

const passcodeValue = (page: Page): Promise<string> =>
    page.$eval(
        '#outlined-password-input',
        (element) => (element as HTMLInputElement).value ?? ''
    );

const elementFor = async (
    page: Page,
    selector: string
): Promise<ElementHandle<Element>> => {
    const element = await page.$(selector);
    if (element === null) {
        throw new Error(`Missing element ${selector}`);
    }

    return element;
};

const setInputValue = async (
    page: Page,
    selector: string,
    value: string
): Promise<void> => {
    const element = await elementFor(page, selector);
    await element.click({ clickCount: 3 });
    await page.keyboard.press('Backspace');
    await element.type(value);
};

const waitForText = async (
    page: Page,
    selector: string,
    expected: string,
    timeout = 120_000
): Promise<void> => {
    await page.waitForFunction(
        (visibleSelector, text) =>
            Array.from(globalThis.document.querySelectorAll(visibleSelector)).some(
                (element) => element.textContent?.includes(text)
            ),
        { timeout },
        selector,
        expected
    );
};

const waitForResolvedContact = async (
    page: Page,
    alias: string
): Promise<void> => {
    await page.waitForFunction(
        (expectedAlias) =>
            Array.from(
                globalThis.document.querySelectorAll(
                    '[data-testid="contact-card"]'
                )
            ).some(
                (element) =>
                    element.textContent?.includes(expectedAlias) === true &&
                    element.textContent.includes('resolved')
            ),
        { timeout: 120_000 },
        alias
    );
};

const connectBrowserAgent = async (page: Page): Promise<string> => {
    await page.goto(appUrl, { waitUntil: 'networkidle0' });
    await page.click('[data-testid="connect-open"]');
    await page.waitForSelector('[data-testid="connect-dialog"]');
    await page.click('[data-testid="generate-passcode"]');
    await page.waitForFunction(
        () =>
            globalThis.document.querySelector('#outlined-password-input')?.value
                .length >= 21,
        { timeout: 10_000 }
    );

    const passcode = await passcodeValue(page);
    await page.click('[data-testid="connect-submit"]');
    await page.waitForSelector('[data-testid="connect-dialog"]', {
        hidden: true,
        timeout: 30_000,
    });
    await page.waitForSelector('[data-testid="known-components"]', {
        timeout: 30_000,
    });

    if (!page.url().endsWith('/dashboard')) {
        throw new Error(`Expected post-connect /dashboard route, got ${page.url()}`);
    }

    return passcode;
};

const navigateInApp = async (
    page: Page,
    navTestId: string,
    readySelector: string
): Promise<void> => {
    await page.click('[data-testid="nav-open"]');
    await page.waitForSelector(`[data-testid="${navTestId}"]`, {
        timeout: 10_000,
    });
    await page.click(`[data-testid="${navTestId}"]`);
    await page.waitForSelector(readySelector, {
        timeout: 30_000,
    });
};

const resolveOobiInContacts = async (
    page: Page,
    oobi: string,
    alias: string
): Promise<void> => {
    if ((await page.$('[data-testid="contacts-view"]')) === null) {
        await navigateInApp(
            page,
            'nav-contacts',
            '[data-testid="contacts-view"]'
        );
    }
    await setInputValue(page, '[data-testid="contact-oobi-input"] textarea', oobi);
    await setInputValue(page, '[data-testid="contact-alias-input"] input', alias);
    await page.click('[data-testid="contact-resolve-submit"]');
    await waitForText(page, '[data-testid="contact-card"]', alias);
    await waitForResolvedContact(page, alias);
};

const openContactDetail = async (page: Page, alias: string): Promise<void> => {
    await page.waitForFunction(
        (expectedAlias) =>
            Array.from(
                globalThis.document.querySelectorAll(
                    '[data-testid="contact-card-link"]'
                )
            ).some((element) => element.textContent?.includes(expectedAlias)),
        { timeout: 30_000 },
        alias
    );
    await page.evaluate((expectedAlias) => {
        const link = Array.from(
            globalThis.document.querySelectorAll(
                '[data-testid="contact-card-link"]'
            )
        ).find((element) => element.textContent?.includes(expectedAlias));
        if (link instanceof HTMLElement) {
            link.click();
        }
    }, alias);
    await page.waitForSelector('[data-testid="contact-detail"]', {
        timeout: 30_000,
    });
};

const assertQuickNotificationAndOperationPayload = async (
    page: Page
): Promise<void> => {
    await page.click('[data-testid="notifications-open"]');
    await page.waitForSelector(
        '[data-testid="payload-detail"][data-payload-kind="oobi"]',
        { timeout: 30_000 }
    );
    const quickItem = await elementFor(page, '[data-testid="notification-quick-item"]');
    const box = await quickItem.boundingBox();
    if (box === null) {
        throw new Error('Notification quick item has no visible bounds.');
    }
    await page.mouse.click(box.x + 16, box.y + 16);
    await page.waitForFunction(
        () => globalThis.location.pathname.startsWith('/operations/'),
        { timeout: 10_000 }
    );
    await page.waitForSelector(
        '[data-testid="payload-detail"][data-payload-kind="oobi"]',
        { timeout: 10_000 }
    );
    await page.goBack({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="contacts-view"]', {
        timeout: 10_000,
    });
};

const witnessOobi = (): string => {
    const wanAid = appConfig.witnesses.aids[0];
    if (wanAid === undefined) {
        throw new Error('No configured witness AID available for UI smoke.');
    }

    return `http://127.0.0.1:5642/oobi/${wanAid}/controller?name=Wan`;
};

const chromeArgs =
    process.env.CI === 'true'
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [];

const vite = await startViteIfNeeded();
const browser = await puppeteer.launch({
    headless: 'new',
    args: chromeArgs,
});

try {
    const page = await browser.newPage();
    const browserPasscode = await connectBrowserAgent(page);
    const harness = await createRole('ui-oobi-harness');
    const harnessAlias = uniqueAlias('ui-oobi-harness');
    await createWitnessedIdentifier(harness, harnessAlias);
    const harnessOobi = await addAgentEndRole(harness, harnessAlias);

    await resolveOobiInContacts(page, harnessOobi, harnessAlias);
    await openContactDetail(page, harnessAlias);
    await waitForText(page, '[data-testid="contact-detail"]', harnessOobi);
    await page.goBack({ waitUntil: 'networkidle0' });
    await page.waitForSelector('[data-testid="contacts-view"]', {
        timeout: 10_000,
    });
    await assertQuickNotificationAndOperationPayload(page);
    await resolveOobiInContacts(page, witnessOobi(), 'Wan witness');

    await navigateInApp(
        page,
        'nav-dashboard',
        '[data-testid="known-components"]'
    );
    await waitForText(page, '[data-testid="known-components"]', 'Wan');

    console.log(
        JSON.stringify(
            {
                status: 'passed',
                browserPasscodeLength: browserPasscode.length,
                harnessAlias,
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
