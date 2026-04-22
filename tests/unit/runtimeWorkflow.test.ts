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
});
