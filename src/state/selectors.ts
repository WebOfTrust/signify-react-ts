import type { RootState } from './store';
import type { OperationRecord } from './operations.slice';
import type { AppNotificationRecord } from './appNotifications.slice';
import type {
    ChallengeRequestNotification,
    NotificationRecord,
} from './notifications.slice';
import type { ContactRecord } from './contacts.slice';
import type { ChallengeRecord } from './challenges.slice';
import {
    knownComponentsFromContacts,
    type KnownComponentRecord,
} from '../features/contacts/contactHelpers';

/** Select the serializable session connection summary. */
export const selectSession = (state: RootState) => state.session;

/** Select only the session status for shell rendering. */
export const selectConnectionStatus = (state: RootState) =>
    state.session.status;

/** Select operation records in display order. */
export const selectOperationRecords = (state: RootState) =>
    state.operations.order
        .map((requestId) => state.operations.byId[requestId])
        .filter((record): record is OperationRecord => record !== undefined);

/** Select currently running operations. */
export const selectActiveOperations = (state: RootState) =>
    selectOperationRecords(state).filter(
        (operation) => operation?.status === 'running'
    );

/** Select active operation count for compact shell indicators. */
export const selectActiveOperationCount = (state: RootState): number =>
    selectActiveOperations(state).length;

/** Select the most recent running operation label for the global overlay. */
export const selectLatestActiveOperationLabel = (
    state: RootState
): string | null =>
    [...selectActiveOperations(state)].reverse()[0]?.label ?? null;

/** Find one operation record by request id. */
export const selectOperationById =
    (requestId: string) =>
    (state: RootState): OperationRecord | null =>
        state.operations.byId[requestId] ?? null;

/** Return true when a running operation owns any of the supplied resources. */
export const selectHasActiveResourceConflict =
    (resourceKeys: readonly string[]) =>
    (state: RootState): boolean => {
        const requested = new Set(resourceKeys);
        return selectActiveOperations(state).some((operation) =>
            operation.resourceKeys.some((key) => requested.has(key))
        );
    };

/** Select normalized identifiers in list order. */
export const selectIdentifiers = (state: RootState) =>
    state.identifiers.prefixes
        .map((prefix) => state.identifiers.byPrefix[prefix])
        .filter((identifier) => identifier !== undefined);

const byNewestTimestamp = (
    left: AppNotificationRecord,
    right: AppNotificationRecord
): number => right.createdAt.localeCompare(left.createdAt);

const byNewestKeriaNotificationTimestamp = (
    left: NotificationRecord,
    right: NotificationRecord
): number => right.updatedAt.localeCompare(left.updatedAt);

const byNewestChallengeRequestTimestamp = (
    left: ChallengeRequestNotification,
    right: ChallengeRequestNotification
): number => right.createdAt.localeCompare(left.createdAt);

const byNewestOperationTimestamp = (
    left: OperationRecord,
    right: OperationRecord
): number => right.startedAt.localeCompare(left.startedAt);

const byNewestChallengeTimestamp = (
    left: ChallengeRecord,
    right: ChallengeRecord
): number => right.updatedAt.localeCompare(left.updatedAt);

const byUpdatedContact = (left: ContactRecord, right: ContactRecord): number =>
    (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');

/** Select user-facing app notification records in descending timestamp order. */
export const selectAppNotifications = (state: RootState) =>
    state.appNotifications.ids
        .map((id) => state.appNotifications.byId[id])
        .filter(
            (notification): notification is AppNotificationRecord =>
                notification !== undefined
        )
        .sort(byNewestTimestamp);

/** Select unread user-facing app notifications. */
export const selectUnreadAppNotifications = (state: RootState) =>
    selectAppNotifications(state).filter(
        (notification) => notification?.status === 'unread'
    );

/** Select one app notification by id. */
export const selectAppNotificationById = (id: string) => (state: RootState) =>
    state.appNotifications.byId[id] ?? null;

/** Build an alias lookup for resolved and pending contacts. */
export const selectContactsByAlias = (state: RootState) => {
    const contacts = Object.values(state.contacts.byId);
    return new Map(contacts.map((contact) => [contact.alias, contact]));
};

/** Select contacts newest first, preserving known metadata. */
export const selectContacts = (state: RootState) =>
    state.contacts.ids
        .map((id) => state.contacts.byId[id])
        .filter((contact): contact is ContactRecord => contact !== undefined)
        .sort(byUpdatedContact);

/** Select one contact by normalized KERIA contact id/AID. */
export const selectContactById = (contactId: string) => (state: RootState) =>
    state.contacts.byId[contactId] ?? null;

/** Select generated local OOBIs newest first. */
export const selectGeneratedOobis = (state: RootState) =>
    state.contacts.generatedOobiIds
        .map((id) => state.contacts.generatedOobis[id])
        .filter((record) => record !== undefined)
        .sort((left, right) =>
            right.generatedAt.localeCompare(left.generatedAt)
        );

/** Build an OOBI lookup for contacts that were created from an OOBI. */
export const selectContactsByOobi = (state: RootState) => {
    const contacts = Object.values(state.contacts.byId).filter(
        (contact) => contact.oobi !== null
    );
    return new Map(contacts.map((contact) => [contact.oobi, contact]));
};

/** Create a selector for one credential status by SAID. */
export const selectCredentialStatus = (said: string) => (state: RootState) =>
    state.credentials.bySaid[said]?.status ?? null;

/** Select unread notifications for badge/count UI. */
export const selectUnreadNotifications = (state: RootState) =>
    state.notifications.ids
        .map((id) => state.notifications.byId[id])
        .filter(
            (notification): notification is NotificationRecord =>
                notification !== undefined &&
                (notification.status === 'unread' || !notification.read)
        );

/** Select KERIA notification inventory records newest first. */
export const selectKeriaNotifications = (state: RootState) =>
    state.notifications.ids
        .map((id) => state.notifications.byId[id])
        .filter(
            (notification): notification is NotificationRecord =>
                notification !== undefined
        )
        .sort(byNewestKeriaNotificationTimestamp);

/** Select one KERIA notification by id. */
export const selectKeriaNotificationById =
    (id: string) =>
    (state: RootState): NotificationRecord | null =>
        state.notifications.byId[id] ?? null;

/** Select hydrated challenge request notifications newest first. */
export const selectChallengeRequestNotifications = (state: RootState) =>
    selectKeriaNotifications(state)
        .flatMap((notification) =>
            notification.challengeRequest === null ||
            notification.challengeRequest === undefined
                ? []
                : [notification.challengeRequest]
        )
        .sort(byNewestChallengeRequestTimestamp);

/** Select challenge requests that still need responder action. */
export const selectActionableChallengeRequestNotifications = (
    state: RootState
) =>
    selectChallengeRequestNotifications(state).filter(
        (notification) => notification.status === 'actionable'
    );

/** Select one hydrated challenge request notification by KERIA notification id. */
export const selectChallengeRequestNotificationById =
    (notificationId: string) =>
    (state: RootState): ChallengeRequestNotification | null =>
        state.notifications.byId[notificationId]?.challengeRequest ?? null;

/** Select challenge-response records newest first. */
export const selectChallenges = (state: RootState) =>
    state.challenges.ids
        .map((id) => state.challenges.byId[id])
        .filter(
            (challenge): challenge is ChallengeRecord => challenge !== undefined
        )
        .sort(byNewestChallengeTimestamp);

/** Select challenge-response records for one contact. */
export const selectChallengesForContact =
    (contactId: string) =>
    (state: RootState): ChallengeRecord[] =>
        selectChallenges(state).filter(
            (challenge) => challenge.counterpartyAid === contactId
        );

/** Select known witnesses/watchers/mailboxes/components derived from contacts. */
export const selectKnownComponents = (
    state: RootState
): KnownComponentRecord[] => knownComponentsFromContacts(selectContacts(state));

/** Group known components by their endpoint/OOBI role. */
export const selectKnownComponentsByRole = (state: RootState) => {
    const groups = new Map<string, KnownComponentRecord[]>();
    for (const component of selectKnownComponents(state)) {
        groups.set(component.role, [
            ...(groups.get(component.role) ?? []),
            component,
        ]);
    }

    return groups;
};

/** Select recent operations for compact dashboard panels. */
export const selectRecentOperations =
    (limit = 5) =>
    (state: RootState) =>
        [...selectOperationRecords(state)]
            .sort(byNewestOperationTimestamp)
            .slice(0, limit);

/** Select recent protocol notifications for dashboard panels. */
export const selectRecentKeriaNotifications =
    (limit = 5) =>
    (state: RootState): NotificationRecord[] =>
        selectKeriaNotifications(state).slice(0, limit);

/** Select recent app-level notices for dashboard panels. */
export const selectRecentAppNotifications =
    (limit = 5) =>
    (state: RootState): AppNotificationRecord[] =>
        selectAppNotifications(state).slice(0, limit);

/** Select recent challenge-response records for dashboard panels. */
export const selectRecentChallenges =
    (limit = 5) =>
    (state: RootState): ChallengeRecord[] =>
        selectChallenges(state).slice(0, limit);

/** Aggregate dashboard counters from normalized state. */
export const selectDashboardCounts = (state: RootState) => ({
    identifiers: selectIdentifiers(state).length,
    contacts: selectContacts(state).length,
    knownComponents: selectKnownComponents(state).length,
    activeOperations: selectActiveOperations(state).length,
    unreadKeriaNotifications: selectUnreadNotifications(state).length,
    unreadAppNotifications: selectUnreadAppNotifications(state).length,
    challenges: selectChallenges(state).length,
});

/** Select notifications that a polling/processing workflow may attempt. */
export const selectProcessableNotifications = (state: RootState) =>
    state.notifications.ids
        .map((id) => state.notifications.byId[id])
        .filter(
            (notification) =>
                notification?.status === 'unread' ||
                notification?.status === 'error'
        );
