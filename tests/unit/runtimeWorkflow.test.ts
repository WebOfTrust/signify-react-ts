import { sleep } from 'effection';
import { describe, expect, it, vi } from 'vitest';
import type { SignifyClient } from 'signify-ts';
import { createAppRuntime, type AppRuntime } from '../../src/app/runtime';
import type { IdentifierSummary } from '../../src/features/identifiers/identifierTypes';
import { appNotificationRecorded } from '../../src/state/appNotifications.slice';
import { storedChallengeWordsRecorded } from '../../src/state/challenges.slice';
import { contactResolved } from '../../src/state/contacts.slice';
import { exchangeTombstoneRecorded } from '../../src/state/exchangeTombstones.slice';
import { identifierListLoaded } from '../../src/state/identifiers.slice';
import { operationStarted } from '../../src/state/operations.slice';
import {
    persistedAppStateKey,
    type AppStateStorage,
} from '../../src/state/persistence';
import { selectActiveOperations } from '../../src/state/selectors';
import { createAppStore } from '../../src/state/store';

/**
 * Minimal storage fake used to exercise controller-scoped persistence.
 */
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

/**
 * Put the runtime into a connected state without booting a real browser client.
 */
const connectRuntimeForTest = (
    runtime: AppRuntime,
    client: SignifyClient
): void => {
    (
        runtime as unknown as {
            snapshot: unknown;
        }
    ).snapshot = {
        connection: {
            status: 'connected',
            client,
            state: {
                controllerPre: 'Econtroller',
                agentPre: 'Eagent',
                ridx: 0,
                pidx: 0,
                state: {},
            },
            error: null,
            booted: true,
        },
    };
};

/**
 * Build the narrow Signify client fake needed by runtime workflow tests.
 */
const makeWorkflowClient = ({
    rawNotifications = { notes: [] },
    queryExchanges = [],
}: {
    rawNotifications?: unknown;
    queryExchanges?: unknown[];
} = {}) => {
    const notifications = {
        list: vi.fn(async () => rawNotifications),
        mark: vi.fn(async () => ''),
        delete: vi.fn(async () => undefined),
    };
    const contacts = {
        list: vi.fn(async () => []),
    };
    const client = {
        contacts: () => contacts,
        notifications: () => notifications,
        exchanges: () => ({
            get: vi.fn(),
        }),
        fetch: vi.fn(async () => ({
            json: async () => queryExchanges,
        })),
    } as unknown as SignifyClient;

    return { client, notifications, contacts };
};

describe('AppRuntime workflow bridge', () => {
    it('records successful Effection workflow completion', async () => {
        const store = createAppStore();
        const runtime = createAppRuntime({ store, storage: null });

        await expect(
            runtime.runWorkflow(
                function* () {
                    yield* sleep(0);
                    return 'done';
                },
                {
                    requestId: 'workflow-success',
                    label: 'Test workflow...',
                    kind: 'test',
                    scope: 'app',
                }
            )
        ).resolves.toBe('done');

        expect(
            store.getState().operations.byId['workflow-success']
        ).toMatchObject({
            status: 'success',
            label: 'Test workflow...',
        });

        await runtime.destroy();
    });

    it('halts an Effection workflow when the route signal aborts', async () => {
        const store = createAppStore();
        const runtime = createAppRuntime({ store, storage: null });
        const controller = new AbortController();

        const promise = runtime.runWorkflow(
            function* () {
                yield* sleep(10_000);
                return 'done';
            },
            {
                requestId: 'workflow-canceled',
                label: 'Long workflow...',
                kind: 'test',
                scope: 'app',
                signal: controller.signal,
            }
        );

        controller.abort();
        await expect(promise).rejects.toThrow();

        expect(
            store.getState().operations.byId['workflow-canceled']
        ).toMatchObject({
            status: 'canceled',
        });
        expect(selectActiveOperations(store.getState())).toHaveLength(0);

        await runtime.destroy();
    });

    it('starts background workflows without awaiting completion', async () => {
        const store = createAppStore();
        const runtime = createAppRuntime({ store, storage: null });

        const started = runtime.startBackgroundWorkflow(
            function* () {
                yield* sleep(0);
                return 'done';
            },
            {
                requestId: 'background-success',
                label: 'Background workflow...',
                title: 'Background workflow',
                kind: 'resolveContact',
                resourceKeys: ['contact:alice'],
                resultRoute: { label: 'Contacts', path: '/credentials' },
                successNotification: {
                    title: 'Background workflow complete',
                    message: 'The background workflow completed.',
                },
            }
        );

        expect(started).toEqual({
            status: 'accepted',
            requestId: 'background-success',
            operationRoute: '/operations/background-success',
        });
        expect(
            store.getState().operations.byId['background-success']
        ).toMatchObject({
            status: 'running',
            resourceKeys: ['contact:alice'],
        });

        await vi.waitFor(() => {
            expect(
                store.getState().operations.byId['background-success']
            ).toMatchObject({
                status: 'success',
                notificationId: expect.any(String),
            });
        });
        expect(store.getState().appNotifications.ids).toHaveLength(1);

        await runtime.destroy();
    });

    it('clears persisted local buckets and current persisted projections', async () => {
        const store = createAppStore();
        const storage = new MemoryStorage();
        const runtime = createAppRuntime({ store, storage });

        storage.setItem(
            persistedAppStateKey('Econtroller1'),
            '{"version":1,"operations":[],"appNotifications":[]}'
        );
        storage.setItem(
            persistedAppStateKey('Econtroller2'),
            '{"version":1,"operations":[],"appNotifications":[]}'
        );
        store.dispatch(
            operationStarted({
                requestId: 'op-1',
                label: 'Working...',
                title: 'Working operation',
                kind: 'resolveContact',
                resourceKeys: ['contact:alice'],
                startedAt: '2026-04-21T00:00:00.000Z',
            })
        );
        store.dispatch(
            appNotificationRecorded({
                id: 'app-n-1',
                severity: 'info',
                status: 'unread',
                title: 'Stored notice',
                message: 'Stored notice',
                createdAt: '2026-04-21T00:00:01.000Z',
                readAt: null,
                operationId: null,
                links: [],
                payloadDetails: [],
            })
        );
        store.dispatch(
            exchangeTombstoneRecorded({
                exnSaid: 'Eexn',
                route: '/challenge/request',
                notificationId: 'challenge-request:Eexn',
                reason: 'userDismissed',
                createdAt: '2026-04-21T00:00:02.000Z',
            })
        );
        store.dispatch(
            storedChallengeWordsRecorded({
                challengeId: 'challenge-1',
                counterpartyAid: 'Econtact',
                counterpartyAlias: 'Wan',
                localIdentifier: 'alice',
                localAid: 'Ealice',
                words: Array.from({ length: 12 }, (_, index) => `word${index}`),
                wordsHash: 'hash-one',
                strength: 128,
                generatedAt: '2026-04-21T00:00:03.000Z',
                updatedAt: '2026-04-21T00:00:03.000Z',
                status: 'pending',
            })
        );

        expect(runtime.clearAllLocalState()).toBe(2);

        expect(
            storage.getItem(persistedAppStateKey('Econtroller1'))
        ).toBeNull();
        expect(
            storage.getItem(persistedAppStateKey('Econtroller2'))
        ).toBeNull();
        expect(store.getState().operations.order).toEqual([]);
        expect(store.getState().appNotifications.ids).toEqual([]);
        expect(store.getState().exchangeTombstones.saids).toEqual([]);
        expect(store.getState().challenges.storedWordIds).toEqual([]);

        await runtime.destroy();
    });

    it('tombstones synthetic exchange notifications without deleting KERIA notes', async () => {
        const store = createAppStore();
        const runtime = createAppRuntime({ store, storage: null });
        const { client, notifications } = makeWorkflowClient();
        connectRuntimeForTest(runtime, client);

        await runtime.dismissExchangeNotification({
            notificationId: 'exchange:Eexn',
            exnSaid: 'Eexn',
            route: '/challenge/request',
        });

        expect(store.getState().exchangeTombstones.bySaid.Eexn).toMatchObject({
            route: '/challenge/request',
            reason: 'userDismissed',
        });
        expect(notifications.delete).not.toHaveBeenCalled();

        await runtime.destroy();
    });

    it('tombstones real exchange notifications and best-effort deletes KERIA notes', async () => {
        const store = createAppStore();
        const runtime = createAppRuntime({ store, storage: null });
        const { client, notifications } = makeWorkflowClient();
        connectRuntimeForTest(runtime, client);

        await runtime.dismissExchangeNotification({
            notificationId: 'note-1',
            exnSaid: 'Eexn',
            route: '/challenge/request',
        });

        expect(store.getState().exchangeTombstones.bySaid.Eexn).toMatchObject({
            notificationId: 'note-1',
        });
        expect(notifications.delete).toHaveBeenCalledWith('note-1');

        await runtime.destroy();
    });

    it('enriches OOBI workflow operations and notifications with copyable payload details', async () => {
        const store = createAppStore();
        const runtime = createAppRuntime({ store, storage: null });
        const oobi = 'http://127.0.0.1:3902/oobi/Ealice/agent?name=alice';

        runtime.startBackgroundWorkflow(
            function* () {
                yield* sleep(0);
                return {
                    id: 'alice:agent',
                    identifier: 'alice',
                    role: 'agent',
                    oobis: [oobi],
                    generatedAt: '2026-04-21T00:00:00.000Z',
                };
            },
            {
                requestId: 'oobi-success',
                label: 'Generating OOBI...',
                title: 'Generate OOBI',
                kind: 'generateOobi',
                resourceKeys: ['oobi:alice:agent'],
                successNotification: {
                    title: 'OOBI generated',
                    message: 'Generated an agent OOBI.',
                },
            }
        );

        await vi.waitFor(() => {
            expect(
                store.getState().operations.byId['oobi-success']
            ).toMatchObject({
                status: 'success',
                payloadDetails: [
                    expect.objectContaining({
                        label: 'OOBI',
                        value: oobi,
                        kind: 'oobi',
                        copyable: true,
                    }),
                ],
            });
        });

        const notificationId = store.getState().appNotifications.ids[0];
        expect(notificationId).toBeDefined();
        expect(
            store.getState().appNotifications.byId[notificationId]
        ).toMatchObject({
            payloadDetails: [
                expect.objectContaining({
                    label: 'OOBI',
                    value: oobi,
                }),
            ],
        });

        await runtime.destroy();
    });

    it('shows known aliases before delegated operation AID payload values', async () => {
        const store = createAppStore();
        const runtime = createAppRuntime({ store, storage: null });

        store.dispatch(
            contactResolved({
                id: 'delegator',
                alias: 'Root Delegator',
                aid: 'Edelegator',
                oobi: null,
                updatedAt: '2026-04-21T00:00:00.000Z',
            })
        );
        store.dispatch(
            identifierListLoaded({
                identifiers: [
                    {
                        name: 'Leaf Delegate',
                        prefix: 'Edelegate',
                    },
                ] as IdentifierSummary[],
                loadedAt: '2026-04-21T00:00:00.000Z',
            })
        );

        runtime.startBackgroundWorkflow(
            function* () {
                yield* sleep(0);
                return {
                    delegation: {
                        delegatorAid: 'Edelegator',
                        delegateAid: 'Edelegate',
                        delegateEventSaid: 'Eevent',
                        sequence: '0',
                        requestedAt: '2026-04-21T00:00:01.000Z',
                    },
                };
            },
            {
                requestId: 'delegation-success',
                label: 'Creating delegated identifier...',
                title: 'Create delegated identifier',
                kind: 'createDelegatedIdentifier',
                resourceKeys: ['delegation:delegate:Edelegate'],
                successNotification: {
                    title: 'Delegated identifier created',
                    message: 'Delegation completed.',
                },
            }
        );

        await vi.waitFor(() => {
            expect(
                store.getState().operations.byId['delegation-success']
            ).toMatchObject({
                status: 'success',
                payloadDetails: expect.arrayContaining([
                    expect.objectContaining({
                        label: 'Delegator AID',
                        value: 'Edelegator',
                        displayValue: 'Root Delegator (Edelegator)',
                    }),
                    expect.objectContaining({
                        label: 'Delegate AID',
                        value: 'Edelegate',
                        displayValue: 'Leaf Delegate (Edelegate)',
                    }),
                ]),
            });
        });

        const notificationId = store.getState().appNotifications.ids[0];
        expect(notificationId).toBeDefined();
        expect(
            store.getState().appNotifications.byId[notificationId]
        ).toMatchObject({
            payloadDetails: expect.arrayContaining([
                expect.objectContaining({
                    label: 'Delegator AID',
                    value: 'Edelegator',
                    displayValue: 'Root Delegator (Edelegator)',
                }),
                expect.objectContaining({
                    label: 'Delegate AID',
                    value: 'Edelegate',
                    displayValue: 'Leaf Delegate (Edelegate)',
                }),
            ]),
        });

        await runtime.destroy();
    });

    it('rejects background workflows with active resource conflicts', async () => {
        const store = createAppStore();
        const runtime = createAppRuntime({ store, storage: null });

        runtime.startBackgroundWorkflow(
            function* () {
                yield* sleep(10_000);
            },
            {
                requestId: 'background-running',
                label: 'Resolving contact...',
                title: 'Resolve contact',
                kind: 'resolveContact',
                resourceKeys: ['contact:alice'],
            }
        );

        const conflicted = runtime.startBackgroundWorkflow(
            function* () {
                yield* sleep(0);
            },
            {
                requestId: 'background-conflict',
                label: 'Resolving contact again...',
                title: 'Resolve contact again',
                kind: 'resolveContact',
                resourceKeys: ['contact:alice'],
            }
        );

        expect(conflicted).toEqual({
            status: 'conflict',
            requestId: 'background-running',
            operationRoute: '/operations/background-running',
            message: 'Already working on Resolve contact.',
        });

        await runtime.destroy();
    });

    it('rejects contact and OOBI commands with active resource conflicts', async () => {
        const store = createAppStore();
        const runtime = createAppRuntime({ store, storage: null });
        const oobi = 'http://127.0.0.1:3902/oobi/Ealice/agent';

        runtime.startBackgroundWorkflow(
            function* () {
                yield* sleep(10_000);
            },
            {
                requestId: 'resolve-running',
                label: 'Resolving contact...',
                title: 'Resolve Alice contact',
                kind: 'resolveContact',
                resourceKeys: [`contact:oobi:${oobi}`],
            }
        );

        expect(
            runtime.startResolveContact({
                oobi,
                alias: 'Alice',
            })
        ).toEqual({
            status: 'conflict',
            requestId: 'resolve-running',
            operationRoute: '/operations/resolve-running',
            message: 'Already working on Resolve Alice contact.',
        });

        runtime.startBackgroundWorkflow(
            function* () {
                yield* sleep(10_000);
            },
            {
                requestId: 'oobi-running',
                label: 'Generating OOBI...',
                title: 'Generate agent OOBI',
                kind: 'generateOobi',
                resourceKeys: ['oobi:alice:agent'],
            }
        );

        expect(
            runtime.startGenerateOobi({
                identifier: 'alice',
                role: 'agent',
            })
        ).toEqual({
            status: 'conflict',
            requestId: 'oobi-running',
            operationRoute: '/operations/oobi-running',
            message: 'Already working on Generate agent OOBI.',
        });

        await runtime.destroy();
    });
});
