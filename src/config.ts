import { Tier } from 'signify-ts';

/**
 * Runtime configuration shared by browser code and Node-based smoke scripts.
 *
 * Vite exposes browser-safe variables through `import.meta.env`; the CLI smoke
 * scripts run under Node and use `process.env`. This module merges both so the
 * app and executable checks read the same typed knobs without duplicating
 * defaults.
 */
const viteEnv = import.meta.env;
const nodeEnv =
    (globalThis as { process?: { env?: Record<string, string | undefined> } })
        .process?.env ?? {};

const env = {
    ...nodeEnv,
    ...viteEnv,
};

const DEFAULT_KERIA_ADMIN_URL = 'http://127.0.0.1:3901';
const DEFAULT_KERIA_ROUTER_URL = 'http://127.0.0.1:3902';
const DEFAULT_KERIA_BOOT_URL = 'http://127.0.0.1:3903';
const DEFAULT_VERIFIER_DIRECT_URL = 'http://127.0.0.1:9723';
const DEFAULT_VERIFIER_DASHBOARD_URL = 'http://127.0.0.1:9923';
const DEFAULT_WITNESS_AIDS = [
    'BBilc4-L3tFUnfM_wJr4S4OJanAv_VmF_dJNN6vkf2Ha',
    'BLskRTInXnMxWaGqcpSyMgo0nYbalW99cGZESrz3zapM',
    'BIKKuvBwpmDVA4Ds-EpL5bt9OqPzWPja2LigFYZN2YfX',
] as const;

/**
 * Raw environment map consumed by `buildAppConfig`.
 *
 * Keep this shape intentionally boring so tests, Vite browser builds, and Node
 * smoke scripts can all pass plain key/value environment objects.
 */
export type RuntimeEnv = Record<string, string | undefined>;

/**
 * One selectable KERIA target in the connect dialog.
 *
 * `adminUrl` and `bootUrl` travel together because a Signify client must boot
 * and connect against the same KERIA deployment. Add a new option through env or
 * `buildAppConfig`; do not hardcode URLs in React components.
 */
export interface ConnectionOption {
    label: string;
    adminUrl: string;
    bootUrl: string;
}

export interface KeriaConfig {
    /** KERIA admin API URL used by authenticated Signify client calls. */
    adminUrl: string;
    /** KERIA router/direct protocol URL for future direct-mode flows. */
    routerUrl: string;
    /** KERIA boot API URL used when an agent does not exist yet. */
    bootUrl: string;
}

export interface OperationConfig {
    /** Upper bound for a single KERIA operation wait. */
    timeoutMs: number;
    /** Initial polling interval passed to Signify's operation waiter. */
    minSleepMs: number;
    /** Maximum polling interval passed to Signify's operation waiter. */
    maxSleepMs: number;
}

export interface WitnessConfig {
    /** Witness AIDs used by local smoke scenarios and witnessed AID creation. */
    aids: string[];
    /** Backer threshold passed as `toad` when creating witnessed identifiers. */
    toad: number;
}

/**
 * Demo role defaults for scripted app/scenario flows.
 *
 * Passcodes are optional and browser-visible when set through `VITE_*`, so they
 * are only suitable for local demos or reproducible smoke scripts.
 */
export interface DemoRoleConfig {
    alias: string;
    passcode: string | null;
}

export interface RoleConfig {
    issuer: DemoRoleConfig;
    holder: DemoRoleConfig;
    verifier: DemoRoleConfig;
}

export interface SchemaConfig {
    /** SAID of the schema the demo should resolve and issue against. */
    said: string | null;
    /** OOBI URL that resolves the schema into KERIA/Sally state. */
    oobiUrl: string | null;
}

export interface SchemaConfigs {
    sediVoterId: SchemaConfig;
}

export interface VerifierConfig {
    /** Sally-style direct-mode endpoint for holder presentation grants. */
    directUrl: string;
    /** HTMX/dashboard endpoint that exposes verification status. */
    dashboardUrl: string;
    /** Verifier OOBI URL, when an external verifier is configured. */
    oobiUrl: string | null;
    /** Issuer AID the verifier should trust for the SEDI demo. */
    trustedIssuerAid: string | null;
}

/**
 * App/demo runtime configuration.
 *
 * This is the boundary for values used by browser code, smoke scripts, and
 * reusable scenario helpers. Test-only external fixtures do not belong here;
 * keep those in `tests/support/config.ts` so app code does not learn about
 * fixture setup for delegation, multisig, or other optional harness concerns.
 */
export interface AppConfig {
    connectionOptions: readonly [ConnectionOption, ...ConnectionOption[]];
    keria: KeriaConfig;
    operations: OperationConfig;
    witnesses: WitnessConfig;
    roles: RoleConfig;
    schemas: SchemaConfigs;
    verifier: VerifierConfig;
    defaultTier: Tier;
}

/**
 * Normalize optional env values.
 *
 * Empty strings are treated as absent so `.env` files can include commented or
 * blank placeholders without becoming meaningful config values.
 */
const optionalString = (value: string | undefined): string | null => {
    if (value === undefined || value.trim() === '') {
        return null;
    }

    return value.trim();
};

const stringFromEnv = (
    envName: string,
    value: string | undefined,
    fallback: string
): string => optionalString(value) ?? fallback;

const numberFromEnv = (
    envName: string,
    value: string | undefined,
    fallback: number
): number => {
    if (value === undefined || value.trim() === '') {
        return fallback;
    }

    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${envName} must be a finite number.`);
    }

    return parsed;
};

const csvFromEnv = (
    value: string | undefined,
    fallback: readonly string[] = []
): string[] => {
    if (value === undefined || value.trim() === '') {
        return [...fallback];
    }

    return value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
};

const buildConnectionOptions = (
    runtimeEnv: RuntimeEnv,
    keria: KeriaConfig
): readonly [ConnectionOption, ...ConnectionOption[]] => {
    const options: [ConnectionOption, ...ConnectionOption[]] = [
        {
            label: stringFromEnv(
                'VITE_KERIA_CONNECTION_LABEL',
                runtimeEnv.VITE_KERIA_CONNECTION_LABEL,
                'Local KERIA'
            ),
            adminUrl: keria.adminUrl,
            bootUrl: keria.bootUrl,
        },
    ];

    const cloudAdminUrl = optionalString(runtimeEnv.VITE_CLOUD_KERIA_ADMIN_URL);
    const cloudBootUrl = optionalString(runtimeEnv.VITE_CLOUD_KERIA_BOOT_URL);

    if (cloudAdminUrl !== null || cloudBootUrl !== null) {
        if (cloudAdminUrl === null || cloudBootUrl === null) {
            throw new Error(
                'VITE_CLOUD_KERIA_ADMIN_URL and VITE_CLOUD_KERIA_BOOT_URL must be set together.'
            );
        }

        options.push({
            label: stringFromEnv(
                'VITE_CLOUD_KERIA_CONNECTION_LABEL',
                runtimeEnv.VITE_CLOUD_KERIA_CONNECTION_LABEL,
                'Cloud KERIA'
            ),
            adminUrl: cloudAdminUrl,
            bootUrl: cloudBootUrl,
        });
    }

    return options;
};

/**
 * Build app config from an explicit environment map.
 *
 * This is the only place that maps `VITE_*` names into app runtime config.
 * Keep it pure so Node tests can verify config behavior without depending on
 * Vite or process globals. Numeric env values fail fast when malformed; optional
 * strings normalize blanks to `null`; CSV lists trim whitespace and drop empty
 * items.
 *
 * Supported legacy aliases:
 * - `VITE_CREDENTIAL_SCHEMA_SAID`
 * - `VITE_CREDENTIAL_SCHEMA_OOBI_URL`
 *
 * Do not add test-only fixture variables here. Use `tests/support/config.ts`
 * for optional test harness values.
 */
export const buildAppConfig = (runtimeEnv: RuntimeEnv): AppConfig => {
    const keria: KeriaConfig = {
        adminUrl: stringFromEnv(
            'VITE_KERIA_ADMIN_URL',
            runtimeEnv.VITE_KERIA_ADMIN_URL,
            DEFAULT_KERIA_ADMIN_URL
        ),
        routerUrl: stringFromEnv(
            'VITE_KERIA_ROUTER_URL',
            runtimeEnv.VITE_KERIA_ROUTER_URL,
            DEFAULT_KERIA_ROUTER_URL
        ),
        bootUrl: stringFromEnv(
            'VITE_KERIA_BOOT_URL',
            runtimeEnv.VITE_KERIA_BOOT_URL,
            DEFAULT_KERIA_BOOT_URL
        ),
    };

    return {
        connectionOptions: buildConnectionOptions(runtimeEnv, keria),
        keria,
        operations: {
            timeoutMs: numberFromEnv(
                'VITE_OPERATION_TIMEOUT_MS',
                runtimeEnv.VITE_OPERATION_TIMEOUT_MS,
                30000
            ),
            minSleepMs: numberFromEnv(
                'VITE_OPERATION_MIN_SLEEP_MS',
                runtimeEnv.VITE_OPERATION_MIN_SLEEP_MS,
                1000
            ),
            maxSleepMs: numberFromEnv(
                'VITE_OPERATION_MAX_SLEEP_MS',
                runtimeEnv.VITE_OPERATION_MAX_SLEEP_MS,
                5000
            ),
        },
        witnesses: {
            aids: csvFromEnv(
                runtimeEnv.VITE_WITNESS_AIDS,
                DEFAULT_WITNESS_AIDS
            ),
            toad: numberFromEnv(
                'VITE_WITNESS_TOAD',
                runtimeEnv.VITE_WITNESS_TOAD,
                2
            ),
        },
        roles: {
            issuer: {
                alias: stringFromEnv(
                    'VITE_ISSUER_ALIAS',
                    runtimeEnv.VITE_ISSUER_ALIAS,
                    'issuer'
                ),
                passcode: optionalString(runtimeEnv.VITE_ISSUER_PASSCODE),
            },
            holder: {
                alias: stringFromEnv(
                    'VITE_HOLDER_ALIAS',
                    runtimeEnv.VITE_HOLDER_ALIAS,
                    'holder'
                ),
                passcode: optionalString(runtimeEnv.VITE_HOLDER_PASSCODE),
            },
            verifier: {
                alias: stringFromEnv(
                    'VITE_VERIFIER_ALIAS',
                    runtimeEnv.VITE_VERIFIER_ALIAS,
                    'verifier'
                ),
                passcode: optionalString(runtimeEnv.VITE_VERIFIER_PASSCODE),
            },
        },
        schemas: {
            sediVoterId: {
                said:
                    optionalString(runtimeEnv.VITE_SEDI_VOTER_ID_SCHEMA_SAID) ??
                    optionalString(runtimeEnv.VITE_CREDENTIAL_SCHEMA_SAID),
                oobiUrl:
                    optionalString(
                        runtimeEnv.VITE_SEDI_VOTER_ID_SCHEMA_OOBI_URL
                    ) ??
                    optionalString(runtimeEnv.VITE_CREDENTIAL_SCHEMA_OOBI_URL),
            },
        },
        verifier: {
            directUrl: stringFromEnv(
                'VITE_VERIFIER_DIRECT_URL',
                runtimeEnv.VITE_VERIFIER_DIRECT_URL,
                DEFAULT_VERIFIER_DIRECT_URL
            ),
            dashboardUrl: stringFromEnv(
                'VITE_VERIFIER_DASHBOARD_URL',
                runtimeEnv.VITE_VERIFIER_DASHBOARD_URL,
                DEFAULT_VERIFIER_DASHBOARD_URL
            ),
            oobiUrl: optionalString(runtimeEnv.VITE_VERIFIER_OOBI_URL),
            trustedIssuerAid: optionalString(
                runtimeEnv.VITE_TRUSTED_ISSUER_AID
            ),
        },
        defaultTier: Tier.low,
    };
};

/**
 * Process-wide app config singleton.
 *
 * Browser code receives Vite's `import.meta.env`; Node smoke scripts receive
 * `process.env`. The merged map is resolved once at module load, so tests that
 * need alternate values should call `buildAppConfig` directly.
 */
export const appConfig: AppConfig = buildAppConfig(env);
