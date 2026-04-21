import {
    ready,
    type CompletedOperation,
    type Operation as KeriaOperation,
    type SignifyClient,
} from 'signify-ts';
import {
    useAbortSignal as effectionAbortSignal,
    type Operation as EffectionOperation,
} from 'effection';
import { callPromise } from '../effects/promise';
import {
    connectSignifyClient,
    createSignifyClient,
    getSignifyState,
    randomSignifyPasscode,
    waitOperation,
    type ConnectedSignifyClient,
    type OperationLogger,
    type SignifyClientConfig,
    type SignifyStateSummary,
} from '../signify/client';

/**
 * Effection service operation for Signify WASM readiness.
 */
export function* readyService(): EffectionOperation<void> {
    yield* callPromise(() => ready());
}

/**
 * Generate a random Signify passcode through the client boundary.
 */
export function* randomPasscodeService(): EffectionOperation<string> {
    return yield* callPromise(() => randomSignifyPasscode());
}

/**
 * Construct a raw Signify client through the one allowed construction site.
 */
export function* createSignifyClientService(
    config: SignifyClientConfig
): EffectionOperation<SignifyClient> {
    return yield* callPromise(() => createSignifyClient(config));
}

/**
 * Connect to KERIA, booting only on the expected missing-agent path.
 */
export function* bootOrConnectService(
    config: SignifyClientConfig
): EffectionOperation<ConnectedSignifyClient> {
    return yield* callPromise(() => connectSignifyClient(config));
}

/**
 * Read and normalize controller/agent state from a connected Signify client.
 */
export function* getSignifyStateService(
    client: SignifyClient
): EffectionOperation<SignifyStateSummary> {
    return yield* callPromise(() => getSignifyState(client));
}

/**
 * Wait for a KERIA operation using app timeout/logging policy.
 *
 * The abort signal comes from Effection, so route aborts and session teardown
 * halt the wait without every workflow manually threading a signal parameter.
 */
export function* waitOperationService({
    client,
    operation,
    label,
    logger,
}: {
    client: SignifyClient;
    operation: KeriaOperation;
    label: string;
    logger?: OperationLogger;
}): EffectionOperation<CompletedOperation> {
    const signal = yield* effectionAbortSignal();
    return yield* callPromise(() =>
        waitOperation(client, operation, {
            label,
            signal,
            logger,
        })
    );
}
