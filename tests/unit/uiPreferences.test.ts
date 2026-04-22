import { describe, expect, it } from 'vitest';
import {
    hoverSoundMutedSet,
    hoverSoundMutedToggled,
} from '../../src/state/uiPreferences.slice';
import {
    installUiPreferencesPersistence,
    loadPersistedUiPreferences,
    savePersistedUiPreferences,
    UI_PREFERENCES_STORAGE_KEY,
    type PersistedUiPreferences,
} from '../../src/state/uiPreferencesPersistence';
import { createAppStore } from '../../src/state/store';
import { selectHoverSoundMuted } from '../../src/state/selectors';
import type { AppStateStorage } from '../../src/state/persistence';

/**
 * Minimal storage fake for global UI-preference persistence.
 */
class MemoryStorage implements AppStateStorage {
    private readonly values = new Map<string, string>();

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }
}

/**
 * Decode the persisted preference bucket for assertions.
 */
const persisted = (storage: MemoryStorage): PersistedUiPreferences | null => {
    const text = storage.getItem(UI_PREFERENCES_STORAGE_KEY);
    return text === null ? null : (JSON.parse(text) as PersistedUiPreferences);
};

describe('UI preferences state', () => {
    it('defaults hover sound to enabled and toggles mute state', () => {
        const store = createAppStore();

        expect(selectHoverSoundMuted(store.getState())).toBe(false);

        store.dispatch(hoverSoundMutedToggled());
        expect(selectHoverSoundMuted(store.getState())).toBe(true);

        store.dispatch(hoverSoundMutedSet(false));
        expect(selectHoverSoundMuted(store.getState())).toBe(false);
    });

    it('loads and saves global UI preferences', () => {
        const storage = new MemoryStorage();

        savePersistedUiPreferences({ hoverSoundMuted: true }, storage);

        expect(loadPersistedUiPreferences(storage)).toEqual({
            hoverSoundMuted: true,
        });
    });

    it('falls back to defaults for malformed persisted preferences', () => {
        const storage = new MemoryStorage();

        storage.setItem(UI_PREFERENCES_STORAGE_KEY, '{not-json');
        expect(loadPersistedUiPreferences(storage)).toEqual({
            hoverSoundMuted: false,
        });

        storage.setItem(
            UI_PREFERENCES_STORAGE_KEY,
            JSON.stringify({ version: 1, hoverSoundMuted: 'yes' })
        );
        expect(loadPersistedUiPreferences(storage)).toEqual({
            hoverSoundMuted: false,
        });
    });

    it('persists only when the UI preference changes', () => {
        const store = createAppStore();
        const storage = new MemoryStorage();
        const uninstall = installUiPreferencesPersistence(store, storage);

        expect(persisted(storage)).toBeNull();

        store.dispatch(hoverSoundMutedSet(true));
        expect(persisted(storage)).toMatchObject({
            hoverSoundMuted: true,
        });

        uninstall();
    });
});
