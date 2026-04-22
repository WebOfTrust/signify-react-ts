import type { Operation as EffectionOperation } from 'effection';
import { AppServicesContext } from '../effects/contexts';
import { callPromise, toErrorText } from '../effects/promise';
import type {
    MultisigCreateDraft,
    MultisigInteractionDraft,
    MultisigOperationResult,
    MultisigRequestActionInput,
    MultisigRotationDraft,
    MultisigGroupStatus,
} from '../features/multisig/multisigTypes';
import {
    startMultisigInceptionService,
    acceptMultisigInceptionService,
    acceptMultisigEndRoleService,
    acceptMultisigInteractionService,
    acceptMultisigRotationService,
    authorizeMultisigAgentsService,
    joinMultisigRotationService,
    startMultisigInteractionService,
    startMultisigRotationService,
} from '../services/multisig.service';
import { isSyntheticExchangeNotificationId } from '../services/notifications.service';
import { listIdentifiersService } from '../services/identifiers.service';
import { identifierListLoaded } from '../state/identifiers.slice';
import {
    multisigGroupRecorded,
    multisigGroupStatusChanged,
} from '../state/multisig.slice';
import {
    multisigRequestNotificationApproved,
} from '../state/notifications.slice';
import { operationPhaseChanged } from '../state/operations.slice';
import { syncSessionInventoryOp } from './contacts.op';

const markNotificationHandled = function* (
    input: Pick<MultisigRequestActionInput, 'notificationId'>
): EffectionOperation<void> {
    const notificationId = input.notificationId?.trim();
    if (notificationId === undefined || notificationId.length === 0) {
        return;
    }

    const services = yield* AppServicesContext.expect();
    const updatedAt = new Date().toISOString();
    if (!isSyntheticExchangeNotificationId(notificationId)) {
        yield* callPromise(() =>
            services.runtime.requireConnectedClient().notifications().mark(notificationId)
        );
    }

    services.store.dispatch(
        multisigRequestNotificationApproved({
            id: notificationId,
            updatedAt,
            message: 'Multisig request handled.',
        })
    );
};

const refreshIdentifiersAndNotifications = function* (): EffectionOperation<void> {
    const services = yield* AppServicesContext.expect();
    const identifiers = yield* listIdentifiersService({
        client: services.runtime.requireConnectedClient(),
    });

    services.store.dispatch(
        identifierListLoaded({
            identifiers,
            loadedAt: new Date().toISOString(),
        })
    );
    yield* syncSessionInventoryOp();
};

const recordGroupResult = function* (
    result: MultisigOperationResult,
    status: Extract<
        MultisigGroupStatus,
        | 'proposed'
        | 'joining'
        | 'authorizingAgents'
        | 'active'
        | 'interacting'
        | 'rotating'
    >
): EffectionOperation<void> {
    const services = yield* AppServicesContext.expect();
    const id = result.groupAid ?? result.groupAlias;
    services.store.dispatch(
        multisigGroupRecorded({
            id,
            alias: result.groupAlias,
            groupAid: result.groupAid,
            localMemberAid: result.localMemberAid,
            signingMemberAids: [],
            rotationMemberAids: [],
            signingThreshold: null,
            rotationThreshold: null,
            status,
            pendingRequestId: null,
            latestExchangeSaid: result.exchangeSaid,
            error: null,
            updatedAt: result.completedAt,
        })
    );
};

/**
 * Create a multisig group proposal and wait for KERIA completion.
 */
export function* createMultisigGroupOp(
    draft: MultisigCreateDraft,
    requestId: string
): EffectionOperation<MultisigOperationResult> {
    const services = yield* AppServicesContext.expect();
    services.store.dispatch(
        multisigGroupRecorded({
            id: draft.groupAlias.trim(),
            alias: draft.groupAlias.trim(),
            groupAid: null,
            localMemberAid: draft.localMemberAid,
            signingMemberAids: draft.signingMemberAids,
            rotationMemberAids: draft.rotationMemberAids,
            signingThreshold: draft.signingThreshold,
            rotationThreshold: draft.rotationThreshold,
            status: 'incepting',
            pendingRequestId: requestId,
            latestExchangeSaid: null,
            error: null,
            updatedAt: new Date().toISOString(),
        })
    );

    try {
        const result = yield* startMultisigInceptionService({
            client: services.runtime.requireConnectedClient(),
            draft,
            config: services.config,
            logger: services.logger,
            onPhase: (phase, keriaOperationName) =>
                services.store.dispatch(
                    operationPhaseChanged({
                        requestId,
                        phase,
                        keriaOperationName,
                    })
                ),
        });
        yield* recordGroupResult(result, 'proposed');
        yield* refreshIdentifiersAndNotifications();
        return result;
    } catch (error) {
        services.store.dispatch(
            multisigGroupStatusChanged({
                id: draft.groupAlias.trim(),
                status: 'failed',
                updatedAt: new Date().toISOString(),
                error: toErrorText(error),
                pendingRequestId: null,
            })
        );
        throw error;
    }
}

export function* acceptMultisigInceptionOp(
    input: MultisigRequestActionInput,
    requestId: string
): EffectionOperation<MultisigOperationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* acceptMultisigInceptionService({
        client: services.runtime.requireConnectedClient(),
        input,
        logger: services.logger,
        onPhase: (phase, keriaOperationName) =>
            services.store.dispatch(
                operationPhaseChanged({ requestId, phase, keriaOperationName })
            ),
    });
    yield* markNotificationHandled(input);
    yield* recordGroupResult(result, 'joining');
    yield* refreshIdentifiersAndNotifications();
    return result;
}

export function* authorizeMultisigAgentsOp(
    input: { groupAlias: string; localMemberName?: string | null },
    requestId: string
): EffectionOperation<MultisigOperationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* authorizeMultisigAgentsService({
        client: services.runtime.requireConnectedClient(),
        groupAlias: input.groupAlias,
        localMemberName: input.localMemberName,
        logger: services.logger,
        onPhase: (phase, keriaOperationName) =>
            services.store.dispatch(
                operationPhaseChanged({ requestId, phase, keriaOperationName })
            ),
    });
    yield* recordGroupResult(result, 'active');
    yield* refreshIdentifiersAndNotifications();
    return result;
}

export function* acceptMultisigEndRoleOp(
    input: MultisigRequestActionInput,
    requestId: string
): EffectionOperation<MultisigOperationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* acceptMultisigEndRoleService({
        client: services.runtime.requireConnectedClient(),
        input,
        logger: services.logger,
        onPhase: (phase, keriaOperationName) =>
            services.store.dispatch(
                operationPhaseChanged({ requestId, phase, keriaOperationName })
            ),
    });
    yield* markNotificationHandled(input);
    yield* recordGroupResult(result, 'active');
    yield* refreshIdentifiersAndNotifications();
    return result;
}

export function* interactMultisigGroupOp(
    draft: MultisigInteractionDraft,
    requestId: string
): EffectionOperation<MultisigOperationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* startMultisigInteractionService({
        client: services.runtime.requireConnectedClient(),
        draft,
        logger: services.logger,
        onPhase: (phase, keriaOperationName) =>
            services.store.dispatch(
                operationPhaseChanged({ requestId, phase, keriaOperationName })
            ),
    });
    yield* recordGroupResult(result, 'active');
    yield* refreshIdentifiersAndNotifications();
    return result;
}

export function* acceptMultisigInteractionOp(
    input: MultisigRequestActionInput,
    requestId: string
): EffectionOperation<MultisigOperationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* acceptMultisigInteractionService({
        client: services.runtime.requireConnectedClient(),
        input,
        logger: services.logger,
        onPhase: (phase, keriaOperationName) =>
            services.store.dispatch(
                operationPhaseChanged({ requestId, phase, keriaOperationName })
            ),
    });
    yield* markNotificationHandled(input);
    yield* recordGroupResult(result, 'active');
    yield* refreshIdentifiersAndNotifications();
    return result;
}

export function* rotateMultisigGroupOp(
    draft: MultisigRotationDraft,
    requestId: string
): EffectionOperation<MultisigOperationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* startMultisigRotationService({
        client: services.runtime.requireConnectedClient(),
        draft,
        logger: services.logger,
        onPhase: (phase, keriaOperationName) =>
            services.store.dispatch(
                operationPhaseChanged({ requestId, phase, keriaOperationName })
            ),
    });
    yield* recordGroupResult(result, 'active');
    yield* refreshIdentifiersAndNotifications();
    return result;
}

export function* acceptMultisigRotationOp(
    input: MultisigRequestActionInput,
    requestId: string
): EffectionOperation<MultisigOperationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* acceptMultisigRotationService({
        client: services.runtime.requireConnectedClient(),
        input,
        logger: services.logger,
        onPhase: (phase, keriaOperationName) =>
            services.store.dispatch(
                operationPhaseChanged({ requestId, phase, keriaOperationName })
            ),
    });
    yield* markNotificationHandled(input);
    yield* recordGroupResult(result, 'active');
    yield* refreshIdentifiersAndNotifications();
    return result;
}

export function* joinMultisigRotationOp(
    input: MultisigRequestActionInput,
    requestId: string
): EffectionOperation<MultisigOperationResult> {
    const services = yield* AppServicesContext.expect();
    const result = yield* joinMultisigRotationService({
        client: services.runtime.requireConnectedClient(),
        input,
        logger: services.logger,
        onPhase: (phase, keriaOperationName) =>
            services.store.dispatch(
                operationPhaseChanged({ requestId, phase, keriaOperationName })
            ),
    });
    yield* markNotificationHandled(input);
    yield* recordGroupResult(result, 'active');
    yield* refreshIdentifiersAndNotifications();
    return result;
}
