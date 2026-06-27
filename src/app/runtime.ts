import type { Operation as EffectionOperation, Task } from 'effection';
import type { SignifyClient } from 'signify-ts';
import { appConfig, type AppConfig } from '../config';
import { toErrorText } from '../effects/promise';
import { AppEffectionScopes } from '../effects/scope';
import {
    toError,
    type ConnectedSignifyClient,
    type OperationLogger,
    type SignifyClientConfig,
    type SignifyStateSummary,
} from '../signify/client';
import {
    appNotificationsRehydrated,
    appNotificationRecorded,
    type AppNotificationLink,
    type AppNotificationRecord,
} from '../state/appNotifications.slice';
import { storedChallengeWordsRehydrated } from '../state/challenges.slice';
import { exchangeTombstonesRehydrated } from '../state/exchangeTombstones.slice';
import {
    cancelRunningOperations,
    operationCanceled,
    operationFailed,
    operationPayloadDetailsRecorded,
    operationsRehydrated,
    operationResultLinked,
    operationStarted,
    operationSucceeded,
} from '../state/operations.slice';
import type { PayloadDetailRecord } from '../state/payloadDetails';
import {
    clearAllPersistedAppStates,
    flushPersistedAppState,
    installAppStatePersistence,
    rehydratePersistedAppState,
    type AppStateStorage,
} from '../state/persistence';
import {
    createBrowserWalletSelectionPersistenceStore,
    installWalletSelectionPersistence,
    rehydrateWalletSelection as rehydratePersistedWalletSelection,
    type WalletSelectionPersistenceStore,
} from '../state/walletSelectionPersistence';
import {
    sessionConnected,
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
    sessionStateRefreshed,
} from '../state/session.slice';
import { appStore, type AppStore } from '../state/store';
import { walletAidCleared } from '../state/walletSelection.slice';
import {
    bootOrConnectOp,
    getSignifyStateOp,
    randomPasscodeOp,
} from '../workflows/signify.op';
import {
    createChallengeRuntimeCommands,
    createContactRuntimeCommands,
    createCredentialRuntimeCommands,
    createDelegationRuntimeCommands,
    createDidWebsRuntimeCommands,
    createIdentifierRuntimeCommands,
    createMultisigRuntimeCommands,
    createNotificationRuntimeCommands,
    type BackgroundWorkflowRunOptions,
    type BackgroundWorkflowStartResult,
    type ChallengeRuntimeCommands,
    type ContactRuntimeCommands,
    type CredentialRuntimeCommands,
    type DelegationRuntimeCommands,
    type DidWebsRuntimeCommands,
    type IdentifierRuntimeCommands,
    type MultisigRuntimeCommands,
    type NotificationRuntimeCommands,
    type RuntimeCommandContext,
    type WorkflowRunOptions,
} from './runtimeCommands';

export type {
    BackgroundWorkflowRunOptions,
    BackgroundWorkflowStartResult,
    OperationNotificationTemplate,
    WorkflowRunOptions,
} from './runtimeCommands';

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
    /** Optional persistence storage override; `null` disables persistence. */
    storage?: AppStateStorage | null;
    /** Optional selected-wallet-AID persistence override; `null` disables it. */
    walletSelectionStorage?: WalletSelectionPersistenceStore | null;
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

const operationRoute = (requestId: string): string =>
    `/operations/${requestId}`;

const notificationId = (requestId: string): string =>
    `notification-${requestId}-${Date.now()}`;

/**
 * Data-router-safe Signify session and command boundary.
 *
 * React Router loaders and actions cannot call React hooks, so all KERIA-backed
 * work that a route may perform goes through this runtime. React components
 * subscribe to the same runtime through `AppRuntimeProvider`, which keeps route
 * actions, route loaders, and visible shell state on one source of truth.
 */
export class AppRuntime {
    /** Serializable fact store used by workflows and shell selectors. */
    private readonly store: AppStore;

    /** Parsed app configuration shared by runtime-launched workflows. */
    private readonly config: AppConfig;

    /** Effection app/session scopes that own cancellation and lifetimes. */
    private readonly scopes: AppEffectionScopes;

    /** Identifier command adapter for route loaders, actions, and views. */
    readonly identifiers: IdentifierRuntimeCommands;

    /** Contact and OOBI command adapter. */
    readonly contacts: ContactRuntimeCommands;

    /** Challenge-response command adapter. */
    readonly challenges: ChallengeRuntimeCommands;

    /** Notification command adapter. */
    readonly notifications: NotificationRuntimeCommands;

    /** Delegation approval command adapter. */
    readonly delegations: DelegationRuntimeCommands;

    /** Credential/schema/registry command adapter. */
    readonly credentials: CredentialRuntimeCommands;

    /** Multisig group command adapter. */
    readonly multisig: MultisigRuntimeCommands;

    /** did:webs DID command adapter. */
    readonly didwebs: DidWebsRuntimeCommands;

    /** Foreground and background task handles keyed by route request id. */
    private readonly activeTasks = new Map<string, Task<unknown>>();

    /** Session-scoped live inventory poller; halted on disconnect/reconnect. */
    private liveSyncTask: Task<void> | null = null;

    /** Optional storage override for tests; `undefined` means browser default. */
    private readonly storage: AppStateStorage | null | undefined;

    /** IndexedDB-backed selected-wallet-AID storage. */
    private readonly walletSelectionStorage: WalletSelectionPersistenceStore | null;

    /** Controller AID selecting the current persisted app-state bucket. */
    private currentControllerAid: string | null = null;

    /** Controller AID currently allowed to save selected-wallet-AID changes. */
    private currentWalletSelectionControllerAid: string | null = null;

    /** Monotonic guard for async selected-wallet-AID rehydration. */
    private walletSelectionHydrationToken = 0;

    /** Store subscription cleanup for controller-scoped persistence writes. */
    private readonly uninstallPersistence: () => void;

    /** Store subscription cleanup for controller-scoped wallet selection writes. */
    private readonly uninstallWalletSelectionPersistence: () => void;

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

    /**
     * Build a runtime around injectable store/config/storage dependencies.
     */
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
        const commandContext: RuntimeCommandContext = {
            runWorkflow: this.runWorkflow,
            startBackgroundWorkflow: this.startBackgroundWorkflow,
            createRequestId,
            getState: () => this.store.getState(),
        };
        this.identifiers = createIdentifierRuntimeCommands(commandContext);
        this.contacts = createContactRuntimeCommands(commandContext);
        this.challenges = createChallengeRuntimeCommands(commandContext);
        this.notifications = createNotificationRuntimeCommands(commandContext);
        this.delegations = createDelegationRuntimeCommands(commandContext);
        this.credentials = createCredentialRuntimeCommands(commandContext);
        this.multisig = createMultisigRuntimeCommands(commandContext);
        this.didwebs = createDidWebsRuntimeCommands(commandContext);

        this.storage =
            options.storage === undefined ? undefined : options.storage;
        this.walletSelectionStorage =
            options.walletSelectionStorage === undefined
                ? createBrowserWalletSelectionPersistenceStore()
                : options.walletSelectionStorage;
        this.uninstallPersistence = installAppStatePersistence(
            this.store,
            () => this.currentControllerAid,
            this.storage
        );
        this.uninstallWalletSelectionPersistence =
            installWalletSelectionPersistence(
                this.store,
                () => this.currentWalletSelectionControllerAid,
                this.walletSelectionStorage
            );
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
        this.flushPersistence();
        this.currentControllerAid = null;
        this.currentWalletSelectionControllerAid = null;
        this.walletSelectionHydrationToken += 1;
        this.store.dispatch(sessionConnecting());
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
            this.setPersistenceController(connected.state.controllerPre);
            this.setConnection({
                status: 'connected',
                client: connected.client,
                state: connected.state,
                error: null,
                booted: connected.booted,
            });
            this.store.dispatch(
                sessionConnected({
                    booted: connected.booted,
                    controllerAid: connected.state.controllerPre,
                    agentAid: connected.state.agentPre,
                    connectedAt: new Date().toISOString(),
                })
            );
            this.startLiveSync();
            return connected;
        } catch (error) {
            const normalized = toError(error);
            this.store.dispatch(sessionConnectionFailed(normalized.message));
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
        void this.stopLiveSync();
        this.flushPersistence();
        void this.scopes.haltSession();
        this.currentControllerAid = null;
        this.currentWalletSelectionControllerAid = null;
        this.walletSelectionHydrationToken += 1;
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
        this.store.dispatch(
            sessionStateRefreshed({
                controllerAid: state.controllerPre,
                agentAid: state.agentPre,
            })
        );
        return state;
    };

    /**
     * Clear all browser-persisted app state buckets and the current in-memory
     * projections that are backed by those buckets.
     */
    clearAllLocalState = (): number => {
        const previousControllerAid = this.currentControllerAid;
        const previousWalletSelectionControllerAid =
            this.currentWalletSelectionControllerAid;
        this.currentControllerAid = null;
        this.currentWalletSelectionControllerAid = null;
        try {
            this.store.dispatch(
                operationsRehydrated({
                    records: [],
                    interruptedAt: new Date().toISOString(),
                })
            );
            this.store.dispatch(
                appNotificationsRehydrated({
                    records: [],
                })
            );
            this.store.dispatch(
                exchangeTombstonesRehydrated({
                    records: [],
                })
            );
            this.store.dispatch(
                storedChallengeWordsRehydrated({
                    records: [],
                })
            );
            this.store.dispatch(walletAidCleared());
            void this.walletSelectionStorage?.clearAll().catch(() => undefined);
            return clearAllPersistedAppStates(this.storage);
        } finally {
            this.currentControllerAid = previousControllerAid;
            this.currentWalletSelectionControllerAid =
                previousWalletSelectionControllerAid;
        }
    };

    /**
     * Start a non-blocking workflow and return accepted/conflict metadata.
     *
     * This is the top-level handoff point for background KERIA work. It owns
     * conflict checks, operation history, task retention, and completion
     * notifications so route actions can return immediately without losing
     * lifecycle facts.
     */
    startBackgroundWorkflow = <T>(
        operation: () => EffectionOperation<T>,
        options: BackgroundWorkflowRunOptions<T>
    ): BackgroundWorkflowStartResult => {
        const resourceKeys = [...(options.resourceKeys ?? [])];
        const conflict = this.findResourceConflict(resourceKeys);
        if (conflict !== null) {
            return {
                status: 'conflict',
                requestId: conflict.requestId,
                operationRoute: conflict.operationRoute,
                message: `Already working on ${conflict.title}.`,
            };
        }

        const requestId = options.requestId ?? createRequestId();
        const route = operationRoute(requestId);
        this.store.dispatch(
            operationStarted({
                requestId,
                label: options.label,
                title: options.title ?? options.label,
                description: options.description ?? null,
                kind: options.kind,
                phase: 'running',
                resourceKeys,
                operationRoute: route,
                resultRoute: options.resultRoute ?? null,
            })
        );

        const task = this.scopes.run(operation, options.scope ?? 'session');
        this.activeTasks.set(requestId, task);

        void this.watchBackgroundTask(task, requestId, options);

        return {
            status: 'accepted',
            requestId,
            operationRoute: route,
        };
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
     * Observe detached background work and close operation/notification facts.
     */
    private watchBackgroundTask = async <T>(
        task: Task<T>,
        requestId: string,
        options: BackgroundWorkflowRunOptions<T>
    ): Promise<void> => {
        try {
            const result = await task;
            const payloadDetails =
                options.payloadDetails?.(result, this.store.getState()) ?? [];
            if (payloadDetails.length > 0) {
                this.store.dispatch(
                    operationPayloadDetailsRecorded({
                        requestId,
                        payloadDetails,
                    })
                );
            }
            this.store.dispatch(operationSucceeded({ requestId }));
            this.recordCompletionNotification(
                requestId,
                options,
                'success',
                undefined,
                payloadDetails
            );
        } catch (error) {
            if (isHaltedOrAborted(error)) {
                this.store.dispatch(
                    operationCanceled({
                        requestId,
                        reason: 'Operation canceled.',
                    })
                );
            } else {
                this.store.dispatch(
                    operationFailed({
                        requestId,
                        error: toErrorText(error),
                    })
                );
                this.recordCompletionNotification(
                    requestId,
                    options,
                    'error',
                    toErrorText(error)
                );
            }
        } finally {
            this.activeTasks.delete(requestId);
        }
    };

    /**
     * Create the user-facing app notification for a completed background task.
     *
     * Notifications are derived from runtime operation metadata so every
     * notification has a stable operation link and optional result link.
     */
    private recordCompletionNotification = <T>(
        requestId: string,
        options: BackgroundWorkflowRunOptions<T>,
        outcome: 'success' | 'error',
        error?: string,
        payloadDetails: PayloadDetailRecord[] = []
    ): void => {
        const template =
            outcome === 'success'
                ? options.successNotification
                : options.failureNotification;
        if (template === undefined) {
            return;
        }

        const id = notificationId(requestId);
        const links: AppNotificationLink[] = [
            {
                rel: 'notification',
                label: 'View notification',
                path: `/notifications/${encodeURIComponent(id)}`,
            },
            {
                rel: 'operation',
                label: 'View operation',
                path: operationRoute(requestId),
            },
        ];
        if (options.resultRoute !== null && options.resultRoute !== undefined) {
            links.push({
                rel: 'result',
                label: options.resultRoute.label,
                path: options.resultRoute.path,
            });
        }

        const notification: AppNotificationRecord = {
            id,
            severity:
                template.severity ??
                (outcome === 'success' ? 'success' : 'error'),
            status: 'unread',
            title: template.title,
            message:
                error === undefined
                    ? template.message
                    : `${template.message} ${error}`,
            createdAt: new Date().toISOString(),
            readAt: null,
            operationId: requestId,
            links,
            payloadDetails,
        };

        this.store.dispatch(appNotificationRecorded(notification));
        this.store.dispatch(
            operationResultLinked({
                requestId,
                resultRoute: options.resultRoute ?? null,
                notificationId: id,
            })
        );
    };

    /**
     * Find a running operation that owns any requested resource key.
     */
    private findResourceConflict = (
        resourceKeys: readonly string[]
    ): {
        requestId: string;
        title: string;
        operationRoute: string;
    } | null => {
        if (resourceKeys.length === 0) {
            return null;
        }

        const requested = new Set(resourceKeys);
        const state = this.store.getState();
        for (const requestId of state.operations.order) {
            const record = state.operations.byId[requestId];
            if (
                record?.status === 'running' &&
                record.resourceKeys.some((key) => requested.has(key))
            ) {
                return {
                    requestId: record.requestId,
                    title: record.title,
                    operationRoute: record.operationRoute,
                };
            }
        }

        return null;
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
        this.flushPersistence();

        await this.stopLiveSync();
        for (const task of this.activeTasks.values()) {
            await task.halt();
        }
        this.activeTasks.clear();

        await this.scopes.destroy();
        this.uninstallPersistence();
        this.uninstallWalletSelectionPersistence();
        this.currentControllerAid = null;
        this.currentWalletSelectionControllerAid = null;
        this.walletSelectionHydrationToken += 1;
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

    /**
     * Start the session poller that keeps contacts, challenges, and KERIA
     * notifications fresh without component-owned timers.
     */
    private startLiveSync = (): void => {
        if (this.liveSyncTask !== null) {
            void this.liveSyncTask.halt();
        }

        const task = this.scopes.run(this.contacts.liveInventory, 'session');
        this.liveSyncTask = task;

        void this.watchLiveSyncTask(task);
    };

    /**
     * Record unexpected live-inventory failures and clear the retained handle.
     */
    private watchLiveSyncTask = async (task: Task<void>): Promise<void> => {
        try {
            await task;
        } catch (error) {
            if (!isHaltedOrAborted(error)) {
                this.store.dispatch(
                    appNotificationRecorded({
                        id: `live-sync-failed-${Date.now()}`,
                        severity: 'warning',
                        status: 'unread',
                        title: 'Live inventory sync stopped',
                        message: toErrorText(error),
                        createdAt: new Date().toISOString(),
                        readAt: null,
                        operationId: null,
                        links: [],
                        payloadDetails: [],
                    })
                );
            }
        } finally {
            if (this.liveSyncTask === task) {
                this.liveSyncTask = null;
            }
        }
    };

    /**
     * Halt the live inventory poller before disconnect, reconnect, or destroy.
     */
    private stopLiveSync = async (): Promise<void> => {
        const task = this.liveSyncTask;
        if (task === null) {
            return;
        }

        this.liveSyncTask = null;
        await task.halt();
    };

    /**
     * Switch the active localStorage bucket to the connected controller AID.
     */
    private setPersistenceController = (controllerAid: string | null): void => {
        if (controllerAid === this.currentControllerAid) {
            return;
        }

        // Persist under the old controller before loading a different bucket.
        this.flushPersistence();
        this.currentControllerAid = controllerAid;
        this.currentWalletSelectionControllerAid = null;
        this.walletSelectionHydrationToken += 1;
        if (controllerAid !== null) {
            rehydratePersistedAppState(this.store, controllerAid, this.storage);
            void this.rehydrateWalletSelection(controllerAid);
        }
    };

    /**
     * Load the last selected wallet AID only after the controller bucket is known.
     */
    private rehydrateWalletSelection = async (
        controllerAid: string
    ): Promise<void> => {
        const token = this.walletSelectionHydrationToken;
        try {
            await rehydratePersistedWalletSelection({
                store: this.store,
                controllerAid,
                storage: this.walletSelectionStorage,
                canApply: () =>
                    this.currentControllerAid === controllerAid &&
                    this.walletSelectionHydrationToken === token,
            });
        } finally {
            if (
                this.currentControllerAid === controllerAid &&
                this.walletSelectionHydrationToken === token
            ) {
                this.currentWalletSelectionControllerAid = controllerAid;
                void this.walletSelectionStorage
                    ?.save(
                        controllerAid,
                        this.store.getState().walletSelection.selectedAid
                    )
                    .catch(() => undefined);
            }
        }
    };

    /**
     * Eagerly persist the current controller bucket before lifecycle changes.
     */
    private flushPersistence = (): void => {
        flushPersistedAppState(
            this.store,
            this.currentControllerAid,
            this.storage
        );
    };
}

/**
 * Create the one runtime instance used by the browser data router.
 */
export const createAppRuntime = (options?: AppRuntimeOptions): AppRuntime =>
    new AppRuntime(options);
