import type { RootState } from './store';

/** Select the serializable session connection summary. */
export const selectSession = (state: RootState) => state.session;

/** Select only the session status for shell rendering. */
export const selectConnectionStatus = (state: RootState) => state.session.status;

/** Select operation records in display order. */
export const selectOperationRecords = (state: RootState) =>
    state.operations.order.map((requestId) => state.operations.byId[requestId]);

/** Select currently running operations. */
export const selectActiveOperations = (state: RootState) =>
    selectOperationRecords(state).filter(
        (operation) => operation?.status === 'running'
    );

/** Select the most recent running operation label for the global overlay. */
export const selectLatestActiveOperationLabel = (
    state: RootState
): string | null =>
    [...selectActiveOperations(state)].reverse()[0]?.label ?? null;

/** Select normalized identifiers in list order. */
export const selectIdentifiers = (state: RootState) =>
    state.identifiers.prefixes.map(
        (prefix) => state.identifiers.byPrefix[prefix]
    );

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
export const selectCredentialStatus =
    (said: string) =>
    (state: RootState) =>
        state.credentials.bySaid[said]?.status ?? null;

/** Select unread notifications for badge/count UI. */
export const selectUnreadNotifications = (state: RootState) =>
    state.notifications.ids
        .map((id) => state.notifications.byId[id])
        .filter((notification) => notification?.status === 'unread');

/** Select notifications that a polling/processing workflow may attempt. */
export const selectProcessableNotifications = (state: RootState) =>
    state.notifications.ids
        .map((id) => state.notifications.byId[id])
        .filter(
            (notification) =>
                notification?.status === 'unread' ||
                notification?.status === 'error'
        );
