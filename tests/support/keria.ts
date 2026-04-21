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
  waitOperation,
} from '../../src/signify/client';

/**
 * Small KERIA test support layer.
 *
 * Scenario tests should read like scripts. Keep only the shared mechanics here:
 * fresh Signify roles, unique aliases, operation waits, witnessed AID helpers,
 * OOBI exchange, challenge polling, and optional-fixture environment parsing.
 */

export interface IdentifierSummary {
  name: string;
  prefix: string;
  state?: {
    d?: string;
  };
  windexes?: unknown[];
}

interface ChallengeContact {
  id?: string;
  challenges?: {
    said?: string;
    words?: string[];
  }[];
}

export interface Role {
  name: string;
  passcode: string;
  client: SignifyClient;
  controllerPre: string;
  agentPre: string;
  waitEvent(result: EventResult, label: string): Promise<CompletedOperation>;
  waitOperation(operation: Operation, label: string): Promise<CompletedOperation>;
}

let sequence = 0;

export const env =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

export const envList = (name: string): string[] => {
  const value = env[name];
  if (value === undefined || value.trim() === '') {
    return [];
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

export const requiredEnv = (name: string): string => {
  const value = env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Set ${name} to run this optional scenario.`);
  }

  return value;
};

export const uniqueAlias = (base: string): string => {
  sequence += 1;
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);
  return `${base}-${timestamp}-${sequence.toString(36)}`;
};

export const createRole = async (name: string): Promise<Role> => {
  const passcode = await randomSignifyPasscode();
  const connected = await connectSignifyClient({
    adminUrl: appConfig.keria.adminUrl,
    bootUrl: appConfig.keria.bootUrl,
    passcode,
    tier: appConfig.defaultTier,
  });

  const role: Role = {
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

export const waitForKeriaOperation = async (
  role: Role,
  operation: Operation,
  label: string
): Promise<CompletedOperation> =>
  waitOperation(role.client, operation, {
    label: `${role.name}: ${label}`,
    ...appConfig.operations,
  });

export const waitForEvent = async (
  role: Role,
  result: EventResult,
  label: string
): Promise<CompletedOperation> => {
  const operation = (await result.op()) as Operation;
  return waitForKeriaOperation(role, operation, label);
};

export const createIdentifier = async (
  role: Role,
  alias: string,
  args: Parameters<ReturnType<SignifyClient['identifiers']>['create']>[1] = {}
): Promise<IdentifierSummary> => {
  const result = await role.client.identifiers().create(alias, args);
  await role.waitEvent(result, `creates ${alias}`);
  return role.client.identifiers().get(alias) as Promise<IdentifierSummary>;
};

export const createWitnessedIdentifier = (
  role: Role,
  alias: string
): Promise<IdentifierSummary> =>
  createIdentifier(role, alias, {
    toad: appConfig.witnesses.toad,
    wits: appConfig.witnesses.aids,
  });

export const createRandyIdentifier = (
  role: Role,
  alias: string
): Promise<IdentifierSummary> =>
  createIdentifier(role, alias, { algo: Algos.randy });

export const listIdentifiers = async (
  client: SignifyClient
): Promise<IdentifierSummary[]> => {
  const response = (await client.identifiers().list()) as {
    aids?: IdentifierSummary[];
  };
  return response.aids ?? [];
};

export const addAgentEndRole = async (
  role: Role,
  alias: string
): Promise<string> => {
  const result = await role.client
    .identifiers()
    .addEndRole(alias, 'agent', role.agentPre);
  await role.waitEvent(result, `authorizes agent role for ${alias}`);

  const response = await role.client.oobis().get(alias, 'agent');
  const urls = response.oobis ?? [];
  if (urls.length === 0) {
    throw new Error(`${alias} did not return an agent OOBI`);
  }

  return urls[0];
};

export const resolveOobi = async (
  role: Role,
  oobi: string,
  alias: string
): Promise<void> => {
  const operation = await role.client.oobis().resolve(oobi, alias);
  await role.waitOperation(operation, `resolves ${alias}`);
};

export const exchangeAgentOobis = async (
  left: Role,
  leftAlias: string,
  right: Role,
  rightAlias: string
): Promise<void> => {
  const leftOobi = await addAgentEndRole(left, leftAlias);
  const rightOobi = await addAgentEndRole(right, rightAlias);

  await resolveOobi(left, rightOobi, rightAlias);
  await resolveOobi(right, leftOobi, leftAlias);
};

export const serderFromOperation = (response: unknown): Serder =>
  new Serder(response as Record<string, unknown>);

const sameWords = (
  actual: string[] | undefined,
  expected: string[]
): boolean =>
  Array.isArray(actual) &&
  actual.length === expected.length &&
  actual.every((word, index) => word === expected[index]);

export const waitForChallenge = async (
  client: SignifyClient,
  sourcePrefix: string,
  expectedWords: string[]
): Promise<{ said: string }> => {
  const timeoutAt = Date.now() + appConfig.operations.timeoutMs;

  while (Date.now() < timeoutAt) {
    const contacts = (await client.contacts().list()) as ChallengeContact[];
    const challenge = contacts
      .find((contact) => contact.id === sourcePrefix)
      ?.challenges?.find((item) => sameWords(item.words, expectedWords));

    if (challenge?.said) {
      return { said: challenge.said };
    }

    await new Promise((resolve) =>
      globalThis.setTimeout(resolve, appConfig.operations.minSleepMs)
    );
  }

  throw new Error(`Timed out waiting for challenge from ${sourcePrefix}`);
};
