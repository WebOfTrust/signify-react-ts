import type { Operation as EffectionOperation } from 'effection';
import { AppServicesContext } from '../effects/contexts';
import {
    approveDelegationRequestService,
    type ApproveDelegationInput,
    type ApproveDelegationResult,
} from '../services/delegations.service';
import { delegationRequestNotificationApproved } from '../state/notifications.slice';
import { syncSessionInventoryOp } from './contacts.op';

export type { ApproveDelegationInput, ApproveDelegationResult };

/**
 * Workflow command for manually approving one inbound delegation request.
 */
export function* approveDelegationRequestOp(
    input: ApproveDelegationInput
): EffectionOperation<ApproveDelegationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* approveDelegationRequestService({
        client: services.runtime.requireConnectedClient(),
        input,
        logger: services.logger,
    });
    const updatedAt = result.approvedAt;

    services.store.dispatch(
        delegationRequestNotificationApproved({
            id: input.notificationId,
            updatedAt,
            message: 'Delegation request approved.',
        })
    );

    try {
        yield* syncSessionInventoryOp();
    } catch {
        // Live sync will retry; local approved state was already recorded.
    }

    return result;
}
