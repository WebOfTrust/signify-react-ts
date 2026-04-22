import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/** Local handling status for a KERIA notification route. */
export type NotificationStatus = 'unread' | 'processing' | 'processed' | 'error';

/**
 * Durable notification summary used by polling and future processing workflows.
 */
export interface NotificationRecord {
    id: string;
    dt: string | null;
    read: boolean;
    route: string;
    anchorSaid: string | null;
    status: NotificationStatus;
    message: string | null;
    updatedAt: string;
}

/**
 * Notification slice state keyed by notification id.
 */
export interface NotificationsState {
    byId: Record<string, NotificationRecord>;
    ids: string[];
    loadedAt: string | null;
}

const createInitialState = (): NotificationsState => ({
    byId: {},
    ids: [],
    loadedAt: null,
});

const initialState: NotificationsState = createInitialState();

/**
 * Redux slice for notification inventory and processing status.
 */
export const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        notificationInventoryLoaded(
            state,
            {
                payload,
            }: PayloadAction<{
                notifications: NotificationRecord[];
                loadedAt: string;
            }>
        ) {
            state.byId = Object.fromEntries(
                payload.notifications.map((notification) => [
                    notification.id,
                    notification,
                ])
            );
            state.ids = payload.notifications.map(
                (notification) => notification.id
            );
            state.loadedAt = payload.loadedAt;
        },
        notificationRecorded(
            state,
            { payload }: PayloadAction<NotificationRecord>
        ) {
            state.byId[payload.id] = payload;
            if (!state.ids.includes(payload.id)) {
                state.ids.push(payload.id);
            }
        },
        notificationStatusChanged(
            state,
            {
                payload,
            }: PayloadAction<{
                id: string;
                status: NotificationStatus;
                updatedAt: string;
                message?: string | null;
            }>
        ) {
            const notification = state.byId[payload.id];
            if (notification !== undefined) {
                notification.status = payload.status;
                notification.updatedAt = payload.updatedAt;
                notification.message = payload.message ?? notification.message;
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(sessionConnecting, createInitialState)
            .addCase(sessionConnectionFailed, createInitialState)
            .addCase(sessionDisconnected, createInitialState);
    },
});

/** Action creators for recording notifications and status changes. */
export const {
    notificationInventoryLoaded,
    notificationRecorded,
    notificationStatusChanged,
} =
    notificationsSlice.actions;

/** Reducer mounted at `state.notifications`. */
export const notificationsReducer = notificationsSlice.reducer;
