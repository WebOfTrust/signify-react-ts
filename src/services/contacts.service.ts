import type {
    Contact,
    Operation as KeriaOperation,
    SignifyClient,
} from 'signify-ts';
import type { Operation as EffectionOperation } from 'effection';
import { callPromise } from '../effects/promise';
import {
    aidFromOobi,
    aliasForOobiResolution,
    challengeRecordsFromKeriaContacts,
    contactRecordFromKeriaContact,
    normalizeOobiUrlForResolution,
} from '../features/contacts/contactHelpers';
import type {
    ContactRecord,
    GeneratedOobiRecord,
} from '../state/contacts.slice';
import type { ChallengeRecord } from '../state/challenges.slice';
import type { OperationLogger } from '../signify/client';
import { waitOperationService } from './signify.service';

/**
 * OOBI role variants the UI can ask KERIA to generate for an identifier.
 */
export type OobiRole = 'agent' | 'witness';

/**
 * Session inventory facts loaded from KERIA contacts and their challenge data.
 */
export interface ContactInventorySnapshot {
    contacts: ContactRecord[];
    challenges: ChallengeRecord[];
    loadedAt: string;
}

/**
 * User intent for resolving a contact OOBI with optional display alias.
 */
export interface ResolveContactInput {
    oobi: string;
    alias?: string | null;
}

/**
 * Contact resolution result preserving source/resolution URLs for diagnostics.
 */
export interface ResolveContactResult extends ContactInventorySnapshot {
    resolvedAid: string | null;
    alias: string | null;
    sourceOobi: string;
    resolutionOobi: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;

const completedOperationAid = (operation: unknown): string | null => {
    if (!isRecord(operation) || !isRecord(operation.response)) {
        return null;
    }

    return stringValue(operation.response.i);
};

const hasEndRole = (
    raw: unknown,
    role: string,
    eid: string
): boolean =>
    Array.isArray(raw) &&
    raw.some(
        (item) =>
            isRecord(item) &&
            item.role === role &&
            stringValue(item.eid) === eid
    );

const listIdentifierEndRoles = ({
    client,
    identifier,
    role,
}: {
    client: SignifyClient;
    identifier: string;
    role: string;
}): Promise<unknown> =>
    client
        .fetch(
            `/identifiers/${encodeURIComponent(identifier)}/endroles/${encodeURIComponent(role)}`,
            'GET',
            null
        )
        .then((response) => response.json());

/**
 * Load contacts and contact-derived challenge facts from KERIA.
 */
export function* listContactsService({
    client,
}: {
    client: SignifyClient;
}): EffectionOperation<ContactInventorySnapshot> {
    const contacts: Contact[] = yield* callPromise(() =>
        client.contacts().list()
    );
    const loadedAt = new Date().toISOString();

    return {
        contacts: contacts.map((contact) =>
            contactRecordFromKeriaContact(contact, loadedAt)
        ),
        challenges: challengeRecordsFromKeriaContacts(contacts, loadedAt),
        loadedAt,
    };
}

/**
 * Ensure the local identifier has authorized this KERIA agent as its `agent`
 * endpoint role before generating an agent OOBI.
 */
export function* ensureAgentEndRoleService({
    client,
    identifier,
    logger,
}: {
    client: SignifyClient;
    identifier: string;
    logger?: OperationLogger;
}): EffectionOperation<void> {
    const agentPre = client.agent?.pre;
    if (agentPre === undefined) {
        throw new Error('Connected Signify client is missing its agent AID.');
    }

    const existing = yield* callPromise(() =>
        listIdentifierEndRoles({
            client,
            identifier,
            role: 'agent',
        })
    );
    if (hasEndRole(existing, 'agent', agentPre)) {
        return;
    }

    const result = yield* callPromise(() =>
        client.identifiers().addEndRole(identifier, 'agent', agentPre)
    );
    const operation = (yield* callPromise(() => result.op())) as KeriaOperation;
    yield* waitOperationService({
        client,
        operation,
        label: `authorizing ${identifier} agent endpoint`,
        logger,
    });
}

/**
 * Generate an OOBI for a local identifier. Agent-role OOBIs first ensure the
 * endpoint role exists; witness OOBIs are read-only projections of backers.
 */
export function* generateIdentifierOobiService({
    client,
    identifier,
    role,
    logger,
}: {
    client: SignifyClient;
    identifier: string;
    role: OobiRole;
    logger?: OperationLogger;
}): EffectionOperation<GeneratedOobiRecord> {
    if (role === 'agent') {
        yield* ensureAgentEndRoleService({ client, identifier, logger });
    }

    const result = yield* callPromise(() => client.oobis().get(identifier, role));
    const oobis = result.oobis.filter((oobi) => oobi.trim().length > 0);
    if (oobis.length === 0) {
        throw new Error(`KERIA returned no ${role} OOBIs for ${identifier}.`);
    }

    return {
        id: `${identifier}:${role}`,
        identifier,
        role,
        oobis,
        generatedAt: new Date().toISOString(),
    };
}

/**
 * Resolve one OOBI through KERIA, then preserve alias/source URL metadata and
 * prove the resulting contact can be loaded before reporting success.
 */
export function* resolveContactOobiService({
    client,
    input,
    logger,
}: {
    client: SignifyClient;
    input: ResolveContactInput;
    logger?: OperationLogger;
}): EffectionOperation<ResolveContactResult> {
    const sourceOobi = input.oobi.trim();
    if (sourceOobi.length === 0) {
        throw new Error('OOBI URL is required.');
    }

    const alias = aliasForOobiResolution(sourceOobi, input.alias);
    const resolutionOobi = normalizeOobiUrlForResolution(sourceOobi);
    const operation = yield* callPromise(() =>
        client.oobis().resolve(resolutionOobi, alias ?? undefined)
    );

    const completed = yield* waitOperationService({
        client,
        operation,
        label: alias === null ? 'resolving OOBI' : `resolving ${alias}`,
        logger,
    });
    const resolvedAid = completedOperationAid(completed) ?? aidFromOobi(sourceOobi);

    if (resolvedAid === null) {
        throw new Error(
            'KERIA completed OOBI resolution without returning a contact AID.'
        );
    }

    const metadata: Record<string, string> = { oobi: sourceOobi };
    if (alias !== null) {
        metadata.alias = alias;
    }
    yield* callPromise(() => client.contacts().update(resolvedAid, metadata));
    const persistedContact: Contact = yield* callPromise(() =>
        client.contacts().get(resolvedAid)
    );

    const inventory = yield* listContactsService({ client });
    if (
        !inventory.contacts.some((contact) => contact.id === resolvedAid)
    ) {
        const loadedAt = inventory.loadedAt;
        const contact = contactRecordFromKeriaContact(
            persistedContact,
            loadedAt
        );
        return {
            contacts: [contact, ...inventory.contacts],
            challenges: [
                ...challengeRecordsFromKeriaContacts(
                    [persistedContact],
                    loadedAt
                ),
                ...inventory.challenges,
            ],
            loadedAt,
            resolvedAid,
            alias,
            sourceOobi,
            resolutionOobi,
        };
    }

    return {
        ...inventory,
        resolvedAid,
        alias,
        sourceOobi,
        resolutionOobi,
    };
}

/**
 * Update local metadata for a known contact and return refreshed inventory.
 */
export function* updateContactAliasService({
    client,
    contactId,
    alias,
}: {
    client: SignifyClient;
    contactId: string;
    alias: string;
}): EffectionOperation<ContactInventorySnapshot> {
    const normalizedAlias = alias.trim();
    if (normalizedAlias.length === 0) {
        throw new Error('Alias is required.');
    }

    yield* callPromise(() =>
        client.contacts().update(contactId, { alias: normalizedAlias })
    );
    return yield* listContactsService({ client });
}

/**
 * Delete a contact and return refreshed inventory.
 */
export function* deleteContactService({
    client,
    contactId,
}: {
    client: SignifyClient;
    contactId: string;
}): EffectionOperation<ContactInventorySnapshot> {
    yield* callPromise(() => client.contacts().delete(contactId));
    return yield* listContactsService({ client });
}
