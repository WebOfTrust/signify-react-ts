import { Tier } from 'signify-ts';

/**
 * Runtime configuration shared by browser code and Node-based smoke scripts.
 *
 * Vite exposes browser-safe variables through `import.meta.env`; the CLI smoke
 * scripts run under Node and use `process.env`. This module merges both so the
 * app and executable checks read the same knobs without duplicating defaults.
 */
const viteEnv = import.meta.env;
const nodeEnv =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

const env = {
  ...nodeEnv,
  ...viteEnv,
};

const numberFromEnv = (value: string | undefined, fallback: number): number => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const csvFromEnv = (value: string | undefined, fallback: string[]): string[] => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export interface KeriaConfig {
  /** KERIA admin API URL used by authenticated Signify client calls. */
  adminUrl: string;
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
  /** Witness AIDs used by local smoke scenarios. */
  aids: string[];
  /** Witness threshold used when creating local smoke identifiers. */
  toad: number;
}

export interface AppConfig {
  keria: KeriaConfig;
  operations: OperationConfig;
  witnesses: WitnessConfig;
  defaultTier: Tier;
}

/**
 * App-wide defaults for local development and smoke testing.
 *
 * These defaults intentionally target the local KERIA/witness demo. Production
 * or shared environments should override them through `VITE_*` variables rather
 * than changing these constants.
 */
export const appConfig: AppConfig = {
  keria: {
    adminUrl: env.VITE_KERIA_ADMIN_URL ?? 'http://127.0.0.1:3901',
    bootUrl: env.VITE_KERIA_BOOT_URL ?? 'http://127.0.0.1:3903',
  },
  operations: {
    timeoutMs: numberFromEnv(env.VITE_OPERATION_TIMEOUT_MS, 30000),
    minSleepMs: numberFromEnv(env.VITE_OPERATION_MIN_SLEEP_MS, 1000),
    maxSleepMs: numberFromEnv(env.VITE_OPERATION_MAX_SLEEP_MS, 5000),
  },
  witnesses: {
    aids: csvFromEnv(env.VITE_WITNESS_AIDS, [
      'BBilc4-L3tFUnfM_wJr4S4OJanAv_VmF_dJNN6vkf2Ha',
      'BLskRTInXnMxWaGqcpSyMgo0nYbalW99cGZESrz3zapM',
      'BIKKuvBwpmDVA4Ds-EpL5bt9OqPzWPja2LigFYZN2YfX',
    ]),
    toad: numberFromEnv(env.VITE_WITNESS_TOAD, 2),
  },
  defaultTier: Tier.low,
};
