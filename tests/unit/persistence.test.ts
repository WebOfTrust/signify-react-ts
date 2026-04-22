import { describe, expect, it } from 'vitest';
import {
    installAppStatePersistence,
    loadPersistedAppState,
    persistedAppStateKey,
    rehydratePersistedAppState,
    savePersistedAppState,
    type AppStateStorage,
} from '../../src/state/persistence';
import { createAppStore } from '../../src/state/store';
import { operationStarted } from '../../src/state/operations.slice';

class MemoryStorage implements AppStateStorage {
    private readonly values = new Map<string, string>();

    getItem(key: string): string | null {
        return this.values.get(key) ?? null;
    }

    setItem(key: string, value: string): void {
        this.values.set(key, value);
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
        rehydratePersistedAppState(target, 'Econtroller-without-state', storage);

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
});
