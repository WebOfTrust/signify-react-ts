import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/** Local handling status for a KERIA notification route. */
export type NotificationStatus =
    | 'unread'
    | 'processing'
    | 'processed'
    | 'error';

/** Responder-facing state for challenge request notifications. */
export type ChallengeRequestNotificationStatus =
    | 'actionable'
    | 'senderUnknown'
    | 'responded'
    | 'error';

/** Holder-facing state for inbound credential grant notifications. */
export type CredentialGrantNotificationStatus =
    | 'actionable'
    | 'notForThisWallet'
    | 'admitted'
    | 'error';

/** Issuer-facing state for inbound credential admit notifications. */
export type CredentialAdmitNotificationStatus =
    | 'received'
    | 'notForThisWallet'
    | 'error';

/**
 * Actionable challenge request metadata hydrated from a KERIA notification EXN.
 *
 * Raw challenge words never belong here. The responder supplies words
 * out-of-band when sending the response.
 */
export interface ChallengeRequestNotification {
    notificationId: string;
    exnSaid: string;
    senderAid: string;
    senderAlias: string;
    recipientAid: string | null;
    challengeId: string;
    wordsHash: string;
    strength: number;
    createdAt: string;
    status: ChallengeRequestNotificationStatus;
}

/**
 * Credential grant metadata hydrated from an IPEX grant EXN.
 */
export interface CredentialGrantNotification {
    notificationId: string;
    grantSaid: string;
    issuerAid: string;
    holderAid: string;
    credentialSaid: string;
    schemaSaid: string | null;
    attributes: Record<string, string | boolean>;
    createdAt: string;
    status: CredentialGrantNotificationStatus;
}

/**
 * Credential admit receipt metadata hydrated from an IPEX admit EXN.
 */
export interface CredentialAdmitNotification {
    notificationId: string;
    admitSaid: string;
    grantSaid: string | null;
    issuerAid: string | null;
    holderAid: string;
    createdAt: string;
    status: CredentialAdmitNotificationStatus;
}

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
    challengeRequest?: ChallengeRequestNotification | null;
    credentialGrant?: CredentialGrantNotification | null;
    credentialAdmit?: CredentialAdmitNotification | null;
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
        challengeRequestNotificationResponded(
            state,
            {
                payload,
            }: PayloadAction<{
                id: string;
                updatedAt: string;
                message?: string | null;
            }>
        ) {
            const notification = state.byId[payload.id];
            if (notification !== undefined) {
                notification.read = true;
                notification.status = 'processed';
                notification.updatedAt = payload.updatedAt;
                notification.message = payload.message ?? notification.message;
                if (
                    notification.challengeRequest !== null &&
                    notification.challengeRequest !== undefined
                ) {
                    notification.challengeRequest = {
                        ...notification.challengeRequest,
                        status: 'responded',
                    };
                }
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
    challengeRequestNotificationResponded,
} = notificationsSlice.actions;

/** Reducer mounted at `state.notifications`. */
export const notificationsReducer = notificationsSlice.reducer;
