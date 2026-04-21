import type { CompletedOperation, Operation } from 'signify-ts';
import { describe, expect, it, vi } from 'vitest';
import {
  waitOperation,
  type OperationLogEvent,
} from '../../src/signify/client';

const operation = (name: string): Operation =>
  ({
    name,
    done: false,
  }) as Operation;

const completedOperation = (name: string): CompletedOperation =>
  ({
    name,
    done: true,
    response: { ok: true },
  }) as CompletedOperation;

const waitClient = (
  wait: (
    operation: Operation,
    options: { signal?: AbortSignal; minSleep?: number; maxSleep?: number }
  ) => Promise<CompletedOperation>
) => ({
  /*
   * `waitOperation` intentionally depends only on the small
   * `operations().wait(...)` surface. Unit tests use this fake to verify the
   * app policy layer without constructing a real SignifyClient or contacting
   * KERIA; production callers still pass the real client.
   */
  operations: () => ({
    wait,
  }),
});

describe('waitOperation', () => {
  it('returns the completed operation and logs start and success', async () => {
    const logger = vi.fn<(event: OperationLogEvent) => void>();
    const completed = completedOperation('op-success');
    const wait = vi.fn(async () => completed);

    const result = await waitOperation(waitClient(wait), operation('op-success'), {
      label: 'creating identifier alice',
      logger,
    });

    expect(result).toBe(completed);
    expect(wait).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'op-success' }),
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        minSleep: expect.any(Number),
        maxSleep: expect.any(Number),
      })
    );
    expect(logger).toHaveBeenNthCalledWith(1, {
      status: 'start',
      label: 'creating identifier alice',
      operationName: 'op-success',
      elapsedMs: 0,
    });
    expect(logger).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        status: 'success',
        label: 'creating identifier alice',
        operationName: 'op-success',
        elapsedMs: expect.any(Number),
      })
    );
  });

  it('adds label, operation name, elapsed time, and cause to failures', async () => {
    const logger = vi.fn<(event: OperationLogEvent) => void>();
    const cause = new Error('KERIA rejected the request');
    const wait = vi.fn(async () => {
      throw cause;
    });

    const error = await waitOperation(
      waitClient(wait),
      operation('op-failure'),
      {
        label: 'rotating identifier alice',
        logger,
      }
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(
      /^Operation failed while rotating identifier alice \[operation=op-failure, elapsed=\d+ms\]: KERIA rejected the request$/
    );
    expect((error as Error).cause).toBe(cause);
    expect(logger).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'failure',
        label: 'rotating identifier alice',
        operationName: 'op-failure',
        elapsedMs: expect.any(Number),
        error: cause,
      })
    );
  });

  it('rejects with the standardized message when the timeout aborts the wait', async () => {
    const wait = vi.fn(
      async (
        _operation: Operation,
        options: { signal?: AbortSignal }
      ): Promise<CompletedOperation> =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(options.signal?.reason ?? new Error('aborted'));
          });
        })
    );

    const error = await waitOperation(
      waitClient(wait),
      operation('op-timeout'),
      {
        label: 'resolving holder OOBI',
        timeoutMs: 1,
      }
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(
      /^Operation failed while resolving holder OOBI \[operation=op-timeout, elapsed=\d+ms\]: Operation timed out after 1ms$/
    );
  });

  it('rejects with the standardized message when the caller aborts the wait', async () => {
    const controller = new AbortController();
    const cause = new Error('user cancelled');
    const wait = vi.fn(
      async (
        _operation: Operation,
        options: { signal?: AbortSignal }
      ): Promise<CompletedOperation> =>
        new Promise((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(options.signal?.reason ?? new Error('aborted'));
          });
          controller.abort(cause);
        })
    );

    const error = await waitOperation(waitClient(wait), operation('op-abort'), {
      label: 'submitting credential grant',
      signal: controller.signal,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(
      /^Operation failed while submitting credential grant \[operation=op-abort, elapsed=\d+ms\]: user cancelled$/
    );
  });
});
