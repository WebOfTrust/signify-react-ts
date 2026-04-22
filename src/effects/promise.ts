import { call, race, sleep, until, type Operation } from 'effection';

/**
 * Error raised by workflow timeout wrappers.
 *
 * Keep this distinct from browser `AbortError` so reducers and tests can tell
 * apart explicit cancellation and a long-running KERIA step that exceeded its
 * configured budget.
 */
export class WorkflowTimeoutError extends Error {
    /** Create a workflow-specific timeout error for reducers/tests. */
    constructor(message: string) {
        super(message);
        this.name = 'WorkflowTimeoutError';
    }
}

/**
 * Default Promise edge: create the Promise inside `call` so Effection owns the
 * operation lifecycle. Use `waitForExistingPromise` only when a Promise has
 * already been created by an external API.
 */
export function* callPromise<T>(fn: () => Promise<T>): Operation<T> {
    return yield* call(fn);
}

/**
 * Wait for a Promise that an external API already created.
 *
 * Prefer `callPromise` for new code so Effection can own Promise construction
 * and cancellation from the beginning of the operation.
 */
export function* waitForExistingPromise<T>(
    promise: Promise<T>
): Operation<T> {
    return yield* until(promise);
}

/**
 * Effection operation that sleeps for `ms`, then fails with a timeout error.
 */
export function* timeoutOp(ms: number, label: string): Operation<never> {
    yield* sleep(ms);
    throw new WorkflowTimeoutError(`${label} timed out after ${ms}ms`);
}

/**
 * Race a workflow operation against a labeled timeout operation.
 */
export function* withTimeout<T>(
    operation: Operation<T>,
    ms: number,
    label: string
): Operation<T> {
    return yield* race([operation, timeoutOp(ms, label)]);
}

/**
 * Normalize unknown caught values for reducer payloads and route messages.
 */
export const toErrorText = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);
