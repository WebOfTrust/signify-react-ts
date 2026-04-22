import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import { callPromise } from '../effects/promise';
import { delegationAnchorFromNotification } from '../features/identifiers/delegationHelpers';
import type { DelegationRequestNotification } from '../state/notifications.slice';
import type { OperationLogger } from '../signify/client';
import { waitOperationService } from './signify.service';

/**
 * Route/workflow input for manual delegator approval.
 */
export interface ApproveDelegationInput {
    notificationId: string;
    delegatorName: string;
    request: DelegationRequestNotification;
}

/**
 * Background workflow result recorded on approval operation completion.
 */
export interface ApproveDelegationResult {
    delegatorAid: string;
    delegateAid: string;
    delegateEventSaid: string;
    sequence: string;
    requestedAt: string;
    approvedAt: string;
}

/**
 * Approve a delegation request by creating the delegator's anchor event.
 */
export function* approveDelegationRequestService({
    client,
    input,
    logger,
}: {
    client: SignifyClient;
    input: ApproveDelegationInput;
    logger?: OperationLogger;
}): EffectionOperation<ApproveDelegationResult> {
    const delegatorName = input.delegatorName.trim();
    if (delegatorName.length === 0) {
        throw new Error('Delegator identifier name is required.');
    }

    const anchor = delegationAnchorFromNotification(input.request);
    if (anchor.i !== input.request.delegateAid) {
        throw new Error(
            'Delegation request anchor does not match delegate AID.'
        );
    }

    const delegator = yield* callPromise(() =>
        client.identifiers().get(delegatorName)
    );
    if (delegator.prefix !== input.request.delegatorAid) {
        throw new Error(
            'Delegation request delegator does not match the selected local identifier.'
        );
    }

    const result = yield* callPromise(() =>
        client.delegations().approve(delegatorName, anchor)
    );
    const operation = yield* callPromise(() => result.op());

    yield* waitOperationService({
        client,
        operation,
        label: `approving delegation for ${input.request.delegateAid}`,
        logger,
    });

    try {
        yield* callPromise(() =>
            client.notifications().delete(input.notificationId)
        );
    } catch {
        try {
            yield* callPromise(() =>
                client.notifications().mark(input.notificationId)
            );
        } catch {
            // Approval is authoritative; notification cleanup is best effort.
        }
    }

    return {
        delegatorAid: input.request.delegatorAid,
        delegateAid: input.request.delegateAid,
        delegateEventSaid: input.request.delegateEventSaid,
        sequence: input.request.sequence,
        requestedAt: input.request.createdAt,
        approvedAt: new Date().toISOString(),
    };
}
