import type { SignifyClient } from 'signify-ts';
import type {
    DynamicIdentifierField,
    IdentifierSummary,
} from '../features/identifiers/identifierTypes';
import {
    identifiersFromResponse,
    parseIdentifierCreateArgs,
} from '../features/identifiers/identifierHelpers';
import {
    connectSignifyClient,
    getSignifyState,
    toError,
    waitOperation,
    type ConnectedSignifyClient,
    type SignifyClientConfig,
    type SignifyStateSummary,
} from '../signify/client';

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
 * Data-router-safe Signify session and command boundary.
 *
 * React Router loaders and actions cannot call React hooks, so all KERIA-backed
 * work that a route may perform goes through this runtime. React components
 * subscribe to the same runtime through `AppRuntimeProvider`, which keeps route
 * actions, route loaders, and visible shell state on one source of truth.
 */
export class AppRuntime {
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
        config: SignifyClientConfig
    ): Promise<ConnectedSignifyClient | null> => {
        this.setConnection({
            status: 'connecting',
            client: null,
            state: null,
            error: null,
            booted: false,
        });

        try {
            const connected = await connectSignifyClient(config);
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
        this.setConnection(idleConnection);
    };

    /**
     * Refresh normalized KERIA agent/controller state for the connected client.
     */
    refreshState = async (): Promise<SignifyStateSummary | null> => {
        const connection = this.snapshot.connection;
        if (connection.status !== 'connected') {
            return null;
        }

        const state = await getSignifyState(connection.client);
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
    listIdentifiers = async (): Promise<IdentifierSummary[]> => {
        const client = this.requireClient();
        return identifiersFromResponse(await client.identifiers().list());
    };

    /**
     * Create an identifier, wait for the resulting KERIA operation, then return
     * a freshly loaded identifier list for router revalidation callers.
     */
    createIdentifier = async (
        name: string,
        algo: string,
        fields: readonly DynamicIdentifierField[]
    ): Promise<IdentifierSummary[]> => {
        const client = this.requireClient();
        const args = parseIdentifierCreateArgs(algo, fields);
        const identifierClient = client.identifiers();
        const result = await identifierClient.create(
            name,
            args as Parameters<typeof identifierClient.create>[1]
        );
        const operation = await result.op();

        await waitOperation(client, operation, {
            label: `creating identifier ${name}`,
        });

        return this.listIdentifiers();
    };

    /**
     * Rotate an identifier, wait for completion, then return a freshly loaded
     * identifier list for router revalidation callers.
     */
    rotateIdentifier = async (aid: string): Promise<IdentifierSummary[]> => {
        const client = this.requireClient();
        const result = await client.identifiers().rotate(aid, {});
        const operation = await result.op();

        await waitOperation(client, operation, {
            label: `rotating identifier ${aid}`,
        });

        return this.listIdentifiers();
    };

    /**
     * Return the connected client or fail with a standard app-runtime error.
     *
     * Command methods call this after route actions have already checked
     * connection state. Keeping the guard here prevents future callers from
     * bypassing route-level gating and silently operating on `null`.
     */
    private requireClient = (): SignifyClient => {
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
export const createAppRuntime = (): AppRuntime => new AppRuntime();
