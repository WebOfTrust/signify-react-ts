import { spawn, type ChildProcess } from 'node:child_process';
import puppeteer, { type ElementHandle, type Page } from 'puppeteer';
import { appConfig } from '../src/config';
import {
    challengeWordsFingerprint,
    validateChallengeWords,
} from '../src/features/contacts/challengeWords';
import {
    CHALLENGE_REQUEST_ROUTE,
    CHALLENGE_TOPIC,
    responseSaidFromChallengeOperation,
} from '../src/services/challenges.service';
import { connectSignifyClient, waitOperation } from '../src/signify/client';
import {
    addAgentEndRole,
    createRole,
    createWitnessedIdentifier,
    resolveOobi,
    uniqueAlias,
    waitForEvent,
    waitForKeriaOperation,
    type Role,
} from './support/keria';

const appUrl =
    process.env.CONTACT_CHALLENGE_SMOKE_URL ?? 'http://127.0.0.1:5177';

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

const passcodeValue = (page: Page): Promise<string> =>
    page.$eval(
        '#outlined-password-input',
        (element) => (element as HTMLInputElement).value ?? ''
    );

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
            Array.from(
                globalThis.document.querySelectorAll(visibleSelector)
            ).some((element) => element.textContent?.includes(text)),
        { timeout },
        selector,
        expected
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

    return passcode;
};

const roleFromPasscode = async (
    passcode: string,
    name: string
): Promise<Role> => {
    const connected = await connectSignifyClient({
        adminUrl: appConfig.keria.adminUrl,
        bootUrl: appConfig.keria.bootUrl,
        passcode,
        tier: appConfig.defaultTier,
    });

    let role: Role;
    role = {
        name,
        passcode,
        client: connected.client,
        controllerPre: connected.state.controllerPre,
        agentPre: connected.state.agentPre,
        waitEvent: async (result, label) => waitForEvent(role, result, label),
        waitOperation: async (operation, label) =>
            waitForKeriaOperation(role, operation, label),
    };

    return role;
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
    await setInputValue(
        page,
        '[data-testid="contact-oobi-input"] textarea',
        oobi
    );
    await setInputValue(
        page,
        '[data-testid="contact-alias-input"] input',
        alias
    );
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

const generatedChallengeWords = async (page: Page): Promise<string[]> => {
    await page.waitForSelector('[data-testid="challenge-generated-words"]', {
        timeout: 30_000,
    });
    const text = await page.$eval(
        '[data-testid="challenge-generated-words"]',
        (element) => element.textContent ?? ''
    );
    const words = text.trim().split(/\s+/u).filter(Boolean);
    if (words.length !== 12 && words.length !== 24) {
        throw new Error(
            `Expected challenge words, got ${words.length} tokens.`
        );
    }

    return words;
};

const generatedKeriaChallengeWords = async (role: Role): Promise<string[]> => {
    const challenge = await role.client.challenges().generate(128);
    const words = Array.isArray(challenge.words) ? challenge.words : [];
    const error = validateChallengeWords(words);
    if (error !== null) {
        throw new Error(error);
    }

    return words.map((word) => word.trim().toLowerCase());
};

const sendChallengeRequest = async ({
    challenger,
    challengerAlias,
    recipientAid,
    words,
}: {
    challenger: Role;
    challengerAlias: string;
    recipientAid: string;
    words: readonly string[];
}): Promise<string> => {
    const challengeId = `smoke-challenge-${Date.now()}-${Math.random()
        .toString(16)
        .slice(2)}`;
    const hab = await challenger.client.identifiers().get(challengerAlias);
    await challenger.client.exchanges().send(
        challengerAlias,
        CHALLENGE_TOPIC,
        hab,
        CHALLENGE_REQUEST_ROUTE,
        {
            challengeId,
            wordsHash: challengeWordsFingerprint(words),
            strength: words.length === 24 ? 256 : 128,
        },
        {},
        [recipientAid]
    );

    return challengeId;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const exchangeChallengeId = (value: unknown): string | null => {
    if (!isRecord(value) || !isRecord(value.exn) || !isRecord(value.exn.a)) {
        return null;
    }

    const challengeId = value.exn.a.challengeId;
    return typeof challengeId === 'string' ? challengeId : null;
};

const exchangeSaid = (value: unknown): string | null => {
    if (!isRecord(value) || !isRecord(value.exn)) {
        return null;
    }

    const said = value.exn.d;
    return typeof said === 'string' ? said : null;
};

const challengeRequestExchanges = async (role: Role): Promise<unknown[]> => {
    const response = await role.client.fetch('/exchanges/query', 'POST', {
        filter: {
            '-r': CHALLENGE_REQUEST_ROUTE,
        },
        limit: 50,
    });
    const raw: unknown = await response.json();
    return Array.isArray(raw) ? raw : [];
};

const waitForChallengeRequestExchange = async (
    role: Role,
    challengeId: string
): Promise<string> => {
    for (let attempt = 0; attempt < 45; attempt += 1) {
        const exchanges = await challengeRequestExchanges(role);
        const exchange = exchanges.find(
            (candidate) => exchangeChallengeId(candidate) === challengeId
        );
        if (exchange !== undefined) {
            const said = exchangeSaid(exchange);
            if (said !== null) {
                return said;
            }
        }
        await sleep(1000);
    }

    throw new Error(`Challenge request ${challengeId} was not indexed.`);
};

const verifyChallengeResponse = async ({
    challenger,
    responderAid,
    words,
    label,
}: {
    challenger: Role;
    responderAid: string;
    words: readonly string[];
    label: string;
}): Promise<void> => {
    const operation = await challenger.client
        .challenges()
        .verify(responderAid, [...words]);
    const completed = await waitOperation(challenger.client, operation, {
        label: `${challenger.name}: ${label}`,
        ...appConfig.operations,
        timeoutMs: 120_000,
    });
    const responseSaid = responseSaidFromChallengeOperation(completed);
    const response = await challenger.client
        .challenges()
        .responded(responderAid, responseSaid);
    if (!response.ok) {
        throw new Error(
            `KERIA rejected ${label}: ${response.status} ${response.statusText}`
        );
    }
};

const openNotificationsBell = async (page: Page): Promise<void> => {
    await page.keyboard.press('Escape');
    await page.click('[data-testid="notifications-open"]');
};

const waitForChallengeNotificationCard = async (page: Page): Promise<void> => {
    await openNotificationsBell(page);
    try {
        await page.waitForSelector(
            '[data-testid="challenge-notification-card"]',
            {
                timeout: 45_000,
            }
        );
    } catch (error) {
        const visibleText = await page.evaluate(
            () => globalThis.document.body.textContent?.slice(0, 4000) ?? ''
        );
        throw new Error(
            `Challenge notification card did not appear. Visible text: ${visibleText}`,
            { cause: error }
        );
    }
};

const visibleChallengeResponseTextarea = (scope: string): string =>
    `${scope} [data-testid="challenge-notification-response-input"] textarea:not([aria-hidden="true"])`;

const respondFromBellNotification = async (
    page: Page,
    words: readonly string[]
): Promise<void> => {
    await waitForChallengeNotificationCard(page);
    await setInputValue(
        page,
        visibleChallengeResponseTextarea(
            '[data-testid="challenge-notification-card"]'
        ),
        words.join(' ')
    );
    await clickEnabledChallengeResponseSubmit(
        page,
        '[data-testid="challenge-notification-card"] [data-testid="challenge-notification-response-submit"]'
    );
};

const clickEnabledChallengeResponseSubmit = async (
    page: Page,
    selector: string
): Promise<void> => {
    try {
        await page.waitForFunction(
            (submitSelector) => {
                const element =
                    globalThis.document.querySelector(submitSelector);
                return (
                    element instanceof globalThis.HTMLButtonElement &&
                    !element.disabled
                );
            },
            { timeout: 10_000 },
            selector
        );
    } catch (error) {
        const visibleText = await page.evaluate(
            () => globalThis.document.body.textContent?.slice(0, 4000) ?? ''
        );
        throw new Error(
            `Challenge response submit did not become enabled for ${selector}. Visible text: ${visibleText}`,
            { cause: error }
        );
    }

    await page.click(selector);
};

const respondFromNotificationDetail = async (
    page: Page,
    words: readonly string[]
): Promise<void> => {
    await waitForChallengeNotificationCard(page);
    await page.click('[data-testid="challenge-notification-detail-link"]');
    await page.waitForFunction(
        () => globalThis.location.pathname.startsWith('/notifications/'),
        { timeout: 10_000 }
    );
    try {
        await page.waitForSelector(
            visibleChallengeResponseTextarea('main'),
            { timeout: 45_000 }
        );
    } catch (error) {
        const visibleText = await page.evaluate(
            () => globalThis.document.body.textContent?.slice(0, 4000) ?? ''
        );
        throw new Error(
            `Challenge notification detail did not render. Visible text: ${visibleText}`,
            { cause: error }
        );
    }
    await setInputValue(
        page,
        visibleChallengeResponseTextarea('main'),
        words.join(' ')
    );
    await clickEnabledChallengeResponseSubmit(
        page,
        'main [data-testid="challenge-notification-response-submit"]'
    );
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
    const browserRole = await roleFromPasscode(
        browserPasscode,
        'ui-challenge-browser'
    );
    const browserAlias = uniqueAlias('ui-challenge-browser');
    const browserAid = await createWitnessedIdentifier(
        browserRole,
        browserAlias
    );
    const browserOobi = await addAgentEndRole(browserRole, browserAlias);

    const harness = await createRole('ui-challenge-harness');
    const harnessAlias = uniqueAlias('ui-challenge-harness');
    await createWitnessedIdentifier(harness, harnessAlias);
    const harnessOobi = await addAgentEndRole(harness, harnessAlias);
    await resolveOobi(harness, browserOobi, browserAlias);

    await resolveOobiInContacts(page, harnessOobi, harnessAlias);
    await openContactDetail(page, harnessAlias);
    await waitForText(page, '[data-testid="contact-detail"]', 'Unverified');

    await page.click('[data-testid="challenge-generate-submit"]');
    const words = await generatedChallengeWords(page);

    await harness.client
        .challenges()
        .respond(harnessAlias, browserAid.prefix, words);
    await waitForText(
        page,
        '[data-testid="contact-detail"]',
        'Verified',
        180_000
    );
    await page.waitForFunction(
        () =>
            globalThis.document.querySelector(
                '[data-testid="challenge-generated-words"]'
            ) === null,
        { timeout: 30_000 }
    );

    const detailWords = await generatedKeriaChallengeWords(harness);
    const detailChallengeId = await sendChallengeRequest({
        challenger: harness,
        challengerAlias: harnessAlias,
        recipientAid: browserAid.prefix,
        words: detailWords,
    });
    await waitForChallengeRequestExchange(browserRole, detailChallengeId);
    await respondFromNotificationDetail(page, detailWords);
    await verifyChallengeResponse({
        challenger: harness,
        responderAid: browserAid.prefix,
        words: detailWords,
        label: 'verifying detail challenge response',
    });

    const bellWords = await generatedKeriaChallengeWords(harness);
    const bellChallengeId = await sendChallengeRequest({
        challenger: harness,
        challengerAlias: harnessAlias,
        recipientAid: browserAid.prefix,
        words: bellWords,
    });
    await waitForChallengeRequestExchange(browserRole, bellChallengeId);
    await respondFromBellNotification(page, bellWords);
    await verifyChallengeResponse({
        challenger: harness,
        responderAid: browserAid.prefix,
        words: bellWords,
        label: 'verifying bell challenge response',
    });

    console.log(
        JSON.stringify(
            {
                status: 'passed',
                browserAlias,
                harnessAlias,
                wordCount: words.length,
                bellWordCount: bellWords.length,
                detailWordCount: detailWords.length,
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
