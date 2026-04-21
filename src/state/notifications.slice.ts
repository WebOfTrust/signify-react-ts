import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Local handling status for a KERIA notification route. */
export type NotificationStatus = 'unread' | 'processing' | 'processed' | 'error';

/**
 * Durable notification summary used by polling and future processing workflows.
 */
export interface NotificationRecord {
    id: string;
    route: string;
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
}

const initialState: NotificationsState = {
    byId: {},
    ids: [],
};

/**
 * Redux slice for notification inventory and processing status.
 */
export const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
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
});

/** Action creators for recording notifications and status changes. */
export const { notificationRecorded, notificationStatusChanged } =
    notificationsSlice.actions;

/** Reducer mounted at `state.notifications`. */
export const notificationsReducer = notificationsSlice.reducer;
