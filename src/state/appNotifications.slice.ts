import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { PayloadDetailRecord } from './payloadDetails';

/**
 * Bounded retention for user-facing app notifications.
 *
 * These are broader than KERIA notifications: they describe app work such as
 * background operation completion/failure and link the user back to app
 * context.
 */
export const APP_NOTIFICATION_HISTORY_LIMIT = 100;

/** User-facing notification severity for shell/list styling. */
export type AppNotificationSeverity = 'info' | 'success' | 'warning' | 'error';

/** Read state is owned by the app notification UX, not by KERIA. */
export type AppNotificationStatus = 'unread' | 'read';

/** Link relationships supported by app notification cards and popovers. */
export type AppNotificationLinkRel = 'operation' | 'result';

/** Serializable app route link attached to a user notification. */
export interface AppNotificationLink {
    rel: AppNotificationLinkRel;
    label: string;
    path: string;
}

/**
 * User-facing notification record.
 *
 * Keep this serializable and app-scoped. Do not store raw KERIA notification
 * payloads here; those belong in `notifications.slice.ts`.
 */
export interface AppNotificationRecord {
    id: string;
    severity: AppNotificationSeverity;
    status: AppNotificationStatus;
    title: string;
    message: string;
    createdAt: string;
    readAt: string | null;
    operationId: string | null;
    links: AppNotificationLink[];
    payloadDetails: PayloadDetailRecord[];
}

/** App notification state keyed by notification id in retention order. */
export interface AppNotificationsState {
    byId: Record<string, AppNotificationRecord>;
    ids: string[];
}

const initialState: AppNotificationsState = {
    byId: {},
    ids: [],
};

const now = (): string => new Date().toISOString();

/**
 * Drop oldest notifications after the history limit.
 */
const trimHistory = (state: AppNotificationsState): void => {
    while (state.ids.length > APP_NOTIFICATION_HISTORY_LIMIT) {
        const removableId = state.ids[0];
        state.ids = state.ids.slice(1);
        delete state.byId[removableId];
    }
};

/**
 * Upsert by id so persistence rehydration and runtime completion can share the
 * same bounded insertion behavior.
 */
const upsertNotification = (
    state: AppNotificationsState,
    notification: AppNotificationRecord
): void => {
    state.byId[notification.id] = {
        ...notification,
        payloadDetails: notification.payloadDetails ?? [],
    };
    if (!state.ids.includes(notification.id)) {
        state.ids.push(notification.id);
    }
    trimHistory(state);
};

/**
 * Redux slice for app-level user notifications.
 */
export const appNotificationsSlice = createSlice({
    name: 'appNotifications',
    initialState,
    reducers: {
        appNotificationRecorded(
            state,
            { payload }: PayloadAction<AppNotificationRecord>
        ) {
            upsertNotification(state, payload);
        },
        appNotificationRead: {
            reducer(
                state,
                { payload }: PayloadAction<{ id: string; readAt: string }>
            ) {
                const notification = state.byId[payload.id];
                if (notification !== undefined) {
                    notification.status = 'read';
                    notification.readAt = payload.readAt;
                }
            },
            prepare(payload: { id: string; readAt?: string }) {
                return {
                    payload: {
                        id: payload.id,
                        readAt: payload.readAt ?? now(),
                    },
                };
            },
        },
        allAppNotificationsRead: {
            reducer(state, { payload }: PayloadAction<{ readAt: string }>) {
                for (const id of state.ids) {
                    const notification = state.byId[id];
                    if (notification?.status === 'unread') {
                        notification.status = 'read';
                        notification.readAt = payload.readAt;
                    }
                }
            },
            prepare(payload: { readAt?: string } = {}) {
                return {
                    payload: {
                        readAt: payload.readAt ?? now(),
                    },
                };
            },
        },
        appNotificationsRehydrated(
            state,
            { payload }: PayloadAction<{ records: AppNotificationRecord[] }>
        ) {
            state.byId = {};
            state.ids = [];
            for (const record of payload.records) {
                upsertNotification(state, record);
            }
        },
    },
});

export const {
    appNotificationRecorded,
    appNotificationRead,
    allAppNotificationsRead,
    appNotificationsRehydrated,
} = appNotificationsSlice.actions;

/**
 * Reducer installed into the root store for user-facing app notifications.
 */
export const appNotificationsReducer = appNotificationsSlice.reducer;
