import type { Operation as EffectionOperation } from 'effection';
import { toErrorText } from '../effects/promise';
import { AppServicesContext, type AppServices } from '../effects/contexts';
import {
    challengeWordsFingerprint,
    defaultChallengeStrength,
    type ChallengeStrength,
} from '../features/contacts/challengeWords';
import {
    generateChallengeService,
    respondToChallengeService,
    sendChallengeRequestService,
    verifyChallengeResponseService,
    type SendChallengeRequestResult,
} from '../services/challenges.service';
import { listContactsService } from '../services/contacts.service';
import {
    isSyntheticChallengeNotificationId,
    markNotificationReadService,
} from '../services/notifications.service';
import {
    challengeRecorded,
    storedChallengeWordsCleared,
    storedChallengeWordsFailed,
    storedChallengeWordsRecorded,
    type ChallengeRecord,
} from '../state/challenges.slice';
import { challengeRequestNotificationResponded } from '../state/notifications.slice';
import {
    localIdentifierAids,
    publishContactInventory,
    publishNotificationInventory,
    tombstonedExchangeSaids,
} from './contacts.op';

export interface GenerateContactChallengeInput {
    challengeId?: string;
    counterpartyAid: string;
    counterpartyAlias?: string | null;
    localIdentifier: string;
    localAid?: string | null;
    strength?: ChallengeStrength;
}

export interface GeneratedContactChallengeResult {
    challengeId: string;
    counterpartyAid: string;
    counterpartyAlias: string | null;
    localIdentifier: string;
    localAid: string | null;
    words: string[];
    wordsHash: string;
    strength: ChallengeStrength;
    generatedAt: string;
}

export interface RespondToContactChallengeInput {
    challengeId?: string;
    notificationId?: string;
    wordsHash?: string | null;
    counterpartyAid: string;
    counterpartyAlias?: string | null;
    localIdentifier: string;
    localAid?: string | null;
    words: readonly string[];
}

export interface SendChallengeRequestInput {
    challengeId: string;
    counterpartyAid: string;
    counterpartyAlias?: string | null;
    localIdentifier: string;
    localAid?: string | null;
    wordsHash: string;
    strength: ChallengeStrength;
}

export interface VerifyContactChallengeInput {
    challengeId: string;
    counterpartyAid: string;
    counterpartyAlias?: string | null;
    localIdentifier: string;
    localAid?: string | null;
    words: readonly string[];
    wordsHash?: string | null;
    generatedAt?: string | null;
}

const createWorkflowId = (prefix: string): string =>
    globalThis.crypto?.randomUUID?.() ??
    `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalizedAid = (value: string): string => {
    const aid = value.trim();
    if (aid.length === 0) {
        throw new Error('Contact AID is required.');
    }

    return aid;
};

const normalizedIdentifier = (value: string): string => {
    const identifier = value.trim();
    if (identifier.length === 0) {
        throw new Error('Local identifier is required.');
    }

    return identifier;
};

const contactRoute = (aid: string): string =>
    `/contacts/${encodeURIComponent(aid)}`;

const challengeRecord = ({
    id,
    direction,
    role,
    counterpartyAid,
    counterpartyAlias,
    localIdentifier,
    localAid,
    words,
    status,
    authenticated,
    result,
    responseSaid,
    error,
    wordsHash,
    generatedAt,
    sentAt,
    verifiedAt,
    updatedAt,
}: {
    id: string;
    direction: ChallengeRecord['direction'];
    role: string;
    counterpartyAid: string;
    counterpartyAlias?: string | null;
    localIdentifier: string;
    localAid?: string | null;
    words: readonly string[];
    status: ChallengeRecord['status'];
    authenticated: boolean;
    result: string | null;
    wordsHash?: string | null;
    responseSaid?: string | null;
    error?: string | null;
    generatedAt?: string | null;
    sentAt?: string | null;
    verifiedAt?: string | null;
    updatedAt: string;
}): ChallengeRecord => {
    const normalizedWords = words.map((word) => word.trim().toLowerCase());
    return {
        id,
        source: 'workflow',
        direction,
        role,
        counterpartyAid,
        counterpartyAlias: counterpartyAlias ?? null,
        localIdentifier,
        localAid: localAid ?? null,
        words: normalizedWords,
        wordsHash: wordsHash ?? challengeWordsFingerprint(normalizedWords),
        responseSaid: responseSaid ?? null,
        authenticated,
        status,
        result,
        error: error ?? null,
        generatedAt: generatedAt ?? null,
        sentAt: sentAt ?? null,
        verifiedAt: verifiedAt ?? null,
        updatedAt,
    };
};

const currentContacts = (services: AppServices) =>
    Object.values(services.store.getState().contacts.byId).filter(
        (contact) => contact !== undefined
    );

/**
 * Generate and record a contact challenge phrase.
 */
export function* generateContactChallengeOp(
    input: GenerateContactChallengeInput
): EffectionOperation<GeneratedContactChallengeResult> {
    const services = yield* AppServicesContext.expect();
    const counterpartyAid = normalizedAid(input.counterpartyAid);
    const localIdentifier = normalizedIdentifier(input.localIdentifier);
    const strength = input.strength ?? defaultChallengeStrength;
    const words = yield* generateChallengeService({
        client: services.runtime.requireConnectedClient(),
        strength,
    });
    const generatedAt = new Date().toISOString();
    const challengeId = input.challengeId ?? createWorkflowId('challenge');
    const wordsHash = challengeWordsFingerprint(words);

    services.store.dispatch(
        challengeRecorded(
            challengeRecord({
                id: challengeId,
                direction: 'issued',
                role: 'challenger',
                counterpartyAid,
                counterpartyAlias: input.counterpartyAlias,
                localIdentifier,
                localAid: input.localAid,
                words,
                status: 'pending',
                authenticated: false,
                result: null,
                generatedAt,
                updatedAt: generatedAt,
            })
        )
    );
    services.store.dispatch(
        storedChallengeWordsRecorded({
            challengeId,
            counterpartyAid,
            counterpartyAlias: input.counterpartyAlias ?? null,
            localIdentifier,
            localAid: input.localAid ?? null,
            words,
            wordsHash,
            strength,
            generatedAt,
            updatedAt: generatedAt,
            status: 'pending',
        })
    );

    return {
        challengeId,
        counterpartyAid,
        counterpartyAlias: input.counterpartyAlias ?? null,
        localIdentifier,
        localAid: input.localAid ?? null,
        words,
        wordsHash,
        strength,
        generatedAt,
    };
}

/**
 * Send a signed challenge response from a local identifier.
 */
export function* respondToContactChallengeOp(
    input: RespondToContactChallengeInput
): EffectionOperation<ChallengeRecord> {
    const services = yield* AppServicesContext.expect();
    const counterpartyAid = normalizedAid(input.counterpartyAid);
    const localIdentifier = normalizedIdentifier(input.localIdentifier);
    const challengeId =
        input.challengeId ?? createWorkflowId('challenge-response');
    const computedWordsHash = challengeWordsFingerprint(input.words);

    if (
        input.wordsHash !== undefined &&
        input.wordsHash !== null &&
        input.wordsHash.trim().length > 0 &&
        input.wordsHash.trim() !== computedWordsHash
    ) {
        throw new Error(
            'Challenge words do not match the requested challenge.'
        );
    }

    yield* respondToChallengeService({
        client: services.runtime.requireConnectedClient(),
        localIdentifier,
        recipientAid: counterpartyAid,
        words: input.words,
    });

    const sentAt = new Date().toISOString();
    const record = challengeRecord({
        id: challengeId,
        direction: 'received',
        role: 'responder',
        counterpartyAid,
        counterpartyAlias: input.counterpartyAlias,
        localIdentifier,
        localAid: input.localAid,
        words: input.words,
        wordsHash: input.wordsHash ?? computedWordsHash,
        status: 'responded',
        authenticated: false,
        result: 'Response sent',
        sentAt,
        updatedAt: sentAt,
    });
    services.store.dispatch(challengeRecorded(record));
    if (
        input.notificationId !== undefined &&
        input.notificationId.trim().length > 0
    ) {
        const notificationId = input.notificationId.trim();
        if (isSyntheticChallengeNotificationId(notificationId)) {
            services.store.dispatch(
                challengeRequestNotificationResponded({
                    id: notificationId,
                    updatedAt: sentAt,
                    message: 'Challenge response sent.',
                })
            );
        } else {
            const inventory = yield* markNotificationReadService({
                client: services.runtime.requireConnectedClient(),
                notificationId,
                contacts: currentContacts(services),
                localAids: localIdentifierAids(services.store),
                tombstonedExnSaids: tombstonedExchangeSaids(services.store),
                respondedChallengeIds: [record.id],
                respondedWordsHashes:
                    record.wordsHash === undefined || record.wordsHash === null
                        ? []
                        : [record.wordsHash],
            });
            publishNotificationInventory(services.store, inventory);
        }
    }

    return record;
}

/**
 * Send an out-of-band-word challenge request EXN to the target contact.
 */
export function* sendChallengeRequestOp(
    input: SendChallengeRequestInput
): EffectionOperation<SendChallengeRequestResult> {
    const services = yield* AppServicesContext.expect();
    const counterpartyAid = normalizedAid(input.counterpartyAid);
    const localIdentifier = normalizedIdentifier(input.localIdentifier);

    return yield* sendChallengeRequestService({
        client: services.runtime.requireConnectedClient(),
        localIdentifier,
        recipientAid: counterpartyAid,
        challengeId: input.challengeId,
        wordsHash: input.wordsHash,
        strength: input.strength,
    });
}

/**
 * Wait for, verify, and accept a target contact's challenge response.
 */
export function* verifyContactChallengeOp(
    input: VerifyContactChallengeInput
): EffectionOperation<ChallengeRecord> {
    const services = yield* AppServicesContext.expect();
    const counterpartyAid = normalizedAid(input.counterpartyAid);
    const localIdentifier = normalizedIdentifier(input.localIdentifier);
    const startedAt = new Date().toISOString();
    const wordsHash = input.wordsHash ?? challengeWordsFingerprint(input.words);
    const pending = challengeRecord({
        id: input.challengeId,
        direction: 'issued',
        role: 'challenger',
        counterpartyAid,
        counterpartyAlias: input.counterpartyAlias,
        localIdentifier,
        localAid: input.localAid,
        words: input.words,
        status: 'pending',
        authenticated: false,
        result: 'Waiting for response',
        generatedAt: input.generatedAt ?? startedAt,
        updatedAt: startedAt,
    });

    services.store.dispatch(
        challengeRecorded({
            ...pending,
            wordsHash,
        })
    );

    try {
        const pollMs = Math.max(
            1000,
            Math.min(5000, services.config.operations.liveRefreshMs)
        );
        const timeoutMs = Math.max(
            300000,
            services.config.operations.timeoutMs
        );
        const verified = yield* verifyChallengeResponseService({
            client: services.runtime.requireConnectedClient(),
            sourceAid: counterpartyAid,
            words: input.words,
            timeoutMs,
            pollMs,
            logger: services.logger,
        });
        const verifiedAt = new Date().toISOString();
        const record = challengeRecord({
            id: input.challengeId,
            direction: 'issued',
            role: 'challenger',
            counterpartyAid,
            counterpartyAlias: input.counterpartyAlias,
            localIdentifier,
            localAid: input.localAid,
            words: input.words,
            status: 'verified',
            authenticated: true,
            result: verified.responseSaid,
            responseSaid: verified.responseSaid,
            generatedAt: input.generatedAt ?? pending.generatedAt,
            verifiedAt,
            updatedAt: verifiedAt,
        });

        services.store.dispatch(challengeRecorded(record));
        services.store.dispatch(
            storedChallengeWordsCleared({ challengeId: input.challengeId })
        );
        const inventory = yield* listContactsService({
            client: services.runtime.requireConnectedClient(),
        });
        publishContactInventory(services.store.dispatch, inventory);
        return record;
    } catch (error) {
        const failedAt = new Date().toISOString();
        const record = challengeRecord({
            id: input.challengeId,
            direction: 'issued',
            role: 'challenger',
            counterpartyAid,
            counterpartyAlias: input.counterpartyAlias,
            localIdentifier,
            localAid: input.localAid,
            words: input.words,
            status: 'failed',
            authenticated: false,
            result: null,
            error: toErrorText(error),
            generatedAt: input.generatedAt ?? pending.generatedAt,
            updatedAt: failedAt,
        });
        services.store.dispatch(challengeRecorded(record));
        services.store.dispatch(
            storedChallengeWordsFailed({
                challengeId: input.challengeId,
                updatedAt: failedAt,
            })
        );
        throw error;
    }
}

export const challengeResultRoute = (counterpartyAid: string) => ({
    label: 'View contact',
    path: contactRoute(counterpartyAid),
});
