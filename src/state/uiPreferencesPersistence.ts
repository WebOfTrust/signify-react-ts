import {
    defaultUiPreferencesState,
    type UiPreferencesState,
} from './uiPreferences.slice';
import type { AppStateStorage } from './persistence';

const UI_PREFERENCES_VERSION = 1;

/**
 * Global UI-preference storage bucket, intentionally not controller-scoped.
 */
export const UI_PREFERENCES_STORAGE_KEY =
    'signify-react-ts:ui-preferences:v1';

/**
 * Versioned UI preferences persisted outside Signify controller state.
 */
export interface PersistedUiPreferences {
    version: typeof UI_PREFERENCES_VERSION;
    hoverSoundMuted: boolean;
}

interface UiPreferencesStore {
    getState: () => { uiPreferences: UiPreferencesState };
    subscribe: (listener: () => void) => () => void;
}

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const defaultUiPreferences = (): UiPreferencesState => ({
    ...defaultUiPreferencesState,
});

/**
 * Project Redux UI preferences into the persisted JSON shape.
 */
export const persistedUiPreferencesFromState = (
    state: UiPreferencesState
): PersistedUiPreferences => ({
    version: UI_PREFERENCES_VERSION,
    hoverSoundMuted: state.hoverSoundMuted,
});

/**
 * Load global UI preferences, falling back safely on absent or invalid data.
 */
export const loadPersistedUiPreferences = (
    storage: AppStateStorage | null = browserStorage()
): UiPreferencesState => {
    if (storage === null) {
        return defaultUiPreferences();
    }

    const text = storage.getItem(UI_PREFERENCES_STORAGE_KEY);
    if (text === null) {
        return defaultUiPreferences();
    }

    try {
        const parsed: unknown = JSON.parse(text);
        if (
            !isRecord(parsed) ||
            parsed.version !== UI_PREFERENCES_VERSION ||
            typeof parsed.hoverSoundMuted !== 'boolean'
        ) {
            return defaultUiPreferences();
        }

        return {
            hoverSoundMuted: parsed.hoverSoundMuted,
        };
    } catch {
        return defaultUiPreferences();
    }
};

/**
 * Save global UI preferences without touching controller-scoped app history.
 */
export const savePersistedUiPreferences = (
    state: UiPreferencesState,
    storage: AppStateStorage | null = browserStorage()
): void => {
    if (storage === null) {
        return;
    }

    storage.setItem(
        UI_PREFERENCES_STORAGE_KEY,
        JSON.stringify(persistedUiPreferencesFromState(state))
    );
};

/**
 * Subscribe to preference changes and avoid duplicate localStorage writes.
 */
export const installUiPreferencesPersistence = (
    store: UiPreferencesStore,
    storage: AppStateStorage | null = browserStorage()
): (() => void) => {
    if (storage === null) {
        return () => undefined;
    }

    let previous = JSON.stringify(
        persistedUiPreferencesFromState(store.getState().uiPreferences)
    );

    return store.subscribe(() => {
        const current = JSON.stringify(
            persistedUiPreferencesFromState(store.getState().uiPreferences)
        );
        if (current === previous) {
            return;
        }

        previous = current;
        savePersistedUiPreferences(store.getState().uiPreferences, storage);
    });
};
