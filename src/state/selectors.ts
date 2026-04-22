import type { RootState } from './store';
import type { OperationRecord } from './operations.slice';
import type { AppNotificationRecord } from './appNotifications.slice';
import type { NotificationRecord } from './notifications.slice';

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
        .filter((notification) => notification?.status === 'unread');

/** Select KERIA notification inventory records newest first. */
export const selectKeriaNotifications = (state: RootState) =>
    state.notifications.ids
        .map((id) => state.notifications.byId[id])
        .filter(
            (notification): notification is NotificationRecord =>
                notification !== undefined
        )
        .sort(byNewestKeriaNotificationTimestamp);

/** Select notifications that a polling/processing workflow may attempt. */
export const selectProcessableNotifications = (state: RootState) =>
    state.notifications.ids
        .map((id) => state.notifications.byId[id])
        .filter(
            (notification) =>
                notification?.status === 'unread' ||
                notification?.status === 'error'
        );
