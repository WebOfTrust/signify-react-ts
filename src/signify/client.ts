import {
  SignifyClient,
  randomPasscode,
  ready,
  type CompletedOperation,
  type Operation,
  type Tier,
} from 'signify-ts';
import { appConfig, type KeriaConfig, type OperationConfig } from '../config';

/**
 * Signify client boundary for app and test code.
 *
 * This is the only module in `src` that should know how to prepare
 * `signify-ts`, construct `SignifyClient`, boot/connect KERIA agents, and wait
 * for KERIA operations. React components, smoke scripts, and Vitest scenarios
 * should call this boundary instead of duplicating lifecycle code.
 */
type SignifyState = Awaited<ReturnType<SignifyClient['state']>>;

/**
 * Minimal inputs needed to create a Signify client.
 *
 * The caller supplies passcode material. KERIA URLs and tier fall back to
 * `appConfig` so UI code and smoke scripts use the same local defaults.
 */
export interface SignifyClientConfig extends Partial<KeriaConfig> {
  passcode: string;
  tier?: Tier;
}

/**
 * Stable state projection for React and smoke checks.
 *
 * Signify's raw `state()` result is preserved for detail views, while common
 * AIDs and indexes are normalized into predictable top-level fields.
 */
export interface SignifyStateSummary {
  controllerPre: string;
  agentPre: string;
  ridx: number;
  pidx: number;
  state: SignifyState;
}

export interface ConnectedSignifyClient {
  /** Connected raw Signify client. Callers may use resource APIs from here. */
  client: SignifyClient;
  /** Normalized state snapshot read immediately after the connection succeeds. */
  state: SignifyStateSummary;
  /** True when this call created the KERIA agent before connecting. */
  booted: boolean;
}

export interface ConnectOptions {
  /** Boot only when KERIA says the controller has no agent yet. */
  bootIfMissing?: boolean;
}

export type OperationLogEvent =
  | {
      status: 'start';
      label: string;
      operationName: string;
      elapsedMs: number;
    }
  | {
      status: 'success';
      label: string;
      operationName: string;
      elapsedMs: number;
    }
  | {
      status: 'failure';
      label: string;
      operationName: string;
      elapsedMs: number;
      error: Error;
    };

export type OperationLogger = (event: OperationLogEvent) => void;

export interface WaitOperationOptions extends Partial<OperationConfig> {
  /** Human-readable phase included in timeout/failure messages. */
  label: string;
  /** Optional caller cancellation signal, composed with the timeout signal. */
  signal?: AbortSignal;
  /** Optional structured operation logger. Defaults to no logging. */
  logger?: OperationLogger;
}

const isMissingAgentError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes('agent does not exist');

export const toError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error));

/**
 * Minimal shape consumed by `waitOperation`.
 *
 * This is deliberately narrower than `SignifyClient`: the helper does not wrap
 * or reinterpret KERIA operations, and it must not grow into a parallel
 * operation model. Signify's own `operations().wait(...)` remains the authority
 * for polling, dependency operations, completed-operation typing, and operation
 * failure payloads.
 *
 * The structural interface gives tests a small fake client without requiring a
 * booted KERIA agent, while production callers still pass a real
 * `SignifyClient`. If this interface starts accumulating methods beyond
 * `operations().wait`, that is a sign the boundary is doing too much.
 */
interface OperationWaiter {
  wait(
    operation: Operation,
    options: {
      signal?: AbortSignal;
      minSleep?: number;
      maxSleep?: number;
    }
  ): Promise<CompletedOperation>;
}

interface OperationWaitClient {
  operations(): OperationWaiter;
}

/**
 * Compose the app-level timeout with an optional caller cancellation signal.
 *
 * Signify accepts a single `AbortSignal` for operation waits. The app needs two
 * cancellation sources with consistent cleanup: a configured upper bound so
 * waits cannot hang forever, and an optional caller signal for UI unmounts or
 * explicit cancellation. This helper creates the one signal Signify expects and
 * removes listeners/timers after every success or failure path.
 */
const combineWithTimeout = (
  timeoutMs: number,
  signal?: AbortSignal
): { signal: AbortSignal; cleanup: () => void } => {
  /*
   * Signify's operation waiter accepts one AbortSignal. We compose the caller's
   * optional signal with an internal timeout signal and return cleanup so each
   * wait removes listeners and clears its timer in success and failure paths.
   */
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => {
    controller.abort(new Error(`Operation timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  const onAbort = () => {
    controller.abort(signal?.reason ?? new Error('Operation aborted'));
  };

  if (signal?.aborted) {
    onAbort();
  } else {
    signal?.addEventListener('abort', onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
    },
  };
};

/**
 * Initialize Signify readiness and construct a raw `SignifyClient`.
 *
 * This is the only allowed construction site for app code. Prefer
 * `connectSignifyClient` unless the caller has a specific reason to control the
 * boot/connect sequence manually.
 */
export const createSignifyClient = async (
  config: SignifyClientConfig
): Promise<SignifyClient> => {
  await ready();

  return new SignifyClient(
    config.adminUrl ?? appConfig.keria.adminUrl,
    config.passcode,
    config.tier ?? appConfig.defaultTier,
    config.bootUrl ?? appConfig.keria.bootUrl
  );
};

/**
 * Generate a Signify passcode after WASM readiness is complete.
 *
 * Calling `randomPasscode()` before `ready()` fails in Node smoke scripts, so
 * generation is part of the boundary instead of being called directly from UI.
 */
export const randomSignifyPasscode = async (): Promise<string> => {
  await ready();
  return randomPasscode();
};

/**
 * Read and normalize current KERIA agent/controller state.
 */
export const getSignifyState = async (
  client: SignifyClient
): Promise<SignifyStateSummary> => {
  const state = await client.state();
  const controllerPre =
    state.controller?.state?.i ?? state.controller?.i ?? client.controller.pre;
  const agentPre = state.agent?.i ?? client.agent?.pre ?? '';

  return {
    controllerPre,
    agentPre,
    ridx: state.ridx ?? 0,
    pidx: state.pidx ?? 0,
    state,
  };
};

/**
 * Create a client and connect it to KERIA.
 *
 * The boundary boots only for the expected "agent does not exist" path. That
 * keeps real network/auth/API failures visible instead of masking them with an
 * unconditional boot attempt.
 */
export const connectSignifyClient = async (
  config: SignifyClientConfig,
  options: ConnectOptions = {}
): Promise<ConnectedSignifyClient> => {
  const bootIfMissing = options.bootIfMissing ?? true;
  const client = await createSignifyClient(config);
  let booted = false;

  try {
    await client.connect();
  } catch (error) {
    if (!bootIfMissing || !isMissingAgentError(error)) {
      throw error;
    }

    const response = await client.boot();
    if (!response.ok) {
      throw new Error(
        `KERIA boot failed: ${response.status} ${response.statusText}`,
        { cause: error }
      );
    }

    booted = true;
    await client.connect();
  }

  return {
    client,
    state: await getSignifyState(client),
    booted,
  };
};

/**
 * Wait for a long-running KERIA operation with app defaults and useful errors.
 *
 * This is intentionally a thin policy layer over Signify's
 * `client.operations().wait(op, options)`. It does not inspect operation
 * internals, poll manually, decide when an operation is complete, or change the
 * completed operation returned by Signify.
 *
 * What the layer adds:
 * - app-wide timeout defaults so no call site can wait indefinitely;
 * - composition of timeout and caller abort signals into Signify's one signal;
 * - required human labels so UI/test failures name the phase that was running;
 * - operation name and elapsed time in every standardized failure message;
 * - optional structured logging for consistent start/success/failure telemetry;
 * - preserved original error causes for debugging.
 *
 * Always use this for KERIA operations in app or scenario code. Do not add
 * manual `operations().get` polling loops or local done/error interpretation.
 */
export const waitOperation = async (
  client: OperationWaitClient,
  op: Operation,
  options: WaitOperationOptions
): Promise<CompletedOperation> => {
  const timeoutMs = options.timeoutMs ?? appConfig.operations.timeoutMs;
  const minSleepMs = options.minSleepMs ?? appConfig.operations.minSleepMs;
  const maxSleepMs = options.maxSleepMs ?? appConfig.operations.maxSleepMs;
  const { signal, cleanup } = combineWithTimeout(timeoutMs, options.signal);
  const startedAt = Date.now();
  const operationName = op.name;
  const elapsedMs = () => Date.now() - startedAt;

  options.logger?.({
    status: 'start',
    label: options.label,
    operationName,
    elapsedMs: 0,
  });

  try {
    const completed = await client.operations().wait(op, {
      signal,
      minSleep: minSleepMs,
      maxSleep: maxSleepMs,
    });
    options.logger?.({
      status: 'success',
      label: options.label,
      operationName,
      elapsedMs: elapsedMs(),
    });
    return completed;
  } catch (error) {
    const normalized = toError(error);
    const elapsed = elapsedMs();
    options.logger?.({
      status: 'failure',
      label: options.label,
      operationName,
      elapsedMs: elapsed,
      error: normalized,
    });
    throw new Error(
      `Operation failed while ${options.label} [operation=${operationName}, elapsed=${elapsed}ms]: ${normalized.message}`,
      { cause: error }
    );
  } finally {
    cleanup();
  }
};
