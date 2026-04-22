import { appConfig, type AppConfig } from '../../src/config';
import {
  connectSignifyClient,
  randomSignifyPasscode,
  waitOperation,
  type SignifyClientConfig,
} from '../../src/signify/client';

/**
 * Shared implementation for the `pnpm keria:smoke` CLI.
 *
 * This sits with smoke tests because it is a boundary integration check, but it
 * uses the production Signify boundary so smoke tests and app code exercise the
 * same client lifecycle behavior.
 */

/**
 * Smoke mode selector for fast connect-only checks or witnessed AID checks.
 */
export type ClientBoundarySmokeMode = 'connect' | 'witness';

/**
 * Runtime options accepted by the reusable client-boundary smoke runner.
 */
export interface ClientBoundarySmokeOptions {
  /** `connect` verifies boot/connect/state only; `witness` also creates an AID. */
  mode?: ClientBoundarySmokeMode;
  /** Optional fixed passcode for reproducing a specific local agent. */
  passcode?: string;
  /** Optional fixed identifier alias for reproducing witness behavior. */
  alias?: string;
  /** Override app config in tests without mutating process environment. */
  config?: AppConfig;
}

/**
 * Compact result emitted by CLI smoke checks and usable by future tests.
 */
export interface ClientBoundarySmokeSummary {
  /** Smoke mode that produced this summary. */
  mode: ClientBoundarySmokeMode;
  /** KERIA admin URL used for signed client calls. */
  adminUrl: string;
  /** KERIA boot URL used for missing-agent bootstrapping. */
  bootUrl: string;
  /** Passcode used for the smoke controller; printed for reproducibility. */
  passcode: string;
  /** True when this run booted a new KERIA agent before connecting. */
  booted: boolean;
  /** Controller AID read from normalized Signify state. */
  controllerAID: string;
  /** Agent AID read from normalized Signify state. */
  agentAID: string;
  /** Number of identifiers listed before optional witness creation. */
  identifierCount: number;
  /** Alias created by witness mode. */
  identifierAlias?: string;
  /** Prefix of the identifier created by witness mode. */
  identifierPrefix?: string;
  /** Completed KERIA operation name from witness mode. */
  operationName?: string;
}

/**
 * Count identifiers from either raw array or Signify response envelope.
 */
const identifierCount = (identifiers: unknown): number => {
  if (Array.isArray(identifiers)) {
    return identifiers.length;
  }

  if (
    typeof identifiers === 'object' &&
    identifiers !== null &&
    'aids' in identifiers &&
    Array.isArray((identifiers as { aids: unknown }).aids)
  ) {
    return (identifiers as { aids: unknown[] }).aids.length;
  }

  return 0;
};

/**
 * Generate a collision-resistant alias for smoke-created identifiers.
 */
const uniqueAlias = (): string =>
  `smoke-${new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)}`;

/**
 * Exercise the Signify boundary against a running local KERIA instance.
 *
 * This function is intentionally independent from React. CLI and browser tests
 * can use the same boundary behavior without duplicating KERIA setup logic.
 */
export const runClientBoundarySmoke = async (
  options: ClientBoundarySmokeOptions = {}
): Promise<ClientBoundarySmokeSummary> => {
  const config = options.config ?? appConfig;
  const mode = options.mode ?? 'witness';
  const passcode = options.passcode ?? (await randomSignifyPasscode());
  const clientConfig: SignifyClientConfig = {
    adminUrl: config.keria.adminUrl,
    bootUrl: config.keria.bootUrl,
    passcode,
    tier: config.defaultTier,
  };

  const connected = await connectSignifyClient(clientConfig);
  const identifiers = await connected.client.identifiers().list();
  const summary: ClientBoundarySmokeSummary = {
    mode,
    adminUrl: config.keria.adminUrl,
    bootUrl: config.keria.bootUrl,
    passcode,
    booted: connected.booted,
    controllerAID: connected.state.controllerPre,
    agentAID: connected.state.agentPre,
    identifierCount: identifierCount(identifiers),
  };

  if (mode === 'connect') {
    return summary;
  }

  const alias = options.alias ?? uniqueAlias();
  const createResult = await connected.client.identifiers().create(alias, {
    toad: config.witnesses.toad,
    wits: config.witnesses.aids,
  });
  const operation = await createResult.op();
  const completedOperation = await waitOperation(
    connected.client,
    operation,
    {
      label: `creating witnessed identifier ${alias}`,
      ...config.operations,
    }
  );
  const identifier = await connected.client.identifiers().get(alias);

  return {
    ...summary,
    identifierAlias: alias,
    identifierPrefix: identifier.prefix,
    operationName: completedOperation.name,
  };
};
