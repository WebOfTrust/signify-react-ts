import { appConfig, type AppConfig } from '../../src/config';
import {
  connectSignifyClient,
  randomSignifyPasscode,
  waitForOperation,
  type SignifyClientConfig,
} from '../../src/signify/client';

/**
 * Shared implementation for the `pnpm keria:smoke` CLI.
 *
 * This sits with test scenarios because it is an integration check, but it uses
 * the production Signify boundary so smoke tests and app code exercise the same
 * client lifecycle behavior.
 */

export type ClientBoundarySmokeMode = 'connect' | 'witness';

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
  mode: ClientBoundarySmokeMode;
  adminUrl: string;
  bootUrl: string;
  passcode: string;
  booted: boolean;
  controllerAID: string;
  agentAID: string;
  identifierCount: number;
  identifierAlias?: string;
  identifierPrefix?: string;
  operationName?: string;
}

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
  const completedOperation = await waitForOperation(
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
