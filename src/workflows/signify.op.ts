import type { Operation as EffectionOperation } from 'effection';
import type {
    CompletedOperation,
    Operation as KeriaOperation,
    SignifyClient,
} from 'signify-ts';
import { AppServicesContext } from '../effects/contexts';
import { toErrorText } from '../effects/promise';
import {
    bootOrConnectService,
    createSignifyClientService,
    getSignifyStateService,
    randomPasscodeService,
    readyService,
    waitOperationService,
} from '../services/signify.service';
import type {
    ConnectedSignifyClient,
    SignifyClientConfig,
    SignifyStateSummary,
} from '../signify/client';
import {
    sessionConnected,
    sessionConnectionFailed,
    sessionConnecting,
    sessionStateRefreshed,
} from '../state/session.slice';

/**
 * Prepare Signify's WASM/runtime dependencies.
 */
export function* readyOp(): EffectionOperation<void> {
    yield* readyService();
}

/**
 * Generate a Signify passcode inside the workflow runtime.
 */
export function* randomPasscodeOp(): EffectionOperation<string> {
    return yield* randomPasscodeService();
}

/**
 * Construct a raw Signify client without connecting it.
 */
export function* createSignifyClientOp(
    config: SignifyClientConfig
): EffectionOperation<SignifyClient> {
    return yield* createSignifyClientService(config);
}

/**
 * Connect to KERIA, booting on missing-agent, and mirror status into Redux.
 */
export function* bootOrConnectOp(
    config: SignifyClientConfig
): EffectionOperation<ConnectedSignifyClient> {
    const services = yield* AppServicesContext.expect();
    services.store.dispatch(sessionConnecting());

    try {
        const connected = yield* bootOrConnectService(config);
        services.store.dispatch(
            sessionConnected({
                booted: connected.booted,
                controllerAid: connected.state.controllerPre,
                agentAid: connected.state.agentPre,
                connectedAt: new Date().toISOString(),
            })
        );
        return connected;
    } catch (error) {
        services.store.dispatch(sessionConnectionFailed(toErrorText(error)));
        throw error;
    }
}

/**
 * Refresh normalized controller/agent state and mirror it into Redux.
 */
export function* getSignifyStateOp(
    client?: SignifyClient
): EffectionOperation<SignifyStateSummary> {
    const services = yield* AppServicesContext.expect();
    const connectedClient = client ?? services.runtime.requireConnectedClient();
    const state = yield* getSignifyStateService(connectedClient);

    services.store.dispatch(
        sessionStateRefreshed({
            controllerAid: state.controllerPre,
            agentAid: state.agentPre,
        })
    );

    return state;
}

/**
 * Wait for a KERIA operation with the current workflow abort signal.
 */
export function* waitOperationOp({
    client,
    operation,
    label,
}: {
    client: SignifyClient;
    operation: KeriaOperation;
    label: string;
}): EffectionOperation<CompletedOperation> {
    const services = yield* AppServicesContext.expect();

    return yield* waitOperationService({
        client,
        operation,
        label,
        logger: services.logger,
    });
}
