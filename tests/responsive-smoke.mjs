import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';
import {
    Algos,
    SignifyClient,
    Tier,
    randomPasscode,
    ready,
} from 'signify-ts';

/**
 * Responsive browser smoke for the app shell and connected identifier table.
 *
 * This checks the mobile layout contract, then connects with a fixture
 * identifier so compact table widths keep copy/rotate actions inside the
 * viewport.
 */
const appUrl = process.env.RESPONSIVE_SMOKE_URL ?? 'http://127.0.0.1:5175';
const keriaAdminUrl =
    process.env.VITE_KERIA_ADMIN_URL ?? 'http://127.0.0.1:3901';
const keriaBootUrl =
    process.env.VITE_KERIA_BOOT_URL ?? 'http://127.0.0.1:3903';

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

const routeUrl = (path) => new URL(path, appUrl).toString();

const responsiveAlias = () =>
    `responsive-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;

const waitForOperation = async (client, operation, label) => {
    const controller = new globalThis.AbortController();
    const timeout = globalThis.setTimeout(() => {
        controller.abort(new Error(`${label} timed out`));
    }, 60000);

    try {
        await client.operations().wait(operation, {
            signal: controller.signal,
            minSleep: 250,
            maxSleep: 1000,
        });
    } catch (error) {
        throw new Error(
            `${label} failed: ${error instanceof Error ? error.message : String(error)}`,
            { cause: error }
        );
    } finally {
        globalThis.clearTimeout(timeout);
    }
};

const connectClient = async (passcode) => {
    await ready();
    const client = new SignifyClient(
        keriaAdminUrl,
        passcode,
        Tier.low,
        keriaBootUrl
    );

    try {
        await client.connect();
    } catch (error) {
        if (
            !(error instanceof Error) ||
            !error.message.includes('agent does not exist')
        ) {
            throw error;
        }

        const response = await client.boot();
        if (!response.ok) {
            throw new Error(
                `KERIA boot failed: ${response.status} ${response.statusText}`,
                { cause: error }
            );
        }
        await client.connect();
    }

    return client;
};

const createIdentifierFixture = async () => {
    await ready();
    const passcode = randomPasscode();
    const client = await connectClient(passcode);
    const alias = responsiveAlias();
    const result = await client.identifiers().create(alias, {
        algo: Algos.randy,
    });
    const operation = await result.op();
    await waitForOperation(client, operation, `creating ${alias}`);

    return { passcode, alias };
};

const assertNoHorizontalOverflow = async (page, label) => {
    const metrics = await page.evaluate(() => ({
        innerWidth: globalThis.innerWidth,
        htmlScrollWidth: globalThis.document.documentElement.scrollWidth,
        bodyScrollWidth: globalThis.document.body.scrollWidth,
    }));
    const scrollWidth = Math.max(
        metrics.htmlScrollWidth,
        metrics.bodyScrollWidth
    );

    if (scrollWidth > metrics.innerWidth) {
        throw new Error(
            `${label} has horizontal overflow: scrollWidth=${scrollWidth}, innerWidth=${metrics.innerWidth}`
        );
    }
};

const assertContentStartsBelowAppBar = async (page, label) => {
    const metrics = await page.evaluate(() => {
        const appBar = globalThis.document.querySelector('.MuiAppBar-root');
        const content = globalThis.document.querySelector(
            '[data-testid="connection-required"]'
        );

        if (appBar === null || content === null) {
            return null;
        }

        const appBarRect = appBar.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();

        return {
            appBarBottom: appBarRect.bottom,
            contentTop: contentRect.top,
        };
    });

    if (metrics === null) {
        throw new Error(
            `${label} did not render the app bar and route content`
        );
    }

    if (metrics.contentTop < metrics.appBarBottom) {
        throw new Error(
            `${label} route content overlaps app bar: contentTop=${metrics.contentTop}, appBarBottom=${metrics.appBarBottom}`
        );
    }

    if (metrics.contentTop - metrics.appBarBottom > 96) {
        throw new Error(
            `${label} route content appears vertically centered: contentTop=${metrics.contentTop}, appBarBottom=${metrics.appBarBottom}`
        );
    }
};

const assertElementsFitViewport = async (page, selectors, label) => {
    const failures = await page.evaluate((visibleSelectors) => {
        const viewportWidth = globalThis.innerWidth;

        return visibleSelectors.flatMap((selector) => {
            const element = globalThis.document.querySelector(selector);

            if (element === null) {
                return [`${selector} was not found`];
            }

            const rect = element.getBoundingClientRect();

            if (rect.left < -1 || rect.right > viewportWidth + 1) {
                return [
                    `${selector} overflows horizontally: left=${rect.left}, right=${rect.right}, viewport=${viewportWidth}`,
                ];
            }

            return [];
        });
    }, selectors);

    if (failures.length > 0) {
        throw new Error(`${label} viewport fit failed: ${failures.join('; ')}`);
    }
};

const assertVisibleControlFitsViewport = async (page, ariaLabel, label) => {
    const failures = await page.evaluate((expectedLabel) => {
        const viewportWidth = globalThis.innerWidth;
        const controls = [...globalThis.document.querySelectorAll('button')]
            .filter(
                (button) => button.getAttribute('aria-label') === expectedLabel
            )
            .filter((button) => {
                const rect = button.getBoundingClientRect();
                const style = globalThis.getComputedStyle(button);
                return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden'
                );
            });

        if (controls.length === 0) {
            return [`No visible control for ${expectedLabel}`];
        }

        return controls.flatMap((control) => {
            const rect = control.getBoundingClientRect();
            if (rect.left < -1 || rect.right > viewportWidth + 1) {
                return [
                    `${expectedLabel} overflows horizontally: left=${rect.left}, right=${rect.right}, viewport=${viewportWidth}`,
                ];
            }

            return [];
        });
    }, ariaLabel);

    if (failures.length > 0) {
        throw new Error(`${label} control fit failed: ${failures.join('; ')}`);
    }
};

const visibleIdentifierHeaders = async (page) =>
    page.$$eval('[data-testid="identifier-table"] thead th', (headers) =>
        headers
            .filter((header) => {
                const rect = header.getBoundingClientRect();
                const style = globalThis.getComputedStyle(header);
                return (
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden'
                );
            })
            .map((header) => header.textContent?.trim() ?? '')
    );

const assertIdentifierHeaders = async (
    page,
    { expected, omitted },
    label
) => {
    const headers = await visibleIdentifierHeaders(page);
    const missing = expected.filter((header) => !headers.includes(header));
    const unexpectedlyVisible = omitted.filter((header) =>
        headers.includes(header)
    );

    if (missing.length > 0 || unexpectedlyVisible.length > 0) {
        throw new Error(
            `${label} identifier headers mismatch: visible=${headers.join(', ')}, missing=${missing.join(', ')}, unexpectedlyVisible=${unexpectedlyVisible.join(', ')}`
        );
    }
};

const setInputValue = async (page, selector, value) => {
    await page.$eval(
        selector,
        (element, nextValue) => {
            const descriptor = Object.getOwnPropertyDescriptor(
                globalThis.HTMLInputElement.prototype,
                'value'
            );
            descriptor?.set?.call(element, nextValue);
            element.dispatchEvent(
                new globalThis.Event('input', { bubbles: true })
            );
        },
        value
    );
};

const connectBrowser = async (page, passcode) => {
    await page.goto(appUrl, { waitUntil: 'domcontentloaded' });
    await page.click('[data-testid="connect-open"]');
    await page.waitForSelector('[data-testid="connect-dialog"]', {
        timeout: 10000,
    });
    await setInputValue(page, '#outlined-password-input', passcode);
    await page.click('[data-testid="connect-submit"]');
    await page.waitForSelector('[data-testid="connect-dialog"]', {
        hidden: true,
        timeout: 30000,
    });
    await page.waitForSelector('[data-testid="app-loading-overlay"]', {
        hidden: true,
        timeout: 10000,
    });
    await page.waitForSelector('[data-testid="known-components"]', {
        timeout: 30000,
    });
};

const navigateToIdentifiers = async (page) => {
    await page.click('[data-testid="nav-open"]');
    await page.waitForSelector('[data-testid="nav-identifiers"]', {
        timeout: 10000,
    });
    await page.click('[data-testid="nav-identifiers"]');
    try {
        await page.waitForSelector('[data-testid="identifier-table"]', {
            timeout: 10000,
        });
    } catch (error) {
        const debug = await page.evaluate(() => ({
            url: globalThis.location.href,
            text: globalThis.document.body.innerText.slice(0, 1000),
        }));
        throw new Error(
            `Identifiers route did not render table at ${debug.url}: ${debug.text}`,
            { cause: error }
        );
    }
};

const assertOverlayFitsViewport = async (page, label) => {
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

    const overlay = await page.$('[data-testid="app-loading-overlay"]');
    if (overlay !== null) {
        await assertElementsFitViewport(
            page,
            ['[data-testid="app-loading-overlay"] [role="status"]'],
            `${label} loading overlay`
        );
        await page.waitForSelector('[data-testid="app-loading-overlay"]', {
            hidden: true,
            timeout: 10000,
        });
    }
};

const chromeArgs =
    process.env.CI === 'true'
        ? ['--no-sandbox', '--disable-setuid-sandbox']
        : [];

const viewports = [
    { label: 'iPhone SE', width: 320, height: 568 },
    { label: 'mobile', width: 390, height: 844 },
];

const identifierViewports = [
    {
        label: 'compact table',
        width: 640,
        height: 800,
        headers: {
            expected: ['Name', 'AID', 'Actions'],
            omitted: ['Type', 'KIDX', 'PIDX', 'OOBI'],
        },
    },
    {
        label: 'medium table',
        width: 960,
        height: 800,
        headers: {
            expected: ['Name', 'AID', 'Type', 'Actions'],
            omitted: ['KIDX', 'PIDX', 'OOBI'],
        },
    },
];

const vite = await startViteIfNeeded();
const browser = await puppeteer.launch({
    headless: 'new',
    args: chromeArgs,
});

try {
    const page = await browser.newPage();

    for (const viewport of viewports) {
        await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            isMobile: true,
            deviceScaleFactor: 2,
        });
        await page.goto(routeUrl('/identifiers'), {
            waitUntil: 'networkidle0',
        });
        await page.waitForSelector('[data-testid="connection-required"]', {
            timeout: 10000,
        });

        await assertNoHorizontalOverflow(page, viewport.label);
        await assertContentStartsBelowAppBar(page, viewport.label);

        await page.click('[data-testid="connect-open"]');
        await page.waitForSelector('[data-testid="connect-dialog"]', {
            timeout: 10000,
        });
        await assertNoHorizontalOverflow(page, `${viewport.label} dialog`);
        await assertElementsFitViewport(
            page,
            [
                '.MuiDialog-paper',
                '[data-testid="connect-submit"]',
                '[data-testid="generate-passcode"]',
                '[data-testid="connect-close"]',
            ],
            `${viewport.label} dialog`
        );
        await assertOverlayFitsViewport(page, viewport.label);
        await page.click('[data-testid="connect-close"]');
    }

    const fixture = await createIdentifierFixture();
    await page.setViewport({
        width: identifierViewports[0].width,
        height: identifierViewports[0].height,
        isMobile: false,
        deviceScaleFactor: 1,
    });
    await connectBrowser(page, fixture.passcode);

    let identifiersRouteLoaded = false;
    for (const viewport of identifierViewports) {
        await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            isMobile: false,
            deviceScaleFactor: 1,
        });
        if (!identifiersRouteLoaded) {
            await navigateToIdentifiers(page);
            identifiersRouteLoaded = true;
        } else {
            await page.waitForSelector('[data-testid="identifier-table"]', {
                timeout: 10000,
            });
        }
        await page.waitForFunction(
            (alias) =>
                [...globalThis.document.querySelectorAll('button')].some(
                    (button) =>
                        button.getAttribute('aria-label') ===
                        `Rotate identifier ${alias}`
                ),
            { timeout: 10000 },
            fixture.alias
        );

        await assertNoHorizontalOverflow(page, viewport.label);
        await assertIdentifierHeaders(page, viewport.headers, viewport.label);
        await assertVisibleControlFitsViewport(
            page,
            `Rotate identifier ${fixture.alias}`,
            viewport.label
        );
        await assertVisibleControlFitsViewport(
            page,
            `Copy agent OOBI for ${fixture.alias}`,
            viewport.label
        );
    }

    console.log(
        JSON.stringify(
            {
                status: 'passed',
                viewports,
                identifierViewports: identifierViewports.map(
                    ({ label, width, height }) => ({ label, width, height })
                ),
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
