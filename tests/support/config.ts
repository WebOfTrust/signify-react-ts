/**
 * Raw environment map consumed by `buildTestConfig`.
 *
 * Test config is separate from `src/config.ts` on purpose. Optional external
 * fixtures are harness concerns, not app runtime concerns, and should never be
 * imported by browser code.
 */
export type TestRuntimeEnv = Record<string, string | undefined>;

/**
 * External delegator fixture for the optional delegation scenario.
 *
 * Both fields must be present for the scenario to run; otherwise the test is
 * skipped. The fixture represents state prepared outside this app.
 */
export interface DelegationFixtureConfig {
    delegatorPre: string | null;
    delegatorOobi: string | null;
}

/**
 * External multisig member OOBIs for the optional multisig scenario.
 *
 * At least two OOBIs are required before the optional test runs.
 */
export interface MultisigFixtureConfig {
    memberOobis: string[];
}

/**
 * Test-only config boundary.
 *
 * Add optional fixture knobs here only when they are consumed exclusively by
 * tests. If a value is needed by React, smoke scripts, or app scenario helpers,
 * it belongs in `src/config.ts` instead.
 */
export interface TestConfig {
    fixtures: {
        delegation: DelegationFixtureConfig;
        multisig: MultisigFixtureConfig;
    };
}

const env =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env ?? {};

const optionalString = (value: string | undefined): string | null => {
    if (value === undefined || value.trim() === '') {
        return null;
    }

    return value.trim();
};

const csvFromEnv = (value: string | undefined): string[] => {
    if (value === undefined || value.trim() === '') {
        return [];
    }

    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
};

/**
 * Build test fixture config from an explicit environment map.
 *
 * This function is pure for unit testing and mirrors `buildAppConfig` without
 * coupling fixture state into app runtime config.
 */
export const buildTestConfig = (runtimeEnv: TestRuntimeEnv): TestConfig => ({
    fixtures: {
        delegation: {
            delegatorPre: optionalString(runtimeEnv.VITE_DELEGATOR_PRE),
            delegatorOobi: optionalString(runtimeEnv.VITE_DELEGATOR_OOBI),
        },
        multisig: {
            memberOobis: csvFromEnv(runtimeEnv.VITE_MULTISIG_MEMBER_OOBIS),
        },
    },
});

/**
 * Process-wide test config singleton for Vitest scenario files.
 */
export const testConfig = buildTestConfig(env);
