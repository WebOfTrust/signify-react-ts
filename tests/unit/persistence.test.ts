import { describe, expect, it } from 'vitest';
import {
    clearAllPersistedAppStates,
    installAppStatePersistence,
    loadPersistedAppState,
    persistedAppStateKey,
    rehydratePersistedAppState,
    savePersistedAppState,
    type AppStateStorage,
} from '../../src/state/persistence';
import { createAppStore } from '../../src/state/store';
import { storedChallengeWordsRecorded } from '../../src/state/challenges.slice';
import { exchangeTombstoneRecorded } from '../../src/state/exchangeTombstones.slice';
import { operationStarted } from '../../src/state/operations.slice';

class MemoryStorage implements AppStateStorage {
    private readonly values = new Map<string, string>();

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
    }

    removeItem(key: string): void {
        this.values.delete(key);
    }

    key(index: number): string | null {
        return Array.from(this.values.keys())[index] ?? null;
    }

    get length(): number {
        return this.values.size;
    }
}

describe('app state persistence', () => {
    it('saves and loads operation history', () => {
        const store = createAppStore();
        const storage = new MemoryStorage();

        store.dispatch(
            operationStarted({
                requestId: 'op-1',
                label: 'Creating identifier...',
                title: 'Create identifier',
                kind: 'createIdentifier',
                resourceKeys: ['identifier:name:alice'],
                startedAt: '2026-04-21T00:00:00.000Z',
            })
        );
        savePersistedAppState(store.getState(), 'Econtroller1', storage);

        expect(
            loadPersistedAppState('Econtroller1', storage)?.operations
        ).toHaveLength(1);
        expect(loadPersistedAppState('Econtroller2', storage)).toBeNull();
    });

    it('rehydrates running operations as interrupted', () => {
        const source = createAppStore();
        const target = createAppStore();
        const storage = new MemoryStorage();

        source.dispatch(
            operationStarted({
                requestId: 'op-running',
                label: 'Working...',
                title: 'Working operation',
                kind: 'resolveContact',
                resourceKeys: ['contact:alice'],
                startedAt: '2026-04-21T00:00:00.000Z',
            })
        );
        savePersistedAppState(source.getState(), 'Econtroller1', storage);
        rehydratePersistedAppState(target, 'Econtroller1', storage);

        expect(target.getState().operations.byId['op-running']).toMatchObject({
            status: 'interrupted',
        });
    });

    it('clears operation state when a controller has no persisted bucket', () => {
        const target = createAppStore();
        const storage = new MemoryStorage();

        target.dispatch(
            operationStarted({
                requestId: 'op-existing',
                label: 'Existing...',
                title: 'Existing operation',
                kind: 'resolveContact',
                resourceKeys: ['contact:alice'],
                startedAt: '2026-04-21T00:00:00.000Z',
            })
        );
        rehydratePersistedAppState(
            target,
            'Econtroller-without-state',
            storage
        );

        expect(target.getState().operations.order).toHaveLength(0);
    });

    it('persists subscribed store writes under the active controller key', () => {
        const store = createAppStore();
        const storage = new MemoryStorage();
        let controllerAid: string | null = 'Econtroller1';
        const uninstall = installAppStatePersistence(
            store,
            () => controllerAid,
            storage
        );

        store.dispatch(
            operationStarted({
                requestId: 'op-controller-1',
                label: 'Controller one...',
                title: 'Controller one operation',
                kind: 'resolveContact',
                resourceKeys: ['contact:alice'],
                startedAt: '2026-04-21T00:00:00.000Z',
            })
        );
        controllerAid = null;
        store.dispatch(
            operationStarted({
                requestId: 'op-unscoped',
                label: 'Unscoped...',
                title: 'Unscoped operation',
                kind: 'resolveContact',
                resourceKeys: ['contact:bob'],
                startedAt: '2026-04-21T00:00:01.000Z',
            })
        );
        uninstall();

        expect(
            loadPersistedAppState('Econtroller1', storage)?.operations.map(
                (operation) => operation.requestId
            )
        ).toEqual(['op-controller-1']);
        expect(loadPersistedAppState('Econtroller2', storage)).toBeNull();
    });

    it('ignores invalid persisted data', () => {
        const storage = new MemoryStorage();
        storage.setItem(persistedAppStateKey('Econtroller1'), '{not-json');

        expect(loadPersistedAppState('Econtroller1', storage)).toBeNull();
    });

    it('accepts older persisted buckets without EXN tombstones or stored challenge words', () => {
        const storage = new MemoryStorage();
        storage.setItem(
            persistedAppStateKey('Econtroller1'),
            JSON.stringify({
                version: 1,
                operations: [],
                appNotifications: [],
            })
        );

        expect(loadPersistedAppState('Econtroller1', storage)).toMatchObject({
            exchangeTombstones: [],
            storedChallengeWords: [],
        });
    });

    it('persists and rehydrates EXN tombstones and stored challenge words', () => {
        const source = createAppStore();
        const target = createAppStore();
        const storage = new MemoryStorage();

        source.dispatch(
            exchangeTombstoneRecorded({
                exnSaid: 'Eexn',
                route: '/challenge/request',
                notificationId: 'challenge-request:Eexn',
                reason: 'userDismissed',
                createdAt: '2026-04-21T00:00:00.000Z',
            })
        );
        source.dispatch(
            storedChallengeWordsRecorded({
                challengeId: 'challenge-1',
                counterpartyAid: 'Econtact',
                counterpartyAlias: 'Wan',
                localIdentifier: 'alice',
                localAid: 'Ealice',
                words: Array.from({ length: 12 }, (_, index) => `word${index}`),
                wordsHash: 'hash-one',
                strength: 128,
                generatedAt: '2026-04-21T00:00:01.000Z',
                updatedAt: '2026-04-21T00:00:01.000Z',
                status: 'pending',
            })
        );

        savePersistedAppState(source.getState(), 'Econtroller1', storage);

        expect(loadPersistedAppState('Econtroller1', storage)).toMatchObject({
            exchangeTombstones: [
                expect.objectContaining({
                    exnSaid: 'Eexn',
                    reason: 'userDismissed',
                }),
            ],
            storedChallengeWords: [
                expect.objectContaining({
                    challengeId: 'challenge-1',
                    wordsHash: 'hash-one',
                    status: 'pending',
                }),
            ],
        });

        rehydratePersistedAppState(target, 'Econtroller1', storage);

        expect(target.getState().exchangeTombstones.bySaid.Eexn).toMatchObject({
            route: '/challenge/request',
        });
        expect(
            target.getState().challenges.storedWordsById['challenge-1']
        ).toMatchObject({
            counterpartyAid: 'Econtact',
            status: 'pending',
        });
    });

    it('clears all controller-scoped persisted buckets without touching other storage', () => {
        const storage = new MemoryStorage();
        storage.setItem(persistedAppStateKey('Econtroller1'), '{"version":1}');
        storage.setItem(persistedAppStateKey('Econtroller2'), '{"version":1}');
        storage.setItem('unrelated-key', 'keep');

        expect(clearAllPersistedAppStates(storage)).toBe(2);
        expect(
            storage.getItem(persistedAppStateKey('Econtroller1'))
        ).toBeNull();
        expect(
            storage.getItem(persistedAppStateKey('Econtroller2'))
        ).toBeNull();
        expect(storage.getItem('unrelated-key')).toBe('keep');
    });
});
