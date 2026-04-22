import { appNotificationsRehydrated } from './appNotifications.slice';
import { operationsRehydrated } from './operations.slice';
import type { AppNotificationRecord } from './appNotifications.slice';
import type { OperationRecord } from './operations.slice';
import type { AppStore, RootState } from './store';

const PERSISTENCE_VERSION = 1;
const PERSISTENCE_KEY_PREFIX = 'signify-react-ts:app-state:v1';

/**
 * Minimal storage contract so tests can inject memory storage and production
 * can use browser localStorage.
 */
export interface AppStateStorage {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

/**
 * Supplies the currently connected controller AID for controller-scoped saves.
 */
export type ControllerAidProvider = () => string | null;

/**
 * Versioned, serializable state persisted per controller AID.
 */
export interface PersistedAppState {
    version: typeof PERSISTENCE_VERSION;
    operations: OperationRecord[];
    appNotifications: AppNotificationRecord[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const hasString = (record: Record<string, unknown>, key: string): boolean =>
    typeof record[key] === 'string';

const isOperationRecord = (value: unknown): value is OperationRecord => {
    if (!isRecord(value)) {
        return false;
    }

    return (
        hasString(value, 'requestId') &&
        hasString(value, 'label') &&
        hasString(value, 'title') &&
        hasString(value, 'kind') &&
        hasString(value, 'status') &&
        hasString(value, 'phase') &&
        hasString(value, 'operationRoute') &&
        hasString(value, 'startedAt') &&
        Array.isArray(value.resourceKeys)
    );
};

const isAppNotificationRecord = (
    value: unknown
): value is AppNotificationRecord => {
    if (!isRecord(value)) {
        return false;
    }

    return (
        hasString(value, 'id') &&
        hasString(value, 'severity') &&
        hasString(value, 'status') &&
        hasString(value, 'title') &&
        hasString(value, 'message') &&
        hasString(value, 'createdAt') &&
        Array.isArray(value.links)
    );
};

const browserStorage = (): AppStateStorage | null => {
    try {
        const storage = globalThis.localStorage;
        return storage !== undefined &&
            typeof storage.getItem === 'function' &&
            typeof storage.setItem === 'function'
            ? storage
            : null;
    } catch {
        return null;
    }
};

/**
 * Build the controller-scoped storage key.
 *
 * The controller AID is part of the key because one browser can authenticate
 * multiple Signify controllers and their histories must not mix.
 */
export const persistedAppStateKey = (controllerAid: string): string =>
    `${PERSISTENCE_KEY_PREFIX}:${controllerAid}`;

/**
 * Load one controller's persisted app state, filtering malformed records.
 */
export const loadPersistedAppState = (
    controllerAid: string,
    storage: AppStateStorage | null = browserStorage()
): PersistedAppState | null => {
    if (storage === null) {
        return null;
    }

    const text = storage.getItem(persistedAppStateKey(controllerAid));
    if (text === null) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(text);
        if (!isRecord(parsed) || parsed.version !== PERSISTENCE_VERSION) {
            return null;
        }

        const operations = Array.isArray(parsed.operations)
            ? parsed.operations.filter(isOperationRecord)
            : [];
        const appNotifications = Array.isArray(parsed.appNotifications)
            ? parsed.appNotifications.filter(isAppNotificationRecord)
            : [];

        return {
            version: PERSISTENCE_VERSION,
            operations,
            appNotifications,
        };
    } catch {
        return null;
    }
};

/**
 * Project Redux state into the bounded, serializable persistence shape.
 */
export const persistedAppStateFromRoot = (
    state: RootState
): PersistedAppState => ({
    version: PERSISTENCE_VERSION,
    operations: state.operations.order
        .map((requestId) => state.operations.byId[requestId])
        .filter((record): record is OperationRecord => record !== undefined),
    appNotifications: state.appNotifications.ids
        .map((id) => state.appNotifications.byId[id])
        .filter(
            (record): record is AppNotificationRecord => record !== undefined
        ),
});

/**
 * Save the current operation and app-notification facts for one controller.
 */
export const savePersistedAppState = (
    state: RootState,
    controllerAid: string,
    storage: AppStateStorage | null = browserStorage()
): void => {
    if (storage === null) {
        return;
    }

    storage.setItem(
        persistedAppStateKey(controllerAid),
        JSON.stringify(persistedAppStateFromRoot(state))
    );
};

/**
 * Rehydrate one controller's persisted state.
 *
 * Running operations become interrupted because the browser-side Effection
 * watcher cannot survive refresh or tab close in this phase.
 */
export const rehydratePersistedAppState = (
    store: AppStore,
    controllerAid: string,
    storage: AppStateStorage | null = browserStorage()
): void => {
    const persisted = loadPersistedAppState(controllerAid, storage);
    const interruptedAt = new Date().toISOString();
    store.dispatch(
        operationsRehydrated({
            records: persisted?.operations ?? [],
            interruptedAt,
        })
    );
    store.dispatch(
        appNotificationsRehydrated({
            records: persisted?.appNotifications ?? [],
        })
    );
};

/**
 * Subscribe to store writes and eagerly persist under the active controller.
 */
export const installAppStatePersistence = (
    store: AppStore,
    controllerAid: ControllerAidProvider,
    storage: AppStateStorage | null = browserStorage()
): (() => void) => {
    if (storage === null) {
        return () => undefined;
    }

    return store.subscribe(() => {
        const currentControllerAid = controllerAid();
        if (currentControllerAid !== null) {
            savePersistedAppState(
                store.getState(),
                currentControllerAid,
                storage
            );
        }
    });
};

/**
 * Flush the latest state before disconnect, runtime destroy, pagehide, or HMR.
 */
export const flushPersistedAppState = (
    store: AppStore,
    controllerAid: string | null,
    storage: AppStateStorage | null = browserStorage()
): void => {
    if (controllerAid !== null) {
        savePersistedAppState(store.getState(), controllerAid, storage);
    }
};
