import {
  Algos,
  Serder,
  type CompletedOperation,
  type EventResult,
  type Operation,
  type SignifyClient,
} from 'signify-ts';
import { appConfig } from '../../src/config';
import {
  connectSignifyClient,
  randomSignifyPasscode,
  waitForOperation,
  type ConnectedSignifyClient,
} from '../../src/signify/client';
import {
  ScenarioSkip,
  type ScenarioContext,
  type ScenarioDefinition,
  type ScenarioResult,
  type ScenarioRuntimeConfig,
  type ScenarioStep,
} from './types';

/**
 * Shared machinery for KERIA scenario runners.
 *
 * Keep this file boring and reusable: runners should describe scenario intent,
 * while this module owns repeated mechanics such as fresh Signify clients,
 * unique aliases, operation waiting, OOBI resolution, and result normalization.
 * The code lives under `tests/` because these helpers are test infrastructure,
 * not wallet runtime behavior.
 */

export interface ScenarioClient {
  /** Human-readable role label used in step output. */
  role: string;
  /** Fresh passcode used for this role's controller. Useful for reproduction. */
  passcode: string;
  /** Connected boundary result, including the raw Signify client. */
  connected: ConnectedSignifyClient;
}

/**
 * Narrow projection of the identifier fields used by scenarios.
 *
 * Signify/KERIA returns broader JSON objects than the scenarios need. This type
 * documents the fields we assert against without pretending to model every
 * response shape.
 */
export interface IdentifierSummary {
  name: string;
  prefix: string;
  salty?: {
    pidx?: number;
    stem?: string;
  };
  state?: {
    i?: string;
    s?: string;
    f?: string;
    et?: string;
    d?: string;
    ee?: {
      d?: string;
    };
  };
  windexes?: unknown[];
}

interface ChallengeContact {
  id?: string;
  alias?: string;
  challenges?: {
    said?: string;
    words?: string[];
  }[];
}

let sequence = 0;

const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

const csvFromEnv = (value: string | undefined): string[] => {
  if (value === undefined || value.trim() === '') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const scenarioConfig = (): ScenarioRuntimeConfig => ({
  /*
   * App config intentionally contains only runtime app defaults. Optional
   * schema/delegation/multisig fixture knobs are read here so test-only config
   * does not leak into the wallet source model.
   */
  ...appConfig,
  scenarios: {
    schemaSaid: env.VITE_CREDENTIAL_SCHEMA_SAID,
    schemaOobiUrl: env.VITE_CREDENTIAL_SCHEMA_OOBI_URL,
    delegatorPre: env.VITE_DELEGATOR_PRE,
    delegatorOobi: env.VITE_DELEGATOR_OOBI,
    multisigMemberOobis: csvFromEnv(env.VITE_MULTISIG_MEMBER_OOBIS),
  },
});

const nowToken = (): string =>
  new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);

const nextSequence = (): number => {
  sequence += 1;
  return sequence;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const uniqueAlias = (base: string): string =>
  `${base}-${nowToken()}-${nextSequence().toString(36)}`;

/**
 * Scenario assertion helper that keeps runner code declarative.
 *
 * The thrown message is surfaced through `executeScenario` as the failure
 * reason, so write messages for maintainers debugging CI logs.
 */
export const assertScenario = (
  condition: unknown,
  message: string
): void => {
  if (!condition) {
    throw new Error(message);
  }
};

export const skipScenario = (message: string): never => {
  throw new ScenarioSkip(message);
};

/**
 * Create and connect one fresh Signify role for a scenario.
 *
 * Fresh passcodes and unique aliases keep scenario runs independent even when
 * KERIA state persists between local invocations.
 */
export const createScenarioClient = async (
  context: ScenarioContext,
  role: string
): Promise<ScenarioClient> => {
  const passcode = await randomSignifyPasscode();
  const connected = await connectSignifyClient({
    adminUrl: context.config.keria.adminUrl,
    bootUrl: context.config.keria.bootUrl,
    passcode,
    tier: context.config.defaultTier,
  });

  context.step(
    `${role} connected`,
    `${connected.state.controllerPre} / ${connected.state.agentPre}`
  );

  return {
    role,
    passcode,
    connected,
  };
};

export const waitForEventResult = async (
  context: ScenarioContext,
  client: SignifyClient,
  result: EventResult,
  label: string
): Promise<CompletedOperation> => {
  /*
   * Identifier APIs return EventResult wrappers. Convert them into normal KERIA
   * operations immediately so every scenario waits through the same boundary.
   */
  const operation = (await result.op()) as Operation;
  return waitForScenarioOperation(context, client, operation, label);
};

/**
 * Wait for a scenario operation and record the completed operation name.
 */
export const waitForScenarioOperation = async (
  context: ScenarioContext,
  client: SignifyClient,
  operation: Operation,
  label: string
): Promise<CompletedOperation> => {
  const completed = await waitForOperation(client, operation, {
    label,
    signal: context.signal,
    ...context.config.operations,
  });
  context.step(label, completed.name);
  return completed;
};

export const createIdentifier = async (
  context: ScenarioContext,
  scenarioClient: ScenarioClient,
  alias: string,
  args: Parameters<ReturnType<SignifyClient['identifiers']>['create']>[1] = {}
): Promise<IdentifierSummary> => {
  /*
   * Always fetch the identifier after the operation completes. The create
   * response is an event payload; the fetched identifier is the managed AID
   * record future scenario steps should use.
   */
  const client = scenarioClient.connected.client;
  const result = await client.identifiers().create(alias, args);
  await waitForEventResult(
    context,
    client,
    result,
    `${scenarioClient.role} creates ${alias}`
  );
  const identifier = (await client.identifiers().get(alias)) as IdentifierSummary;
  assertScenario(identifier.prefix, `Identifier ${alias} did not return prefix`);
  return identifier;
};

export const createWitnessedIdentifier = async (
  context: ScenarioContext,
  scenarioClient: ScenarioClient,
  alias: string
): Promise<IdentifierSummary> =>
  createIdentifier(context, scenarioClient, alias, {
    toad: context.config.witnesses.toad,
    wits: context.config.witnesses.aids,
  });

export const createRandyIdentifier = async (
  context: ScenarioContext,
  scenarioClient: ScenarioClient,
  alias: string
): Promise<IdentifierSummary> =>
  createIdentifier(context, scenarioClient, alias, { algo: Algos.randy });

export const listIdentifiers = async (
  client: SignifyClient
): Promise<IdentifierSummary[]> => {
  const response = (await client.identifiers().list()) as {
    aids?: IdentifierSummary[];
  };
  return response.aids ?? [];
};

export const addAgentEndRole = async (
  context: ScenarioContext,
  scenarioClient: ScenarioClient,
  alias: string
): Promise<string> => {
  /*
   * OOBI exchange between Signify roles requires the managed AID to authorize
   * its agent endpoint first. Return the role-specific agent OOBI so peers can
   * resolve it with a local alias.
   */
  const client = scenarioClient.connected.client;
  const agentPre = scenarioClient.connected.state.agentPre;
  assertScenario(agentPre, `${scenarioClient.role} has no agent prefix`);
  const endRole = await client.identifiers().addEndRole(alias, 'agent', agentPre);
  await waitForEventResult(
    context,
    client,
    endRole,
    `${scenarioClient.role} authorizes agent role for ${alias}`
  );

  const oobi = await client.oobis().get(alias, 'agent');
  const urls = oobi.oobis ?? [];
  assertScenario(urls.length > 0, `${alias} did not return an agent OOBI`);
  context.step(`${scenarioClient.role} gets agent OOBI`, urls[0]);
  return urls[0];
};

export const resolveOobi = async (
  context: ScenarioContext,
  scenarioClient: ScenarioClient,
  oobi: string,
  alias: string
): Promise<void> => {
  /*
   * OOBI resolution is a KERIA operation. Keep the alias explicit so contact
   * names in later scenario assertions are predictable.
   */
  const client = scenarioClient.connected.client;
  const operation = await client.oobis().resolve(oobi, alias);
  await waitForOperation(client, operation, {
    label: `${scenarioClient.role} resolves ${alias}`,
    signal: context.signal,
    ...context.config.operations,
  });
  context.step(`${scenarioClient.role} resolves ${alias}`, oobi);
};

export const serderFromOperation = (response: unknown): Serder =>
  new Serder(response as Record<string, unknown>);

export const hasWords = (
  actual: string[] | undefined,
  expected: string[]
): boolean =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  actual.every((word, index) => word === expected[index]);

export const waitForChallenge = async (
  context: ScenarioContext,
  client: SignifyClient,
  sourcePrefix: string,
  expectedWords: string[]
): Promise<{ said: string }> => {
  /*
   * Challenge delivery is observable through contacts, not a direct operation
   * returned by `respond`. This is the one polling helper in the scenario layer;
   * it is bounded by the shared operation timeout.
   */
  const timeoutAt = Date.now() + context.config.operations.timeoutMs;

  while (Date.now() < timeoutAt) {
    const contacts = (await client.contacts().list()) as ChallengeContact[];
    const challenge = contacts
      .find((contact) => contact.id === sourcePrefix)
      ?.challenges?.find((item) => hasWords(item.words, expectedWords));

    if (challenge?.said) {
      return { said: challenge.said };
    }

    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, context.config.operations.minSleepMs)
    );
  }

  throw new Error(`Timed out waiting for challenge from ${sourcePrefix}`);
};

export const executeScenario = async (
  definition: ScenarioDefinition,
  options: { config?: ScenarioRuntimeConfig; signal?: AbortSignal } = {}
): Promise<ScenarioResult> => {
  /*
   * Normalize all runner outcomes into a result object so Vitest, CLI wrappers,
   * and future renderers can consume the same shape without special error
   * handling. Runners should throw `ScenarioSkip` for missing optional fixtures.
   */
  const startedAt = Date.now();
  const steps: ScenarioStep[] = [];
  const context: ScenarioContext = {
    config: options.config ?? scenarioConfig(),
    signal: options.signal,
    step: (label, detail) => steps.push({ label, detail }),
  };

  try {
    const outcome = await definition.run(context);
    return {
      id: definition.id,
      title: definition.title,
      status: 'passed',
      summary: outcome.summary,
      durationMs: Date.now() - startedAt,
      steps,
      details: outcome.details,
    };
  } catch (error) {
    if (error instanceof ScenarioSkip) {
      return {
        id: definition.id,
        title: definition.title,
        status: 'skipped',
        summary: error.message,
        durationMs: Date.now() - startedAt,
        steps,
      };
    }

    return {
      id: definition.id,
      title: definition.title,
      status: 'failed',
      summary: 'Scenario failed',
      durationMs: Date.now() - startedAt,
      steps,
      error: errorMessage(error),
    };
  }
};
