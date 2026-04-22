import {
    Serder,
    type Operation as KeriaOperation,
    type SignifyClient,
} from 'signify-ts';
import type { Operation as EffectionOperation } from 'effection';
import { callPromise } from '../effects/promise';
import {
    defaultChallengeStrength,
    validateChallengeWords,
    type ChallengeStrength,
} from '../features/contacts/challengeWords';
import type { OperationLogger } from '../signify/client';
import { waitOperationService } from './signify.service';

/**
 * KERI exchange topic used for app-defined challenge request messages.
 */
export const CHALLENGE_TOPIC = 'challenge';

/**
 * KERI exchange route for requesting an out-of-band challenge response.
 */
export const CHALLENGE_REQUEST_ROUTE = '/challenge/request';

/**
 * Result of accepting a completed KERIA challenge response operation.
 */
export interface VerifyChallengeResult {
    operationName: string;
    responseSaid: string;
}

/**
 * Result metadata for a challenge request EXN that carries no raw words.
 */
export interface SendChallengeRequestResult {
    challengeId: string;
    recipientAid: string;
    exnSaid: string | null;
    sentAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const requireValidWords = (words: readonly string[]): string[] => {
    const normalized = words.map((word) => word.trim().toLowerCase());
    const error = validateChallengeWords(normalized);
    if (error !== null) {
        throw new Error(error);
    }

    return normalized;
};

const requireNonEmpty = (value: string, label: string): string => {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error(`${label} is required.`);
    }

    return normalized;
};

const exchangeSaid = (exchange: unknown): string | null => {
    if (!isRecord(exchange)) {
        return null;
    }

    return stringValue(exchange.d);
};

/**
 * Extract the challenge response exchange SAID from a completed KERIA
 * challenge operation.
 */
export const responseSaidFromChallengeOperation = (
    operation: unknown
): string => {
    if (!isRecord(operation) || !isRecord(operation.response)) {
        throw new Error('Challenge operation completed without a response.');
    }

    const exn = operation.response.exn;
    if (!isRecord(exn)) {
        throw new Error('Challenge operation response did not include an EXN.');
    }

    try {
        const serder = new Serder(
            exn as ConstructorParameters<typeof Serder>[0]
        );
        const said = stringValue(serder.said);
        if (said !== null) {
            return said;
        }
    } catch {
        const said = stringValue(exn.d);
        if (said !== null) {
            return said;
        }
    }

    const said = stringValue(exn.d);
    if (said === null) {
        throw new Error('Challenge response EXN did not include a SAID.');
    }

    return said;
};

/**
 * Generate a mnemonic challenge phrase through KERIA.
 */
export function* generateChallengeService({
    client,
    strength = defaultChallengeStrength,
}: {
    client: SignifyClient;
    strength?: ChallengeStrength;
}): EffectionOperation<string[]> {
    const challenge = yield* callPromise(() =>
        client.challenges().generate(strength)
    );
    const words = Array.isArray(challenge.words) ? challenge.words : [];
    return requireValidWords(words);
}

/**
 * Send a signed challenge response from one local identifier to a contact AID.
 */
export function* respondToChallengeService({
    client,
    localIdentifier,
    recipientAid,
    words,
}: {
    client: SignifyClient;
    localIdentifier: string;
    recipientAid: string;
    words: readonly string[];
}): EffectionOperation<void> {
    const normalizedWords = requireValidWords(words);
    yield* callPromise(() =>
        client
            .challenges()
            .respond(localIdentifier, recipientAid, normalizedWords)
    );
}

/**
 * Send a lightweight responder-facing challenge request notification.
 *
 * This deliberately sends only challenge metadata. The challenge words remain
 * out-of-band and are never embedded in the request EXN.
 */
export function* sendChallengeRequestService({
    client,
    localIdentifier,
    recipientAid,
    challengeId,
    wordsHash,
    strength,
}: {
    client: SignifyClient;
    localIdentifier: string;
    recipientAid: string;
    challengeId: string;
    wordsHash: string;
    strength: ChallengeStrength;
}): EffectionOperation<SendChallengeRequestResult> {
    const name = requireNonEmpty(localIdentifier, 'Local identifier');
    const recipient = requireNonEmpty(recipientAid, 'Recipient AID');
    const normalizedChallengeId = requireNonEmpty(challengeId, 'Challenge id');
    const normalizedWordsHash = requireNonEmpty(wordsHash, 'Challenge hash');
    const hab = yield* callPromise(() => client.identifiers().get(name));
    const exchange = yield* callPromise(() =>
        client.exchanges().send(
            name,
            CHALLENGE_TOPIC,
            hab,
            CHALLENGE_REQUEST_ROUTE,
            {
                challengeId: normalizedChallengeId,
                wordsHash: normalizedWordsHash,
                strength,
            },
            {},
            [recipient]
        )
    );

    return {
        challengeId: normalizedChallengeId,
        recipientAid: recipient,
        exnSaid: exchangeSaid(exchange),
        sentAt: new Date().toISOString(),
    };
}

/**
 * Wait for a matching challenge response, accept its EXN SAID, and return the
 * accepted response identifier.
 */
export function* verifyChallengeResponseService({
    client,
    sourceAid,
    words,
    timeoutMs,
    pollMs,
    logger,
}: {
    client: SignifyClient;
    sourceAid: string;
    words: readonly string[];
    timeoutMs: number;
    pollMs: number;
    logger?: OperationLogger;
}): EffectionOperation<VerifyChallengeResult> {
    const normalizedWords = requireValidWords(words);
    const operation = (yield* callPromise(() =>
        client.challenges().verify(sourceAid, normalizedWords)
    )) as KeriaOperation;

    const completed = yield* waitOperationService({
        client,
        operation,
        label: `verifying challenge response from ${sourceAid}`,
        timeoutMs,
        minSleepMs: Math.max(250, Math.min(1000, pollMs)),
        maxSleepMs: pollMs,
        logger,
    });
    const responseSaid = responseSaidFromChallengeOperation(completed);
    const response = yield* callPromise(() =>
        client.challenges().responded(sourceAid, responseSaid)
    );

    if (!response.ok) {
        throw new Error(
            `KERIA rejected challenge acceptance: ${response.status} ${response.statusText}`
        );
    }

    return {
        operationName: operation.name,
        responseSaid,
    };
}
