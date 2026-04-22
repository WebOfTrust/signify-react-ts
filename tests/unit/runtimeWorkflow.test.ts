import { sleep } from 'effection';
import { describe, expect, it, vi } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime';
import { selectActiveOperations } from '../../src/state/selectors';
import { createAppStore } from '../../src/state/store';

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

        expect(store.getState().operations.byId['workflow-success']).toMatchObject({
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

        expect(store.getState().operations.byId['workflow-canceled']).toMatchObject({
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
        expect(store.getState().operations.byId['background-success']).toMatchObject({
            status: 'running',
            resourceKeys: ['contact:alice'],
        });

        await vi.waitFor(() => {
            expect(store.getState().operations.byId['background-success']).toMatchObject({
                status: 'success',
                notificationId: expect.any(String),
            });
        });
        expect(store.getState().appNotifications.ids).toHaveLength(1);

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
            expect(store.getState().operations.byId['oobi-success']).toMatchObject({
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
