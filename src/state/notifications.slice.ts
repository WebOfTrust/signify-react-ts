import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { MultisigThresholdSith } from '../features/multisig/multisigThresholds';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';
import type { DelegationAnchor } from '../features/identifiers/delegationHelpers';

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

/** Delegator-facing state for inbound delegated identifier requests. */
export type DelegationRequestNotificationStatus =
    | 'actionable'
    | 'approved'
    | 'notForThisWallet'
    | 'error';

/** Local state for multisig protocol requests. */
export type MultisigRequestNotificationStatus =
    | 'actionable'
    | 'approved'
    | 'notForThisWallet'
    | 'error';

/** Multisig request route variants handled by this wallet. */
export type MultisigRequestRoute =
    | '/multisig/icp'
    | '/multisig/rpy'
    | '/multisig/ixn'
    | '/multisig/rot';

/** Response progress for one multisig exchange route and group. */
export interface MultisigExchangeProgress {
    groupAid: string | null;
    route: MultisigRequestRoute;
    expectedMemberAids: string[];
    respondedMemberAids: string[];
    waitingMemberAids: string[];
    completed: number;
    total: number;
}

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
 * Delegation request metadata hydrated from a KERIA `/delegate/request`
 * notification. The anchor is created from the delegate event and reused when
 * the delegator manually approves the request.
 */
export interface DelegationRequestNotification {
    notificationId: string;
    delegatorAid: string;
    delegateAid: string;
    delegateEventSaid: string;
    sequence: string;
    anchor: DelegationAnchor;
    sourceAid: string | null;
    createdAt: string;
    status: DelegationRequestNotificationStatus;
}

/**
 * Hydrated multisig protocol metadata. Event payloads remain summarized here;
 * the workflows reload the authoritative EXN through `groups().getRequest`.
 */
export interface MultisigRequestNotification {
    notificationId: string;
    exnSaid: string;
    route: MultisigRequestRoute;
    senderAid: string | null;
    groupAid: string | null;
    groupAlias: string | null;
    signingMemberAids: string[];
    rotationMemberAids: string[];
    signingThreshold: MultisigThresholdSith | null;
    rotationThreshold: MultisigThresholdSith | null;
    embeddedPayloadSummary: string | null;
    embeddedEventType: string | null;
    embeddedEventSaid: string | null;
    progress: MultisigExchangeProgress;
    createdAt: string;
    status: MultisigRequestNotificationStatus;
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
    delegationRequest?: DelegationRequestNotification | null;
    multisigRequest?: MultisigRequestNotification | null;
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
        delegationRequestNotificationApproved(
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
                    notification.delegationRequest !== null &&
                    notification.delegationRequest !== undefined
                ) {
                    notification.delegationRequest = {
                        ...notification.delegationRequest,
                        status: 'approved',
                    };
                }
            }
        },
        multisigRequestNotificationApproved(
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
                    notification.multisigRequest !== null &&
                    notification.multisigRequest !== undefined
                ) {
                    notification.multisigRequest = {
                        ...notification.multisigRequest,
                        status: 'approved',
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
    delegationRequestNotificationApproved,
    multisigRequestNotificationApproved,
} = notificationsSlice.actions;

/** Reducer mounted at `state.notifications`. */
export const notificationsReducer = notificationsSlice.reducer;
