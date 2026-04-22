import type {
    KeyState,
    Operation as KeriaOperation,
    SignifyClient,
} from 'signify-ts';
import type { Operation as EffectionOperation } from 'effection';
import type { AppConfig } from '../config';
import { callPromise } from '../effects/promise';
import {
    delegationAnchorFromEvent,
    delegationChainNodeFromIdentifier,
    delegationChainNodeFromKeyState,
    identifierDelegatorAid,
    type DelegationWorkflowDetails,
} from '../features/identifiers/delegationHelpers';
import {
    identifierCreateDraftToArgs,
    identifiersFromResponse,
    replaceIdentifierSummary,
} from '../features/identifiers/identifierHelpers';
import type {
    IdentifierCreateDraft,
    IdentifierDelegationChainNode,
    IdentifierSummary,
} from '../features/identifiers/identifierTypes';
import type { ContactRecord } from '../state/contacts.slice';
import type { OperationLogger } from '../signify/client';
import { waitOperationService } from './signify.service';

/**
 * Phase callback used by background workflows to update operation records while
 * services remain decoupled from Redux.
 */
export type IdentifierOperationPhaseReporter = (
    phase: string,
    keriaOperationName?: string | null
) => void;

/**
 * Rich result used by background identifier workflows. Foreground route calls
 * project this back to `identifiers` to preserve the public route contract.
 */
export interface IdentifierMutationResult {
    identifiers: IdentifierSummary[];
    refreshed: IdentifierSummary | null;
    delegation: DelegationWorkflowDetails | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const operationName = (operation: KeriaOperation): string | null => {
    const candidate = (operation as { name?: unknown }).name;
    return typeof candidate === 'string' ? candidate : null;
};

const eventFromResult = (result: unknown): unknown => {
    if (!isRecord(result)) {
        return null;
    }

    const serder = result.serder;
    if (!isRecord(serder)) {
        return null;
    }

    return serder.sad;
};

function* waitDelegationApproval({
    client,
    delegatorAid,
    event,
    logger,
    onPhase,
    timeoutMs,
}: {
    client: SignifyClient;
    delegatorAid: string;
    event: unknown;
    logger?: OperationLogger;
    onPhase?: IdentifierOperationPhaseReporter;
    timeoutMs: number;
}): EffectionOperation<DelegationWorkflowDetails> {
    const anchor = delegationAnchorFromEvent(event);
    onPhase?.('waiting for manual delegator approval');

    const queryOperation = yield* callPromise(() =>
        client.keyStates().query(delegatorAid, undefined, anchor)
    );
    onPhase?.('querying delegator key state', operationName(queryOperation));

    yield* waitOperationService({
        client,
        operation: queryOperation,
        label: `querying delegator ${delegatorAid} for delegation approval`,
        logger,
        timeoutMs,
    });

    return {
        delegatorAid,
        delegateAid: anchor.i,
        delegateEventSaid: anchor.d,
        sequence: anchor.s,
        anchor,
        requestedAt: new Date().toISOString(),
    };
}

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
    onPhase,
}: {
    client: SignifyClient;
    config: AppConfig;
    draft: IdentifierCreateDraft;
    logger?: OperationLogger;
    onPhase?: IdentifierOperationPhaseReporter;
}): EffectionOperation<IdentifierMutationResult> {
    const name = draft.name.trim();
    const args = identifierCreateDraftToArgs(draft, config);
    const identifierClient = client.identifiers();
    onPhase?.(
        draft.delegation.mode === 'delegated'
            ? 'creating delegated event'
            : 'creating identifier'
    );
    const result = yield* callPromise(() =>
        identifierClient.create(name, args)
    );
    const operation = yield* callPromise(() => result.op());

    let delegation: DelegationWorkflowDetails | null = null;
    if (draft.delegation.mode === 'delegated') {
        delegation = yield* waitDelegationApproval({
            client,
            delegatorAid: draft.delegation.delegatorAid.trim(),
            event: eventFromResult(result),
            logger,
            onPhase,
            timeoutMs: config.operations.delegationApprovalTimeoutMs,
        });
        onPhase?.(
            'waiting for delegated identifier operation',
            operationName(operation)
        );
    } else {
        onPhase?.('waiting for identifier operation', operationName(operation));
    }

    yield* waitOperationService({
        client,
        operation,
        label:
            draft.delegation.mode === 'delegated'
                ? `waiting for delegation approval for identifier ${name}`
                : `creating identifier ${name}`,
        logger,
    });

    onPhase?.('refreshing identifiers');
    const identifiers = yield* listIdentifiersService({ client });
    const refreshed = yield* getIdentifierService({ client, aid: name });

    return {
        identifiers: replaceIdentifierSummary(identifiers, refreshed),
        refreshed,
        delegation,
    };
}

/**
 * Rotate one managed identifier and return the refreshed identifier list.
 */
export function* rotateIdentifierService({
    client,
    config,
    aid,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    config: AppConfig;
    aid: string;
    logger?: OperationLogger;
    onPhase?: IdentifierOperationPhaseReporter;
}): EffectionOperation<IdentifierMutationResult> {
    const current = yield* getIdentifierService({ client, aid });
    const delegatorAid = identifierDelegatorAid(current);
    onPhase?.(
        delegatorAid === null
            ? 'rotating identifier'
            : 'creating delegated rotation event'
    );
    const result = yield* callPromise(() =>
        client.identifiers().rotate(aid, {})
    );
    const operation = yield* callPromise(() => result.op());

    let delegation: DelegationWorkflowDetails | null = null;
    if (delegatorAid !== null) {
        delegation = yield* waitDelegationApproval({
            client,
            delegatorAid,
            event: eventFromResult(result),
            logger,
            onPhase,
            timeoutMs: config.operations.delegationApprovalTimeoutMs,
        });
        onPhase?.(
            'waiting for delegated rotation operation',
            operationName(operation)
        );
    } else {
        onPhase?.('waiting for rotation operation', operationName(operation));
    }

    yield* waitOperationService({
        client,
        operation,
        label:
            delegatorAid === null
                ? `rotating identifier ${aid}`
                : `waiting for delegation approval for rotation ${aid}`,
        logger,
    });

    onPhase?.('refreshing identifiers');
    const identifiers = yield* listIdentifiersService({ client });
    const refreshed = yield* getIdentifierService({ client, aid });

    return {
        identifiers: replaceIdentifierSummary(identifiers, refreshed),
        refreshed,
        delegation,
    };
}

const firstKeyState = (states: KeyState[]): KeyState | null =>
    states.length > 0 ? states[0] : null;

/**
 * Resolve an identifier's delegation chain from delegate to root.
 */
export function* getIdentifierDelegationChainService({
    client,
    aid,
    localIdentifiers,
    contacts,
    depthLimit = 16,
}: {
    client: SignifyClient;
    aid: string;
    localIdentifiers: readonly IdentifierSummary[];
    contacts: readonly ContactRecord[];
    depthLimit?: number;
}): EffectionOperation<IdentifierDelegationChainNode[]> {
    const localByAid = new Map(
        localIdentifiers.map((identifier) => [identifier.prefix, identifier])
    );
    const contactByAid = new Map(
        contacts.flatMap((contact) =>
            contact.aid === null ? [] : [[contact.aid, contact]]
        )
    );
    const start = yield* getIdentifierService({ client, aid });
    const nodes: IdentifierDelegationChainNode[] = [
        delegationChainNodeFromIdentifier(start),
    ];
    const seen = new Set([start.prefix]);
    let nextDelegatorAid = nodes[0]?.delegatorAid ?? null;

    while (nextDelegatorAid !== null && nodes.length < depthLimit) {
        const currentDelegatorAid = nextDelegatorAid;
        if (seen.has(currentDelegatorAid)) {
            break;
        }

        seen.add(currentDelegatorAid);
        const localIdentifier = localByAid.get(currentDelegatorAid);
        if (localIdentifier !== undefined) {
            const node = delegationChainNodeFromIdentifier(localIdentifier);
            nodes.push(node);
            nextDelegatorAid = node.delegatorAid;
            continue;
        }

        const contact = contactByAid.get(currentDelegatorAid) ?? null;
        let state: KeyState | null;
        try {
            const states = yield* callPromise(() =>
                client.keyStates().get(currentDelegatorAid)
            );
            state = firstKeyState(states);
        } catch {
            state = null;
        }

        if (state === null) {
            nodes.push({
                aid: currentDelegatorAid,
                alias: contact?.alias ?? null,
                source: contact === null ? 'unknown' : 'contact',
                sequence: null,
                eventSaid: null,
                delegatorAid: null,
            });
            break;
        }

        const node = delegationChainNodeFromKeyState({
            state,
            alias: contact?.alias ?? null,
            source: contact === null ? 'keyState' : 'contact',
        });
        nodes.push(node);
        nextDelegatorAid = node.delegatorAid;
    }

    return nodes;
}
