import { sleep } from 'effection';
import { describe, expect, it } from 'vitest';
import { createAppRuntime } from '../../src/app/runtime';
import { selectActiveOperations } from '../../src/state/selectors';
import { createAppStore } from '../../src/state/store';

describe('AppRuntime workflow bridge', () => {
    it('records successful Effection workflow completion', async () => {
        const store = createAppStore();
        const runtime = createAppRuntime({ store });

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
        const runtime = createAppRuntime({ store });
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
});
