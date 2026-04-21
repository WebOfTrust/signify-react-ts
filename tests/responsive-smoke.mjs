import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';

/**
 * Responsive browser smoke for the disconnected app shell.
 *
 * This checks the mobile layout contract without requiring KERIA: the app
 * starts near the top of the viewport, does not create page-level horizontal
 * overflow, and keeps the connect dialog controls inside small viewports.
 */
const appUrl = process.env.RESPONSIVE_SMOKE_URL ?? 'http://127.0.0.1:5175';

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

    console.log(
        JSON.stringify(
            {
                status: 'passed',
                viewports,
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
