import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Maximum retained non-running workflow records.
 */
export const OPERATION_HISTORY_LIMIT = 100;

/** Public lifecycle for route/workflow operations tracked in Redux. */
export type OperationStatus = 'running' | 'success' | 'error' | 'canceled';

/**
 * Serializable operation record for UI pending state and debugging.
 */
export interface OperationRecord {
    requestId: string;
    label: string;
    kind: string;
    status: OperationStatus;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
    canceledReason: string | null;
}

/**
 * Operation slice state keyed by request id in display order.
 */
export interface OperationsState {
    byId: Record<string, OperationRecord>;
    order: string[];
}

const initialState: OperationsState = {
    byId: {},
    order: [],
};

/**
 * Timestamp helper kept injectable through prepare payloads in tests.
 */
const now = (): string => new Date().toISOString();

/**
 * Trim completed/canceled/failed operation history without dropping active work.
 */
const trimHistory = (state: OperationsState): void => {
    while (state.order.length > OPERATION_HISTORY_LIMIT) {
        const removableId =
            state.order.find(
                (requestId) => state.byId[requestId]?.status !== 'running'
            ) ?? state.order[0];

        state.order = state.order.filter(
            (requestId) => requestId !== removableId
        );
        delete state.byId[removableId];
    }
};

/**
 * Mark a running operation as closed if it still exists.
 */
const closeOperation = (
    state: OperationsState,
    requestId: string,
    status: Exclude<OperationStatus, 'running'>,
    finishedAt: string,
    error: string | null,
    canceledReason: string | null
): void => {
    const record = state.byId[requestId];
    if (record === undefined) {
        return;
    }

    record.status = status;
    record.finishedAt = finishedAt;
    record.error = error;
    record.canceledReason = canceledReason;
    trimHistory(state);
};

/**
 * Redux slice for runtime workflow lifecycle tracking.
 */
export const operationsSlice = createSlice({
    name: 'operations',
    initialState,
    reducers: {
        operationStarted: {
            reducer(
                state,
                {
                    payload,
                }: PayloadAction<{
                    requestId: string;
                    label: string;
                    kind: string;
                    startedAt: string;
                }>
            ) {
                state.byId[payload.requestId] = {
                    requestId: payload.requestId,
                    label: payload.label,
                    kind: payload.kind,
                    status: 'running',
                    startedAt: payload.startedAt,
                    finishedAt: null,
                    error: null,
                    canceledReason: null,
                };
                state.order = state.order.filter(
                    (requestId) => requestId !== payload.requestId
                );
                state.order.push(payload.requestId);
                trimHistory(state);
            },
            prepare(payload: {
                requestId: string;
                label: string;
                kind: string;
                startedAt?: string;
            }) {
                return {
                    payload: {
                        ...payload,
                        startedAt: payload.startedAt ?? now(),
                    },
                };
            },
        },
        operationSucceeded: {
            reducer(
                state,
                {
                    payload,
                }: PayloadAction<{ requestId: string; finishedAt: string }>
            ) {
                closeOperation(
                    state,
                    payload.requestId,
                    'success',
                    payload.finishedAt,
                    null,
                    null
                );
            },
            prepare(payload: { requestId: string; finishedAt?: string }) {
                return {
                    payload: {
                        ...payload,
                        finishedAt: payload.finishedAt ?? now(),
                    },
                };
            },
        },
        operationFailed: {
            reducer(
                state,
                {
                    payload,
                }: PayloadAction<{
                    requestId: string;
                    error: string;
                    finishedAt: string;
                }>
            ) {
                closeOperation(
                    state,
                    payload.requestId,
                    'error',
                    payload.finishedAt,
                    payload.error,
                    null
                );
            },
            prepare(payload: {
                requestId: string;
                error: string;
                finishedAt?: string;
            }) {
                return {
                    payload: {
                        ...payload,
                        finishedAt: payload.finishedAt ?? now(),
                    },
                };
            },
        },
        operationCanceled: {
            reducer(
                state,
                {
                    payload,
                }: PayloadAction<{
                    requestId: string;
                    reason: string;
                    finishedAt: string;
                }>
            ) {
                closeOperation(
                    state,
                    payload.requestId,
                    'canceled',
                    payload.finishedAt,
                    null,
                    payload.reason
                );
            },
            prepare(payload: {
                requestId: string;
                reason: string;
                finishedAt?: string;
            }) {
                return {
                    payload: {
                        ...payload,
                        finishedAt: payload.finishedAt ?? now(),
                    },
                };
            },
        },
        cancelRunningOperations: {
            reducer(
                state,
                {
                    payload,
                }: PayloadAction<{ reason: string; finishedAt: string }>
            ) {
                for (const requestId of state.order) {
                    const record = state.byId[requestId];
                    if (record?.status === 'running') {
                        record.status = 'canceled';
                        record.finishedAt = payload.finishedAt;
                        record.canceledReason = payload.reason;
                    }
                }
                trimHistory(state);
            },
            prepare(payload: { reason: string; finishedAt?: string }) {
                return {
                    payload: {
                        ...payload,
                        finishedAt: payload.finishedAt ?? now(),
                    },
                };
            },
        },
    },
});

/** Action creators for operation start, completion, failure, and cancellation. */
export const {
    operationStarted,
    operationSucceeded,
    operationFailed,
    operationCanceled,
    cancelRunningOperations,
} = operationsSlice.actions;

/** Reducer mounted at `state.operations`. */
export const operationsReducer = operationsSlice.reducer;
