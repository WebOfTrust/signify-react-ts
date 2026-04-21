import {
    Algos,
    Serder,
    type Contact,
    type CompletedOperation,
    type CreateIdentiferArgs,
    type EventResult,
    type HabState,
    type Operation,
    type SignifyClient,
} from 'signify-ts';
import { appConfig } from '../../src/config';
import { identifiersFromResponse } from '../../src/features/identifiers/identifierHelpers';
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
 * OOBI exchange, and challenge polling. Optional fixture values come from the
 * typed app config boundary.
 */

/**
 * Identifier projection used by scenario tests after Signify normalization.
 */
export type IdentifierSummary = HabState;

/**
 * Connected Signify role used by scenario tests.
 *
 * A role is intentionally richer than a raw client: it carries reproducibility
 * metadata, normalized controller/agent AIDs, and bound wait helpers so tests
 * can read as a script instead of threading context through every call.
 */
export interface Role {
    /** Human-readable role label used in operation labels and failures. */
    name: string;
    /** Passcode used to create/connect the role's controller. */
    passcode: string;
    /** Raw connected Signify client for direct resource APIs. */
    client: SignifyClient;
    /** Normalized controller AID read immediately after connection. */
    controllerPre: string;
    /** Normalized agent AID read immediately after connection. */
    agentPre: string;
    /** Wait for a Signify EventResult through the shared operation boundary. */
    waitEvent(result: EventResult, label: string): Promise<CompletedOperation>;
    /** Wait for a raw KERIA operation through the shared operation boundary. */
    waitOperation(
        operation: Operation,
        label: string
    ): Promise<CompletedOperation>;
}

let sequence = 0;

/**
 * Return a configured passcode for long-lived demo roles when one is present.
 */
const configuredPasscodeForRole = (name: string): string | null => {
    if (name === appConfig.roles.issuer.alias) {
        return appConfig.roles.issuer.passcode;
    }

    if (name === appConfig.roles.holder.alias) {
        return appConfig.roles.holder.passcode;
    }

    if (name === appConfig.roles.verifier.alias) {
        return appConfig.roles.verifier.passcode;
    }

    return null;
};

/**
 * Create an alias that avoids collisions in persistent local KERIA state.
 */
export const uniqueAlias = (base: string): string => {
    sequence += 1;
    const timestamp = new Date()
        .toISOString()
        .replace(/[-:.TZ]/g, '')
        .slice(0, 14);
    return `${base}-${timestamp}-${sequence.toString(36)}`;
};

/**
 * Create and connect a fresh Signify role for a scenario.
 *
 * Issuer/holder/verifier can reuse configured passcodes for scripted demos;
 * every other role gets random passcode material by default.
 */
export const createRole = async (name: string): Promise<Role> => {
    const passcode =
        configuredPasscodeForRole(name) ?? (await randomSignifyPasscode());
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

/**
 * Wait for a KERIA operation using the app operation timeout policy.
 */
export const waitForKeriaOperation = async (
    role: Role,
    operation: Operation,
    label: string
): Promise<CompletedOperation> =>
    waitOperation(role.client, operation, {
        label: `${role.name}: ${label}`,
        ...appConfig.operations,
    });

/**
 * Convert a Signify EventResult into a KERIA operation and wait for completion.
 */
export const waitForEvent = async (
    role: Role,
    result: EventResult,
    label: string
): Promise<CompletedOperation> => {
    const operation = (await result.op()) as Operation;
    return waitForKeriaOperation(role, operation, label);
};

/**
 * Create a managed identifier and return its fetched HabState summary.
 */
export const createIdentifier = async (
    role: Role,
    alias: string,
    args: CreateIdentiferArgs = {}
): Promise<IdentifierSummary> => {
    const result = await role.client.identifiers().create(alias, args);
    await role.waitEvent(result, `creates ${alias}`);
    return role.client.identifiers().get(alias);
};

/**
 * Create a witnessed identifier using the configured local demo witnesses.
 */
export const createWitnessedIdentifier = (
    role: Role,
    alias: string
): Promise<IdentifierSummary> =>
    createIdentifier(role, alias, {
        toad: appConfig.witnesses.toad,
        wits: appConfig.witnesses.aids,
    });

/**
 * Create an identifier with random key material.
 */
export const createRandyIdentifier = (
    role: Role,
    alias: string
): Promise<IdentifierSummary> =>
    createIdentifier(role, alias, { algo: Algos.randy });

/**
 * List identifiers and normalize Signify's response envelope.
 */
export const listIdentifiers = async (
    client: SignifyClient
): Promise<IdentifierSummary[]> =>
    identifiersFromResponse(await client.identifiers().list());

/**
 * Authorize the role's KERIA agent endpoint for one managed AID and return OOBI.
 */
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

/**
 * Resolve one OOBI into the role's contact/address book state.
 */
export const resolveOobi = async (
    role: Role,
    oobi: string,
    alias: string
): Promise<void> => {
    const operation = await role.client.oobis().resolve(oobi, alias);
    await role.waitOperation(operation, `resolves ${alias}`);
};

/**
 * Exchange agent OOBIs between two roles so they can address each other.
 */
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

type SerderSad = ConstructorParameters<typeof Serder>[0];

/**
 * Runtime guard for operation responses that should be Serder-compatible SADs.
 */
const isSerderSad = (response: unknown): response is SerderSad =>
    typeof response === 'object' && response !== null;

/**
 * Parse a completed operation response as a Serder with a useful failure.
 */
export const serderFromOperation = (response: unknown): Serder => {
    if (!isSerderSad(response)) {
        throw new Error('Operation response was not a Serder-compatible SAD.');
    }

    return new Serder(response);
};

/**
 * Compare challenge words exactly and positionally.
 */
const sameWords = (actual: string[] | undefined, expected: string[]): boolean =>
    Array.isArray(actual) &&
    actual.length === expected.length &&
    actual.every((word, index) => word === expected[index]);

/**
 * Poll contacts until a challenge response from the expected source appears.
 */
export const waitForChallenge = async (
    client: SignifyClient,
    sourcePrefix: string,
    expectedWords: string[]
): Promise<{ said: string }> => {
    const timeoutAt = Date.now() + appConfig.operations.timeoutMs;

    while (Date.now() < timeoutAt) {
        const contacts: Contact[] = await client.contacts().list();
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
