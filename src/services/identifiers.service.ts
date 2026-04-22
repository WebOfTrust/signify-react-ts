import type { SignifyClient } from 'signify-ts';
import type { Operation as EffectionOperation } from 'effection';
import type { AppConfig } from '../config';
import { callPromise } from '../effects/promise';
import {
    identifierCreateDraftToArgs,
    identifiersFromResponse,
    replaceIdentifierSummary,
} from '../features/identifiers/identifierHelpers';
import type {
    IdentifierCreateDraft,
    IdentifierSummary,
} from '../features/identifiers/identifierTypes';
import type { OperationLogger } from '../signify/client';
import { waitOperationService } from './signify.service';

/**
 * Load and normalize every managed identifier visible to the connected client.
 */
export function* listIdentifiersService({
    client,
}: {
    client: SignifyClient;
}): EffectionOperation<IdentifierSummary[]> {
    const response = yield* callPromise(() => client.identifiers().list());
    return identifiersFromResponse(response);
}

/**
 * Fetch one managed identifier by alias or prefix.
 */
export function* getIdentifierService({
    client,
    aid,
}: {
    client: SignifyClient;
    aid: string;
}): EffectionOperation<IdentifierSummary> {
    return yield* callPromise(() => client.identifiers().get(aid));
}

/**
 * Create an identifier from a UI draft and return the refreshed identifier list.
 *
 * The service is an Effection operation so multi-step KERIA behavior can be
 * composed with cancellation and session lifetimes. Raw Signify calls remain
 * the Promise edge and are wrapped with `callPromise`.
 */
export function* createIdentifierService({
    client,
    config,
    draft,
    logger,
}: {
    client: SignifyClient;
    config: AppConfig;
    draft: IdentifierCreateDraft;
    logger?: OperationLogger;
}): EffectionOperation<IdentifierSummary[]> {
    const name = draft.name.trim();
    const args = identifierCreateDraftToArgs(draft, config);
    const identifierClient = client.identifiers();
    const result = yield* callPromise(() => identifierClient.create(name, args));
    const operation = yield* callPromise(() => result.op());

    yield* waitOperationService({
        client,
        operation,
        label: `creating identifier ${name}`,
        logger,
    });

    return yield* listIdentifiersService({ client });
}

/**
 * Rotate one managed identifier and return the refreshed identifier list.
 */
export function* rotateIdentifierService({
    client,
    aid,
    logger,
}: {
    client: SignifyClient;
    aid: string;
    logger?: OperationLogger;
}): EffectionOperation<IdentifierSummary[]> {
    const result = yield* callPromise(() => client.identifiers().rotate(aid, {}));
    const operation = yield* callPromise(() => result.op());

    yield* waitOperationService({
        client,
        operation,
        label: `rotating identifier ${aid}`,
        logger,
    });

    const identifiers = yield* listIdentifiersService({ client });
    const refreshed = yield* getIdentifierService({ client, aid });

    return replaceIdentifierSummary(identifiers, refreshed);
}
