import type { Operation as EffectionOperation, Task } from 'effection';
import type { SignifyClient } from 'signify-ts';
import { appConfig, type AppConfig } from '../config';
import { toErrorText } from '../effects/promise';
import { AppEffectionScopes, type RuntimeScopeKind } from '../effects/scope';
import { aliasForOobiResolution } from '../features/contacts/contactHelpers';
import type {
    IdentifierCreateDraft,
    IdentifierSummary,
} from '../features/identifiers/identifierTypes';
import type { ResolveContactInput } from '../services/contacts.service';
import type { GeneratedOobiRecord } from '../state/contacts.slice';
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
    type AppNotificationSeverity,
} from '../state/appNotifications.slice';
import { storedChallengeWordsRehydrated } from '../state/challenges.slice';
import { exchangeTombstonesRehydrated } from '../state/exchangeTombstones.slice';
import {
    cancelRunningOperations,
    type OperationKind,
    type OperationRouteLink,
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
    sessionConnected,
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
    sessionStateRefreshed,
} from '../state/session.slice';
import { appStore, type AppStore } from '../state/store';
import {
    createIdentifierOp,
    getIdentifierOp,
    listIdentifiersOp,
    rotateIdentifierOp,
} from '../workflows/identifiers.op';
import {
    deleteContactOp,
    generateOobiOp,
    liveSessionInventoryOp,
    resolveContactOobiOp,
    syncSessionInventoryOp,
    updateContactAliasOp,
    type GenerateOobiInput,
    type SessionInventorySnapshot,
    type UpdateContactAliasInput,
} from '../workflows/contacts.op';
import {
    challengeResultRoute,
    generateContactChallengeOp,
    respondToContactChallengeOp,
    sendChallengeRequestOp,
    verifyContactChallengeOp,
    type GeneratedContactChallengeResult,
    type GenerateContactChallengeInput,
    type RespondToContactChallengeInput,
    type SendChallengeRequestInput,
    type VerifyContactChallengeInput,
} from '../workflows/challenges.op';
import {
    bootOrConnectOp,
    getSignifyStateOp,
    randomPasscodeOp,
} from '../workflows/signify.op';
import {
    dismissExchangeNotificationOp,
    type DismissExchangeNotificationInput,
} from '../workflows/notifications.op';
import {
    admitCredentialGrantOp,
    createCredentialRegistryOp,
    grantCredentialOp,
    issueSediCredentialOp,
    resolveCredentialSchemaOp,
    syncCredentialIpexActivityOp,
    syncCredentialInventoryOp,
    syncCredentialRegistriesOp,
    syncKnownCredentialSchemasOp,
    type AdmitCredentialGrantInput,
    type CreateCredentialRegistryInput,
    type GrantCredentialInput,
    type IssueSediCredentialInput,
    type ResolveCredentialSchemaInput,
} from '../workflows/credentials.op';

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
    kind?: OperationKind;
    /** Effection scope lifetime for the launched workflow. */
    scope?: RuntimeScopeKind;
    /** Whether to write operation lifecycle records into Redux. */
    track?: boolean;
}

/**
 * User-facing completion copy attached to a background operation outcome.
 */
export interface OperationNotificationTemplate {
    title: string;
    message: string;
    severity?: AppNotificationSeverity;
}

/**
 * Runtime-owned metadata for one non-blocking Effection workflow.
 *
 * The workflow file owns Signify/KERIA behavior; these options describe how the
 * shell should track, de-duplicate, link, and announce that work.
 */
export interface BackgroundWorkflowRunOptions {
    requestId?: string;
    label: string;
    title?: string;
    description?: string | null;
    kind: OperationKind;
    scope?: RuntimeScopeKind;
    resourceKeys?: readonly string[];
    resultRoute?: OperationRouteLink | null;
    successNotification?: OperationNotificationTemplate;
    failureNotification?: OperationNotificationTemplate;
}

/**
 * Immediate route-action result from a background workflow launch.
 *
 * Route actions return this instead of waiting for KERIA, which lets the UI
 * navigate while operation records and app notifications carry progress.
 */
export type BackgroundWorkflowStartResult =
    | {
          status: 'accepted';
          requestId: string;
          operationRoute: string;
      }
    | {
          status: 'conflict';
          requestId: string;
          operationRoute: string;
          message: string;
      };

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.flatMap((item) => {
              const text = stringValue(item);
              return text === null ? [] : [text];
          })
        : [];

const detailId = (label: string, index: number): string =>
    `${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${index}`;

const payloadDetailsFromWorkflowResult = (
    result: unknown
): PayloadDetailRecord[] => {
    if (!isRecord(result)) {
        return [];
    }

    const details: PayloadDetailRecord[] = [];
    const generatedOobis = stringArray(result.oobis);
    generatedOobis.forEach((oobi, index) => {
        details.push({
            id: detailId('generated-oobi', index),
            label: generatedOobis.length === 1 ? 'OOBI' : `OOBI ${index + 1}`,
            value: oobi,
            kind: 'oobi',
            copyable: true,
        });
    });

    const sourceOobi = stringValue(result.sourceOobi);
    if (sourceOobi !== null) {
        details.push({
            id: detailId('source-oobi', details.length),
            label: 'OOBI',
            value: sourceOobi,
            kind: 'oobi',
            copyable: true,
        });
    }

    const resolutionOobi = stringValue(result.resolutionOobi);
    if (resolutionOobi !== null && resolutionOobi !== sourceOobi) {
        details.push({
            id: detailId('resolution-oobi', details.length),
            label: 'Resolved URL',
            value: resolutionOobi,
            kind: 'oobi',
            copyable: true,
        });
    }

    const resolvedAid = stringValue(result.resolvedAid);
    if (resolvedAid !== null) {
        details.push({
            id: detailId('resolved-aid', details.length),
            label: 'AID',
            value: resolvedAid,
            kind: 'aid',
            copyable: true,
        });
    }

    const seen = new Set<string>();
    return details.filter((detail) => {
        const key = `${detail.label}:${detail.value}`;
        if (seen.has(key)) {
            return false;
        }

        seen.add(key);
        return true;
    });
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
    /** Serializable fact store used by workflows and shell selectors. */
    private readonly store: AppStore;

    /** Parsed app configuration shared by runtime-launched workflows. */
    private readonly config: AppConfig;

    /** Effection app/session scopes that own cancellation and lifetimes. */
    private readonly scopes: AppEffectionScopes;

    /** Foreground and background task handles keyed by route request id. */
    private readonly activeTasks = new Map<string, Task<unknown>>();

    /** Session-scoped live inventory poller; halted on disconnect/reconnect. */
    private liveSyncTask: Task<void> | null = null;

    /** Optional storage override for tests; `undefined` means browser default. */
    private readonly storage: AppStateStorage | null | undefined;

    /** Controller AID selecting the current persisted app-state bucket. */
    private currentControllerAid: string | null = null;

    /** Store subscription cleanup for controller-scoped persistence writes. */
    private readonly uninstallPersistence: () => void;

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

        this.storage =
            options.storage === undefined ? undefined : options.storage;
        this.uninstallPersistence = installAppStatePersistence(
            this.store,
            () => this.currentControllerAid,
            this.storage
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
        this.store.dispatch(sessionDisconnected());
        this.setConnection(idleConnection);
        this.currentControllerAid = null;
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
        this.currentControllerAid = null;
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
            return clearAllPersistedAppStates(this.storage);
        } finally {
            this.currentControllerAid = previousControllerAid;
        }
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
     * Fetch one identifier by alias or prefix and merge richer state into Redux.
     */
    getIdentifier = async (
        aid: string,
        options: WorkflowRunOptions = {}
    ): Promise<IdentifierSummary> =>
        this.runWorkflow(() => getIdentifierOp(aid), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'listIdentifiers',
            track: options.track ?? false,
        });

    /**
     * Fetch an OOBI for one managed identifier role without recording an
     * operation-history item by default. Agent OOBIs still authorize the agent
     * endpoint role through the shared OOBI workflow when needed.
     */
    getIdentifierOobi = async (
        input: GenerateOobiInput,
        options: WorkflowRunOptions = {}
    ): Promise<GeneratedOobiRecord> =>
        this.runWorkflow(() => generateOobiOp(input), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'generateOobi',
            track: options.track ?? false,
        });

    /**
     * Fetch all requested OOBI roles for one managed identifier.
     */
    listIdentifierOobis = async (
        identifier: string,
        roles: readonly GenerateOobiInput['role'][],
        options: WorkflowRunOptions = {}
    ): Promise<GeneratedOobiRecord[]> => {
        const records: GeneratedOobiRecord[] = [];
        for (const role of roles) {
            records.push(
                await this.getIdentifierOobi(
                    { identifier, role },
                    {
                        ...options,
                        label: options.label,
                        track: options.track ?? false,
                    }
                )
            );
        }

        return records;
    };

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
     * Refresh live dashboard/contact facts without recording operation history.
     */
    syncSessionInventory = async (
        options: WorkflowRunOptions = {}
    ): Promise<SessionInventorySnapshot> =>
        this.runWorkflow(() => syncSessionInventoryOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

    /**
     * Refresh holder-side credential inventory without recording operation
     * history by default.
     */
    syncCredentialInventory = async (
        options: WorkflowRunOptions = {}
    ): Promise<unknown> =>
        this.runWorkflow(() => syncCredentialInventoryOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

    /**
     * Refresh issuer-side credential registry inventory without recording
     * operation history by default.
     */
    syncCredentialRegistries = async (
        options: WorkflowRunOptions = {}
    ): Promise<unknown> =>
        this.runWorkflow(() => syncCredentialRegistriesOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

    /**
     * Refresh credential-linked IPEX exchange activity without recording
     * operation history by default.
     */
    syncCredentialIpexActivity = async (
        options: WorkflowRunOptions = {}
    ): Promise<unknown> =>
        this.runWorkflow(() => syncCredentialIpexActivityOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

    /**
     * Detect app-supported schemas this connected agent already knows.
     */
    syncKnownCredentialSchemas = async (
        options: WorkflowRunOptions = {}
    ): Promise<unknown> =>
        this.runWorkflow(() => syncKnownCredentialSchemasOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

    /**
     * Launch identifier creation as background work with name-level conflicts.
     */
    startCreateIdentifier = (
        draft: IdentifierCreateDraft,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult => {
        const name = draft.name.trim();
        return this.startBackgroundWorkflow(() => createIdentifierOp(draft), {
            requestId: options.requestId,
            label: `Creating identifier ${name}`,
            title: `Create identifier ${name}`,
            description:
                'Creates a managed identifier and waits for KERIA completion.',
            kind: 'createIdentifier',
            resourceKeys: [`identifier:name:${name}`],
            resultRoute: { label: 'View identifiers', path: '/identifiers' },
            successNotification: {
                title: `Identifier ${name} created`,
                message: 'The identifier operation completed successfully.',
                severity: 'success',
            },
            failureNotification: {
                title: `Identifier ${name} failed`,
                message: 'The identifier operation failed.',
                severity: 'error',
            },
        });
    };

    /**
     * Launch identifier rotation as background work keyed by identifier AID.
     */
    startRotateIdentifier = (
        aid: string,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => rotateIdentifierOp(aid), {
            requestId: options.requestId,
            label: `Rotating identifier ${aid}`,
            title: `Rotate identifier ${aid}`,
            description:
                'Rotates a managed identifier and waits for KERIA completion.',
            kind: 'rotateIdentifier',
            resourceKeys: [`identifier:aid:${aid}`],
            resultRoute: { label: 'View identifiers', path: '/identifiers' },
            successNotification: {
                title: 'Identifier rotation complete',
                message: `The rotation for ${aid} completed successfully.`,
                severity: 'success',
            },
            failureNotification: {
                title: 'Identifier rotation failed',
                message: `The rotation for ${aid} failed.`,
                severity: 'error',
            },
        });

    /**
     * Launch OOBI generation/authorization without blocking navigation.
     */
    startGenerateOobi = (
        input: GenerateOobiInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult => {
        const identifier = input.identifier.trim();
        return this.startBackgroundWorkflow(
            () => generateOobiOp({ identifier, role: input.role }),
            {
                requestId: options.requestId,
                label: `Generating ${input.role} OOBI for ${identifier}`,
                title: `Generate ${input.role} OOBI`,
                description:
                    input.role === 'agent'
                        ? 'Authorizes the agent endpoint role if needed, then fetches an identifier OOBI.'
                        : 'Fetches witnessed identifier OOBIs from KERIA.',
                kind: 'generateOobi',
                resourceKeys: [`oobi:${identifier}:${input.role}`],
                resultRoute: { label: 'View contacts', path: '/contacts' },
                successNotification: {
                    title: 'OOBI generated',
                    message: `Generated a ${input.role} OOBI for ${identifier}.`,
                    severity: 'success',
                },
                failureNotification: {
                    title: 'OOBI generation failed',
                    message: `The ${input.role} OOBI generation for ${identifier} failed.`,
                    severity: 'error',
                },
            }
        );
    };

    /**
     * Launch contact OOBI resolution and protect both URL and alias resources.
     */
    startResolveContact = (
        input: ResolveContactInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult => {
        const oobi = input.oobi.trim();
        const alias = aliasForOobiResolution(oobi, input.alias);
        const resourceKeys = [`contact:oobi:${oobi}`];
        if (alias !== null) {
            resourceKeys.push(`contact:alias:${alias}`);
        }

        return this.startBackgroundWorkflow(
            () => resolveContactOobiOp({ oobi, alias }),
            {
                requestId: options.requestId,
                label:
                    alias === null
                        ? 'Resolving contact OOBI'
                        : `Resolving contact ${alias}`,
                title: 'Resolve contact OOBI',
                description:
                    'Submits an OOBI to KERIA and refreshes contact inventory after the operation completes.',
                kind: 'resolveContact',
                resourceKeys,
                resultRoute: { label: 'View contacts', path: '/contacts' },
                successNotification: {
                    title: 'Contact resolved',
                    message:
                        alias === null
                            ? 'The contact OOBI resolved successfully.'
                            : `${alias} resolved successfully.`,
                    severity: 'success',
                },
                failureNotification: {
                    title: 'Contact resolution failed',
                    message: 'The OOBI resolution failed.',
                    severity: 'error',
                },
            }
        );
    };

    /**
     * Launch KERIA contact deletion and refresh inventory on completion.
     */
    startDeleteContact = (
        contactId: string,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => deleteContactOp(contactId), {
            requestId: options.requestId,
            label: `Deleting contact ${contactId}`,
            title: 'Delete contact',
            description: 'Deletes a KERIA contact and refreshes inventory.',
            kind: 'deleteContact',
            resourceKeys: [`contact:${contactId}`],
            resultRoute: { label: 'View contacts', path: '/contacts' },
            successNotification: {
                title: 'Contact deleted',
                message: `${contactId} was deleted.`,
                severity: 'success',
            },
            failureNotification: {
                title: 'Contact deletion failed',
                message: `${contactId} could not be deleted.`,
                severity: 'error',
            },
        });

    /**
     * Launch local contact metadata update for the selected KERIA contact.
     */
    startUpdateContactAlias = (
        input: UpdateContactAliasInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => updateContactAliasOp(input), {
            requestId: options.requestId,
            label: `Updating contact ${input.contactId}`,
            title: 'Update contact alias',
            description: 'Updates local KERIA contact metadata.',
            kind: 'updateContact',
            resourceKeys: [`contact:${input.contactId}`],
            resultRoute: { label: 'View contacts', path: '/contacts' },
            successNotification: {
                title: 'Contact updated',
                message: `${input.contactId} was updated.`,
                severity: 'success',
            },
            failureNotification: {
                title: 'Contact update failed',
                message: `${input.contactId} could not be updated.`,
                severity: 'error',
            },
        });

    /**
     * Generate challenge words in the foreground so the route can display them.
     */
    generateContactChallenge = async (
        input: GenerateContactChallengeInput,
        options: Pick<WorkflowRunOptions, 'requestId' | 'signal'> = {}
    ): Promise<GeneratedContactChallengeResult> =>
        this.runWorkflow(() => generateContactChallengeOp(input), {
            ...options,
            kind: 'generateChallenge',
            track: false,
        });

    /**
     * Launch responder-side signed challenge response delivery.
     */
    startRespondToChallenge = (
        input: RespondToContactChallengeInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => respondToContactChallengeOp(input), {
            requestId: options.requestId,
            label: `Sending challenge response to ${input.counterpartyAid}`,
            title: 'Send challenge response',
            description:
                'Signs the challenge words with the selected identifier and sends the response to the contact.',
            kind: 'respondChallenge',
            resourceKeys: [
                `challenge:respond:${input.counterpartyAid}:${input.localIdentifier}:${input.challengeId ?? 'current'}`,
            ],
            resultRoute: challengeResultRoute(input.counterpartyAid),
            successNotification: {
                title: 'Challenge response sent',
                message: 'The signed challenge response was sent.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Challenge response failed',
                message: 'The challenge response could not be sent.',
                severity: 'error',
            },
        });

    /**
     * Launch challenger-side notification that asks a contact to respond.
     */
    startSendChallengeRequest = (
        input: SendChallengeRequestInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => sendChallengeRequestOp(input), {
            requestId: options.requestId,
            label: `Sending challenge request to ${input.counterpartyAid}`,
            title: 'Send challenge request',
            description:
                'Sends a challenge request notification without embedding the challenge words.',
            kind: 'sendChallengeRequest',
            resourceKeys: [
                `challenge:request:${input.counterpartyAid}:${input.localIdentifier}:${input.challengeId}`,
            ],
            resultRoute: challengeResultRoute(input.counterpartyAid),
            successNotification: {
                title: 'Challenge request sent',
                message:
                    'The contact was notified that a challenge response is requested.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Challenge request failed',
                message:
                    'The challenge words remain available, but the notification could not be sent.',
                severity: 'error',
            },
        });

    /**
     * Launch challenger-side wait/verify/responded acceptance workflow.
     */
    startVerifyContactChallenge = (
        input: VerifyContactChallengeInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => verifyContactChallengeOp(input), {
            requestId: options.requestId,
            label: `Waiting for challenge response from ${input.counterpartyAid}`,
            title: 'Verify challenge response',
            description:
                'Waits for a matching challenge response, accepts the response SAID, and refreshes contact inventory.',
            kind: 'verifyChallenge',
            resourceKeys: [
                `challenge:verify:${input.counterpartyAid}:${input.challengeId}`,
            ],
            resultRoute: challengeResultRoute(input.counterpartyAid),
            successNotification: {
                title: 'Challenge verified',
                message: 'The contact challenge response was accepted.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Challenge verification failed',
                message: 'The challenge response was not verified.',
                severity: 'error',
            },
        });

    /**
     * Tombstone a handled exchange notification without blocking the route.
     */
    dismissExchangeNotification = async (
        input: DismissExchangeNotificationInput,
        options: Pick<WorkflowRunOptions, 'requestId' | 'signal'> = {}
    ): Promise<void> =>
        this.runWorkflow(() => dismissExchangeNotificationOp(input), {
            ...options,
            kind: 'workflow',
            track: false,
        });

    /**
     * Launch SEDI schema OOBI resolution as background work.
     */
    startResolveCredentialSchema = (
        input: ResolveCredentialSchemaInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => resolveCredentialSchemaOp(input), {
            requestId: options.requestId,
            label: 'Adding SEDI credential type',
            title: 'Add credential type',
            description:
                'Adds the SEDI schema OOBI to this KERIA agent and records schema metadata.',
            kind: 'resolveSchema',
            resourceKeys: [`schema:${input.schemaSaid}`],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential type added',
                message: 'The SEDI credential type is available to this wallet.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential type add failed',
                message: 'The SEDI credential type could not be added.',
                severity: 'error',
            },
        });

    /**
     * Launch issuer registry creation or reuse as background work.
     */
    startCreateCredentialRegistry = (
        input: CreateCredentialRegistryInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => createCredentialRegistryOp(input), {
            requestId: options.requestId,
            label: `Creating registry for ${input.issuerAlias}`,
            title: 'Create credential registry',
            description:
                'Creates or reuses the issuer credential registry for SEDI voter credentials.',
            kind: 'createRegistry',
            resourceKeys: [`registry:${input.issuerAid}`],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential registry ready',
                message: 'The issuer credential registry is ready.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential registry failed',
                message: 'The issuer credential registry could not be prepared.',
                severity: 'error',
            },
        });

    /**
     * Launch issuer-side SEDI credential issuance as background work.
     */
    startIssueCredential = (
        input: IssueSediCredentialInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => issueSediCredentialOp(input), {
            requestId: options.requestId,
            label: `Issuing credential to ${input.holderAid}`,
            title: 'Issue SEDI voter credential',
            description:
                'Creates the ACDC in the issuer registry and waits for KERIA completion.',
            kind: 'issueCredential',
            resourceKeys: [
                `credential:issue:${input.issuerAid}:${input.holderAid}:${input.attributes.voterId}`,
            ],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential issued',
                message: 'The SEDI voter credential was issued.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential issuance failed',
                message: 'The SEDI voter credential could not be issued.',
                severity: 'error',
            },
        });

    /**
     * Launch issuer-side IPEX grant delivery as background work.
     */
    startGrantCredential = (
        input: GrantCredentialInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => grantCredentialOp(input), {
            requestId: options.requestId,
            label: `Granting credential ${input.credentialSaid}`,
            title: 'Grant credential',
            description:
                'Sends an IPEX grant to the holder and waits for KERIA completion.',
            kind: 'grantCredential',
            resourceKeys: [`credential:${input.credentialSaid}:grant`],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential grant sent',
                message: 'The credential grant was sent to the holder.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential grant failed',
                message: 'The credential grant could not be sent.',
                severity: 'error',
            },
        });

    /**
     * Launch holder-side IPEX grant admission as background work.
     */
    startAdmitCredentialGrant = (
        input: AdmitCredentialGrantInput,
        options: Pick<WorkflowRunOptions, 'requestId'> = {}
    ): BackgroundWorkflowStartResult =>
        this.startBackgroundWorkflow(() => admitCredentialGrantOp(input), {
            requestId: options.requestId,
            label: `Admitting credential grant ${input.grantSaid}`,
            title: 'Admit credential grant',
            description:
                'Accepts the issuer IPEX grant and refreshes holder credential inventory.',
            kind: 'admitCredential',
            resourceKeys: [`grant:${input.grantSaid}:admit`],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential admitted',
                message: 'The credential is now available in this wallet.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential admit failed',
                message: 'The credential grant could not be admitted.',
                severity: 'error',
            },
        });

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
        options: BackgroundWorkflowRunOptions
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
        options: BackgroundWorkflowRunOptions
    ): Promise<void> => {
        try {
            const result = await task;
            const payloadDetails = payloadDetailsFromWorkflowResult(result);
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
    private recordCompletionNotification = (
        requestId: string,
        options: BackgroundWorkflowRunOptions,
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
        this.store.dispatch(sessionDisconnected());
        this.setConnection(idleConnection);
        this.currentControllerAid = null;
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

        const task = this.scopes.run(() => liveSessionInventoryOp(), 'session');
        this.liveSyncTask = task;

        void (async () => {
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
        })();
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
        if (controllerAid !== null) {
            rehydratePersistedAppState(this.store, controllerAid, this.storage);
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
