import type { Operation as EffectionOperation, Task } from 'effection';
import type { SignifyClient } from 'signify-ts';
import { appConfig, type AppConfig } from '../config';
import { toErrorText } from '../effects/promise';
import { AppEffectionScopes, type RuntimeScopeKind } from '../effects/scope';
import type {
    IdentifierCreateDraft,
    IdentifierSummary,
} from '../features/identifiers/identifierTypes';
import {
    toError,
    type ConnectedSignifyClient,
    type OperationLogger,
    type SignifyClientConfig,
    type SignifyStateSummary,
} from '../signify/client';
import {
    cancelRunningOperations,
    operationCanceled,
    operationFailed,
    operationStarted,
    operationSucceeded,
} from '../state/operations.slice';
import { sessionDisconnected } from '../state/session.slice';
import { appStore, type AppStore } from '../state/store';
import {
    createIdentifierOp,
    listIdentifiersOp,
    rotateIdentifierOp,
} from '../workflows/identifiers.op';
import {
    bootOrConnectOp,
    getSignifyStateOp,
    randomPasscodeOp,
} from '../workflows/signify.op';

/**
 * Complete connection-state model for the app runtime.
 *
 * The union intentionally carries `client` and `state` only in the connected
 * branch so components and route functions cannot accidentally use stale
 * Signify objects after a failed or cleared connection.
 */
export type SignifyConnectionState =
    | { status: 'idle'; client: null; state: null; error: null; booted: false }
    | {
          status: 'connecting';
          client: null;
          state: null;
          error: null;
          booted: false;
      }
    | {
          status: 'connected';
          client: SignifyClient;
          state: SignifyStateSummary;
          error: null;
          booted: boolean;
      }
    | {
          status: 'error';
          client: null;
          state: null;
          error: Error;
          booted: false;
      };

/**
 * Immutable snapshot shape exposed to React subscribers.
 */
export interface AppRuntimeSnapshot {
    connection: SignifyConnectionState;
}

/**
 * Listener signature used by `useSyncExternalStore`.
 */
export type AppRuntimeListener = () => void;

/**
 * Optional dependencies for constructing an isolated app runtime.
 */
export interface AppRuntimeOptions {
    /** Store instance; tests pass isolated stores, browser uses singleton. */
    store?: AppStore;
    /** Runtime config; tests may pass fixture config, browser uses app config. */
    config?: AppConfig;
    /** Optional logger called during KERIA operation waits. */
    logger?: OperationLogger;
}

/**
 * Per-call workflow controls used by route loaders/actions.
 */
export interface WorkflowRunOptions {
    /** Abort signal from React Router request or caller-owned cancellation. */
    signal?: AbortSignal;
    /** Stable id for operation tracking; generated when omitted. */
    requestId?: string;
    /** User-facing pending label stored in the operations slice. */
    label?: string;
    /** Machine-readable operation category for diagnostics. */
    kind?: string;
    /** Effection scope lifetime for the launched workflow. */
    scope?: RuntimeScopeKind;
    /** Whether to write operation lifecycle records into Redux. */
    track?: boolean;
}

/**
 * Initial disconnected runtime state.
 *
 * Reuse this immutable value when clearing a session so idle semantics stay
 * identical between startup and explicit disconnect.
 */
const idleConnection: SignifyConnectionState = {
    status: 'idle',
    client: null,
    state: null,
    error: null,
    booted: false,
};

/**
 * Create a request id for operation tracking when a route does not supply one.
 */
const createRequestId = (): string =>
    globalThis.crypto?.randomUUID?.() ??
    `workflow-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Recognize cancellation failures from router aborts and Effection halts.
 */
const isHaltedOrAborted = (error: unknown, signal?: AbortSignal): boolean =>
    signal?.aborted === true ||
    (error instanceof Error &&
        (error.name === 'AbortError' || error.message === 'halted'));

/**
 * Convert an optional abort signal into a standard AbortError.
 */
const abortError = (signal?: AbortSignal): Error => {
    if (signal?.reason instanceof Error) {
        return signal.reason;
    }

    const error = new Error('Operation canceled.');
    error.name = 'AbortError';
    return error;
};

/**
 * Data-router-safe Signify session and command boundary.
 *
 * React Router loaders and actions cannot call React hooks, so all KERIA-backed
 * work that a route may perform goes through this runtime. React components
 * subscribe to the same runtime through `AppRuntimeProvider`, which keeps route
 * actions, route loaders, and visible shell state on one source of truth.
 */
export class AppRuntime {
    private readonly store: AppStore;

    private readonly config: AppConfig;

    private readonly scopes: AppEffectionScopes;

    private readonly activeTasks = new Map<string, Task<unknown>>();

    /**
     * Current runtime snapshot exposed to React and route functions.
     */
    private snapshot: AppRuntimeSnapshot = {
        connection: idleConnection,
    };

    /**
     * React/store subscribers notified after every snapshot replacement.
     */
    private readonly listeners = new Set<AppRuntimeListener>();

    constructor(options: AppRuntimeOptions = {}) {
        this.store = options.store ?? appStore;
        this.config = options.config ?? appConfig;
        const logger = options.logger ?? (() => undefined);

        this.scopes = new AppEffectionScopes({
            runtime: this,
            config: this.config,
            store: this.store,
            logger,
        });
    }

    /**
     * Subscribe to runtime snapshot changes.
     *
     * This method intentionally matches the `useSyncExternalStore` contract so
     * React can consume app-session state without duplicating it in component
     * state.
     */
    subscribe = (listener: AppRuntimeListener): (() => void) => {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    };

    /**
     * Return the latest runtime snapshot without mutating state.
     */
    getSnapshot = (): AppRuntimeSnapshot => this.snapshot;

    /**
     * Return the full typed connection state.
     */
    getConnection = (): SignifyConnectionState => this.snapshot.connection;

    /**
     * Return the connected Signify client, or `null` when blocked/disconnected.
     */
    getClient = (): SignifyClient | null =>
        this.snapshot.connection.status === 'connected'
            ? this.snapshot.connection.client
            : null;

    /**
     * Return the latest normalized Signify state, or `null` when disconnected.
     */
    getState = (): SignifyStateSummary | null =>
        this.snapshot.connection.status === 'connected'
            ? this.snapshot.connection.state
            : null;

    /**
     * Connect to KERIA and publish connecting/connected/error snapshots.
     *
     * Recoverable connection failures are normalized into runtime error state
     * and return `null` so the root route action can render dialog feedback
     * instead of throwing into the app error boundary.
     */
    connect = async (
        config: SignifyClientConfig,
        options: WorkflowRunOptions = {}
    ): Promise<ConnectedSignifyClient | null> => {
        this.setConnection({
            status: 'connecting',
            client: null,
            state: null,
            error: null,
            booted: false,
        });

        try {
            const connected = await this.runWorkflow(
                () => bootOrConnectOp(config),
                {
                    ...options,
                    label: options.label ?? 'Connecting to KERIA...',
                    kind: options.kind ?? 'connect',
                    scope: 'app',
                }
            );
            await this.scopes.startSession();
            this.setConnection({
                status: 'connected',
                client: connected.client,
                state: connected.state,
                error: null,
                booted: connected.booted,
            });
            return connected;
        } catch (error) {
            const normalized = toError(error);
            this.setConnection({
                status: 'error',
                client: null,
                state: null,
                error: normalized,
                booted: false,
            });
            return null;
        }
    };

    /**
     * Clear the connected session without making network calls.
     */
    disconnect = (): void => {
        this.store.dispatch(
            cancelRunningOperations({
                reason: 'Session disconnected.',
            })
        );
        void this.scopes.haltSession();
        this.store.dispatch(sessionDisconnected());
        this.setConnection(idleConnection);
    };

    /**
     * Generate a Signify passcode through the shared client boundary.
     */
    generatePasscode = async (
        options: WorkflowRunOptions = {}
    ): Promise<string> =>
        this.runWorkflow(() => randomPasscodeOp(), {
            ...options,
            label: options.label ?? 'Preparing Signify...',
            kind: options.kind ?? 'generatePasscode',
            scope: 'app',
        });

    /**
     * Refresh normalized KERIA agent/controller state for the connected client.
     */
    refreshState = async (
        options: WorkflowRunOptions = {}
    ): Promise<SignifyStateSummary | null> => {
        const connection = this.snapshot.connection;
        if (connection.status !== 'connected') {
            return null;
        }

        const state = await this.runWorkflow(
            () => getSignifyStateOp(connection.client),
            {
                ...options,
                label: options.label ?? 'Refreshing client state...',
                kind: options.kind ?? 'refreshState',
            }
        );
        this.setConnection({
            ...connection,
            state,
        });
        return state;
    };

    /**
     * List identifiers through the connected Signify client and normalize the
     * response shape for route loader consumers.
     */
    listIdentifiers = async (
        options: WorkflowRunOptions = {}
    ): Promise<IdentifierSummary[]> =>
        this.runWorkflow(() => listIdentifiersOp(), {
            ...options,
            label: options.label ?? 'Loading identifiers...',
            kind: options.kind ?? 'listIdentifiers',
        });

    /**
     * Create an identifier, wait for the resulting KERIA operation, then return
     * a freshly loaded identifier list for router revalidation callers.
     */
    createIdentifier = async (
        draft: IdentifierCreateDraft,
        options: WorkflowRunOptions = {}
    ): Promise<IdentifierSummary[]> => {
        return this.runWorkflow(() => createIdentifierOp(draft), {
            ...options,
            label: options.label ?? 'Creating identifier...',
            kind: options.kind ?? 'createIdentifier',
        });
    };

    /**
     * Rotate an identifier, wait for completion, then return a freshly loaded
     * identifier list for router revalidation callers.
     */
    rotateIdentifier = async (
        aid: string,
        options: WorkflowRunOptions = {}
    ): Promise<IdentifierSummary[]> => {
        return this.runWorkflow(() => rotateIdentifierOp(aid), {
            ...options,
            label: options.label ?? 'Rotating identifier...',
            kind: options.kind ?? 'rotateIdentifier',
        });
    };

    /**
     * Bridge React Router's Promise-facing APIs into Effection operations.
     *
     * Routes call this indirectly through runtime methods. The runtime owns
     * task handles, route abort wiring, and serializable operation lifecycle
     * facts; workflow files own the actual Signify/KERIA unit of work.
     */
    runWorkflow = async <T>(
        operation: () => EffectionOperation<T>,
        options: WorkflowRunOptions = {}
    ): Promise<T> => {
        const requestId = options.requestId ?? createRequestId();
        const shouldTrack = options.track ?? options.label !== undefined;

        if (shouldTrack) {
            this.store.dispatch(
                operationStarted({
                    requestId,
                    label: options.label ?? 'Loading...',
                    kind: options.kind ?? 'workflow',
                })
            );
        }

        const task = this.scopes.run(operation, options.scope ?? 'session');
        this.activeTasks.set(requestId, task);

        let aborted = false;
        let rejectAbort: ((error: Error) => void) | null = null;
        const abortPromise = new Promise<never>((_, reject) => {
            rejectAbort = reject;
        });
        const haltTask = () => {
            if (aborted) {
                return;
            }

            aborted = true;
            void task.halt();
            rejectAbort?.(abortError(options.signal));
        };

        if (options.signal?.aborted) {
            haltTask();
        } else {
            options.signal?.addEventListener('abort', haltTask, { once: true });
        }

        try {
            const result = await (options.signal === undefined
                ? task
                : Promise.race([task, abortPromise]));
            if (shouldTrack) {
                this.store.dispatch(operationSucceeded({ requestId }));
            }
            return result;
        } catch (error) {
            if (isHaltedOrAborted(error, options.signal) || aborted) {
                if (shouldTrack) {
                    this.store.dispatch(
                        operationCanceled({
                            requestId,
                            reason: 'Operation canceled.',
                        })
                    );
                }
            } else if (shouldTrack) {
                this.store.dispatch(
                    operationFailed({
                        requestId,
                        error: toErrorText(error),
                    })
                );
            }

            throw error;
        } finally {
            options.signal?.removeEventListener('abort', haltTask);
            this.activeTasks.delete(requestId);
        }
    };

    /**
     * Halt app-owned Effection work during React unmount, HMR, or page teardown.
     */
    destroy = async (): Promise<void> => {
        this.store.dispatch(
            cancelRunningOperations({
                reason: 'App runtime destroyed.',
            })
        );

        for (const task of this.activeTasks.values()) {
            await task.halt();
        }
        this.activeTasks.clear();

        await this.scopes.destroy();
        this.store.dispatch(sessionDisconnected());
        this.setConnection(idleConnection);
    };

    /**
     * Return the connected client or fail with a standard app-runtime error.
     *
     * Command methods call this after route actions have already checked
     * connection state. Keeping the guard here prevents future callers from
     * bypassing route-level gating and silently operating on `null`.
     */
    requireConnectedClient = (): SignifyClient => {
        const client = this.getClient();
        if (client === null) {
            throw new Error('A connected Signify client is required.');
        }

        return client;
    };

    /**
     * Replace the snapshot and notify every active subscriber.
     *
     * Snapshot replacement, rather than mutation, keeps `useSyncExternalStore`
     * consumers predictable and lets React compare stable object identities.
     */
    private setConnection = (connection: SignifyConnectionState): void => {
        this.snapshot = { connection };
        for (const listener of this.listeners) {
            listener();
        }
    };
}

/**
 * Create the one runtime instance used by the browser data router.
 */
export const createAppRuntime = (options?: AppRuntimeOptions): AppRuntime =>
    new AppRuntime(options);
