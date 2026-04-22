import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PayloadDetailRecord } from './payloadDetails';

/**
 * Maximum retained non-running workflow records.
 */
export const OPERATION_HISTORY_LIMIT = 100;

/** Public lifecycle for route/workflow operations tracked in Redux. */
export type OperationStatus =
    | 'running'
    | 'success'
    | 'error'
    | 'canceled'
    | 'interrupted';

/** Typed operation categories exposed by the app operations UX. */
export type OperationKind =
    | 'connect'
    | 'generatePasscode'
    | 'refreshState'
    | 'listIdentifiers'
    | 'createIdentifier'
    | 'rotateIdentifier'
    | 'createDelegatedIdentifier'
    | 'rotateDelegatedIdentifier'
    | 'approveDelegation'
    | 'generateOobi'
    | 'generateChallenge'
    | 'sendChallengeRequest'
    | 'respondChallenge'
    | 'verifyChallenge'
    | 'deleteContact'
    | 'updateContact'
    | 'syncInventory'
    | 'resolveContact'
    | 'resolveSchema'
    | 'createRegistry'
    | 'issueCredential'
    | 'grantCredential'
    | 'admitCredential'
    | 'presentCredential'
    | 'pollNotifications'
    | 'workflow';

/** Serializable link from an operation to related app context. */
export interface OperationRouteLink {
    label: string;
    path: string;
}

/**
 * Serializable operation record for UI pending state and debugging.
 */
export interface OperationRecord {
    requestId: string;
    label: string;
    title: string;
    description: string | null;
    kind: OperationKind;
    status: OperationStatus;
    phase: string;
    resourceKeys: string[];
    operationRoute: string;
    resultRoute: OperationRouteLink | null;
    notificationId: string | null;
    payloadDetails: PayloadDetailRecord[];
    keriaOperationName: string | null;
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

const operationRoute = (requestId: string): string =>
    `/operations/${requestId}`;

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
    record.phase = status;
    record.finishedAt = finishedAt;
    record.error = error;
    record.canceledReason = canceledReason;
    trimHistory(state);
};

/**
 * Upsert a record while preserving display order.
 */
const upsertOperation = (
    state: OperationsState,
    record: OperationRecord
): void => {
    state.byId[record.requestId] = {
        ...record,
        payloadDetails: record.payloadDetails ?? [],
    };
    state.order = state.order.filter(
        (requestId) => requestId !== record.requestId
    );
    state.order.push(record.requestId);
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
                    title: string;
                    description: string | null;
                    kind: OperationKind;
                    phase: string;
                    resourceKeys: string[];
                    operationRoute: string;
                    resultRoute: OperationRouteLink | null;
                    notificationId: string | null;
                    payloadDetails: PayloadDetailRecord[];
                    keriaOperationName: string | null;
                    startedAt: string;
                }>
            ) {
                upsertOperation(state, {
                    requestId: payload.requestId,
                    label: payload.label,
                    title: payload.title,
                    description: payload.description,
                    kind: payload.kind,
                    status: 'running',
                    phase: payload.phase,
                    resourceKeys: payload.resourceKeys,
                    operationRoute: payload.operationRoute,
                    resultRoute: payload.resultRoute,
                    notificationId: payload.notificationId,
                    payloadDetails: payload.payloadDetails,
                    keriaOperationName: payload.keriaOperationName,
                    startedAt: payload.startedAt,
                    finishedAt: null,
                    error: null,
                    canceledReason: null,
                });
            },
            prepare(payload: {
                requestId: string;
                label: string;
                kind?: OperationKind;
                title?: string;
                description?: string | null;
                phase?: string;
                resourceKeys?: readonly string[];
                operationRoute?: string;
                resultRoute?: OperationRouteLink | null;
                notificationId?: string | null;
                payloadDetails?: PayloadDetailRecord[];
                keriaOperationName?: string | null;
                startedAt?: string;
            }) {
                return {
                    payload: {
                        ...payload,
                        title: payload.title ?? payload.label,
                        description: payload.description ?? null,
                        kind: payload.kind ?? 'workflow',
                        phase: payload.phase ?? 'running',
                        resourceKeys: [...(payload.resourceKeys ?? [])],
                        operationRoute:
                            payload.operationRoute ??
                            operationRoute(payload.requestId),
                        resultRoute: payload.resultRoute ?? null,
                        notificationId: payload.notificationId ?? null,
                        payloadDetails: [...(payload.payloadDetails ?? [])],
                        keriaOperationName: payload.keriaOperationName ?? null,
                        startedAt: payload.startedAt ?? now(),
                    },
                };
            },
        },
        operationPhaseChanged(
            state,
            {
                payload,
            }: PayloadAction<{
                requestId: string;
                phase: string;
                keriaOperationName?: string | null;
            }>
        ) {
            const record = state.byId[payload.requestId];
            if (record !== undefined) {
                record.phase = payload.phase;
                if (payload.keriaOperationName !== undefined) {
                    record.keriaOperationName = payload.keriaOperationName;
                }
            }
        },
        operationResultLinked(
            state,
            {
                payload,
            }: PayloadAction<{
                requestId: string;
                resultRoute: OperationRouteLink | null;
                notificationId?: string | null;
            }>
        ) {
            const record = state.byId[payload.requestId];
            if (record !== undefined) {
                record.resultRoute = payload.resultRoute;
                if (payload.notificationId !== undefined) {
                    record.notificationId = payload.notificationId;
                }
            }
        },
        operationPayloadDetailsRecorded(
            state,
            {
                payload,
            }: PayloadAction<{
                requestId: string;
                payloadDetails: PayloadDetailRecord[];
            }>
        ) {
            const record = state.byId[payload.requestId];
            if (record !== undefined) {
                record.payloadDetails = payload.payloadDetails;
            }
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
                        record.phase = 'canceled';
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
        operationsRehydrated(
            state,
            {
                payload,
            }: PayloadAction<{
                records: OperationRecord[];
                interruptedAt: string;
            }>
        ) {
            state.byId = {};
            state.order = [];
            for (const record of payload.records) {
                const normalized =
                    record.status === 'running'
                        ? {
                              ...record,
                              payloadDetails: record.payloadDetails ?? [],
                              status: 'interrupted' as const,
                              phase: 'interrupted',
                              finishedAt: payload.interruptedAt,
                              canceledReason:
                                  'Browser refresh stopped the local operation watcher.',
                          }
                        : {
                              ...record,
                              payloadDetails: record.payloadDetails ?? [],
                          };
                upsertOperation(state, normalized);
            }
        },
    },
});

/** Action creators for operation start, completion, failure, and cancellation. */
export const {
    operationStarted,
    operationSucceeded,
    operationFailed,
    operationCanceled,
    operationPhaseChanged,
    operationPayloadDetailsRecorded,
    operationResultLinked,
    cancelRunningOperations,
    operationsRehydrated,
} = operationsSlice.actions;

/** Reducer mounted at `state.operations`. */
export const operationsReducer = operationsSlice.reducer;
