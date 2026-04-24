import type { RootState } from './store';
import type { OperationRecord } from './operations.slice';
import type { AppNotificationRecord } from './appNotifications.slice';
import type {
    ChallengeRequestNotification,
    CredentialAdmitNotification,
    CredentialGrantNotification,
    DelegationRequestNotification,
    MultisigRequestNotification,
    NotificationRecord,
} from './notifications.slice';
import type { ContactRecord } from './contacts.slice';
import type {
    ChallengeRecord,
    StoredChallengeWordsRecord,
} from './challenges.slice';
import type { CredentialIpexActivityRecord } from './credentials.slice';
import {
    knownComponentsFromContacts,
    type KnownComponentRecord,
} from '../features/contacts/contactHelpers';
import {
    buildIssueableCredentialTypeViews,
    ISSUEABLE_CREDENTIAL_TYPES,
} from './issueableCredentialTypes';

/** Select the serializable session connection summary. */
export const selectSession = (state: RootState) => state.session;

/** Select only the session status for shell rendering. */
export const selectConnectionStatus = (state: RootState) =>
    state.session.status;

/** Select the persisted interface sound preference. */
export const selectHoverSoundMuted = (state: RootState): boolean =>
    state.uiPreferences.hoverSoundMuted;

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

/** Select wallet-wide AID/registry UI selection. */
export const selectWalletSelection = (state: RootState) =>
    state.walletSelection;

/** Select the active wallet AID only when it still exists locally. */
export const selectSelectedWalletIdentifier = (state: RootState) => {
    const selectedAid = state.walletSelection.selectedAid;
    if (selectedAid === null) {
        return null;
    }

    return (
        selectIdentifiers(state).find(
            (identifier) => identifier.prefix === selectedAid
        ) ?? null
    );
};

/** Select the active wallet AID prefix when valid. */
export const selectSelectedWalletAid = (state: RootState): string | null =>
    selectSelectedWalletIdentifier(state)?.prefix ?? null;

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

const byNewestStoredChallengeWordsTimestamp = (
    left: StoredChallengeWordsRecord,
    right: StoredChallengeWordsRecord
): number => right.updatedAt.localeCompare(left.updatedAt);

const byUpdatedContact = (left: ContactRecord, right: ContactRecord): number =>
    (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '');

/**
 * Select tombstoned EXN SAIDs to filter synthetic exchange-backed inventory.
 */
export const selectExchangeTombstoneSaids = (state: RootState) =>
    state.exchangeTombstones.saids;

const notificationExnSaid = (notification: NotificationRecord): string | null =>
    notification.challengeRequest?.exnSaid ??
    notification.credentialGrant?.grantSaid ??
    notification.credentialAdmit?.admitSaid ??
    notification.delegationRequest?.delegateEventSaid ??
    notification.multisigRequest?.exnSaid ??
    notification.anchorSaid;

const isExchangeTombstoned = (
    state: RootState,
    exnSaid: string | null
): boolean =>
    exnSaid !== null && state.exchangeTombstones.bySaid[exnSaid] !== undefined;

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

/** Select credential records newest first. */
export const selectCredentials = (state: RootState) =>
    state.credentials.saids
        .map((said) => state.credentials.bySaid[said])
        .filter((credential) => credential !== undefined)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

/** Select issuer-side credentials. */
export const selectIssuedCredentials = (state: RootState) =>
    selectCredentials(state).filter(
        (credential) => credential.direction === 'issued'
    );

/** Select holder-side credentials. */
export const selectHeldCredentials = (state: RootState) =>
    selectCredentials(state).filter(
        (credential) => credential.direction === 'held'
    );

const byOldestCredentialIpexActivityTimestamp = (
    left: CredentialIpexActivityRecord,
    right: CredentialIpexActivityRecord
): number => {
    if (left.createdAt === null && right.createdAt === null) {
        return left.exchangeSaid.localeCompare(right.exchangeSaid);
    }

    if (left.createdAt === null) {
        return 1;
    }

    if (right.createdAt === null) {
        return -1;
    }

    return left.createdAt.localeCompare(right.createdAt);
};

/** Select IPEX exchange activity linked to one credential SAID. */
export const selectCredentialIpexActivity =
    (credentialSaid: string) =>
    (state: RootState): CredentialIpexActivityRecord[] =>
        [
            ...(state.credentials.ipexActivityByCredentialSaid[
                credentialSaid
            ] ?? []),
        ].sort(byOldestCredentialIpexActivityTimestamp);

/** Select known credential schemas newest first. */
export const selectCredentialSchemas = (state: RootState) =>
    state.schema.saids
        .map((said) => state.schema.bySaid[said])
        .filter((schema) => schema !== undefined)
        .sort((left, right) =>
            (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')
        );

/** Select resolved credential schemas newest first. */
export const selectResolvedCredentialSchemas = (state: RootState) =>
    selectCredentialSchemas(state).filter(
        (schema) => schema.status === 'resolved'
    );

/** Select known credential registries newest first. */
export const selectCredentialRegistries = (state: RootState) =>
    state.registry.ids
        .map((id) => state.registry.byId[id])
        .filter((registry) => registry !== undefined)
        .sort((left, right) =>
            (right.updatedAt ?? '').localeCompare(left.updatedAt ?? '')
        );

/** Select ready credential registries owned by the active wallet AID. */
export const selectReadyCredentialRegistriesForSelectedAid = (
    state: RootState
) => {
    const aid = selectSelectedWalletAid(state);
    if (aid === null) {
        return [];
    }

    return selectCredentialRegistries(state).filter(
        (registry) =>
            registry.issuerAid === aid &&
            registry.status === 'ready' &&
            registry.regk.trim().length > 0
    );
};

/** Select the active wallet registry only when it is ready and belongs to the active AID. */
export const selectSelectedWalletRegistry = (state: RootState) => {
    const selectedRegistryId = state.walletSelection.selectedRegistryId;
    if (selectedRegistryId === null) {
        return null;
    }

    return (
        selectReadyCredentialRegistriesForSelectedAid(state).find(
            (registry) => registry.id === selectedRegistryId
        ) ?? null
    );
};

/** Select app-supported credential types joined with local schema facts. */
export const selectIssueableCredentialTypeViews = (state: RootState) =>
    buildIssueableCredentialTypeViews({
        types: ISSUEABLE_CREDENTIAL_TYPES,
        schemas: selectCredentialSchemas(state),
        issuedCredentials: selectIssuedCredentials(state),
    });

/** Select unread notifications for badge/count UI. */
export const selectUnreadNotifications = (state: RootState) =>
    state.notifications.ids
        .map((id) => state.notifications.byId[id])
        .filter(
            (notification): notification is NotificationRecord =>
                notification !== undefined &&
                !isExchangeTombstoned(
                    state,
                    notificationExnSaid(notification)
                ) &&
                (notification.status === 'unread' || !notification.read)
        );

/** Select KERIA notification inventory records newest first. */
export const selectKeriaNotifications = (state: RootState) =>
    state.notifications.ids
        .map((id) => state.notifications.byId[id])
        .filter(
            (notification): notification is NotificationRecord =>
                notification !== undefined &&
                !isExchangeTombstoned(state, notificationExnSaid(notification))
        )
        .sort(byNewestKeriaNotificationTimestamp);

/** Select one KERIA notification by id. */
export const selectKeriaNotificationById =
    (id: string) =>
    (state: RootState): NotificationRecord | null => {
        const notification = state.notifications.byId[id] ?? null;
        return notification !== null &&
            isExchangeTombstoned(state, notificationExnSaid(notification))
            ? null
            : notification;
    };

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
        selectKeriaNotificationById(notificationId)(state)?.challengeRequest ??
        null;

const byNewestCredentialGrantTimestamp = (
    left: CredentialGrantNotification,
    right: CredentialGrantNotification
): number => right.createdAt.localeCompare(left.createdAt);

const byNewestCredentialAdmitTimestamp = (
    left: CredentialAdmitNotification,
    right: CredentialAdmitNotification
): number => right.createdAt.localeCompare(left.createdAt);

const byNewestDelegationRequestTimestamp = (
    left: DelegationRequestNotification,
    right: DelegationRequestNotification
): number => right.createdAt.localeCompare(left.createdAt);

const byNewestMultisigRequestTimestamp = (
    left: MultisigRequestNotification,
    right: MultisigRequestNotification
): number => right.createdAt.localeCompare(left.createdAt);

/** Select credential grant notifications newest first. */
export const selectCredentialGrantNotifications = (state: RootState) =>
    selectKeriaNotifications(state)
        .flatMap((notification) =>
            notification.credentialGrant === null ||
            notification.credentialGrant === undefined
                ? []
                : [notification.credentialGrant]
        )
        .sort(byNewestCredentialGrantTimestamp);

/** Select actionable holder-side credential grant notifications. */
export const selectActionableCredentialGrantNotifications = (
    state: RootState
) =>
    selectCredentialGrantNotifications(state).filter(
        (notification) => notification.status === 'actionable'
    );

/** Select one credential grant notification by KERIA notification id. */
export const selectCredentialGrantNotificationById =
    (notificationId: string) =>
    (state: RootState): CredentialGrantNotification | null =>
        selectKeriaNotificationById(notificationId)(state)?.credentialGrant ??
        null;

/** Select issuer-side credential admit receipts newest first. */
export const selectCredentialAdmitNotifications = (state: RootState) =>
    selectKeriaNotifications(state)
        .flatMap((notification) =>
            notification.credentialAdmit === null ||
            notification.credentialAdmit === undefined
                ? []
                : [notification.credentialAdmit]
        )
        .sort(byNewestCredentialAdmitTimestamp);

/** Select delegator-side delegation request notifications newest first. */
export const selectDelegationRequestNotifications = (state: RootState) =>
    selectKeriaNotifications(state)
        .flatMap((notification) =>
            notification.delegationRequest === null ||
            notification.delegationRequest === undefined
                ? []
                : [notification.delegationRequest]
        )
        .sort(byNewestDelegationRequestTimestamp);

/** Select delegation requests that still need manual approval. */
export const selectActionableDelegationRequestNotifications = (
    state: RootState
) =>
    selectDelegationRequestNotifications(state).filter(
        (notification) => notification.status === 'actionable'
    );

/** Select one delegation request notification by KERIA notification id. */
export const selectDelegationRequestNotificationById =
    (notificationId: string) =>
    (state: RootState): DelegationRequestNotification | null =>
        selectKeriaNotificationById(notificationId)(state)?.delegationRequest ??
        null;

/** Select hydrated multisig protocol requests newest first. */
export const selectMultisigRequestNotifications = (state: RootState) =>
    selectKeriaNotifications(state)
        .flatMap((notification) =>
            notification.multisigRequest === null ||
            notification.multisigRequest === undefined
                ? []
                : [notification.multisigRequest]
        )
        .sort(byNewestMultisigRequestTimestamp);

/** Select multisig requests that still need local action. */
export const selectActionableMultisigRequestNotifications = (
    state: RootState
) =>
    selectMultisigRequestNotifications(state).filter(
        (notification) => notification.status === 'actionable'
    );

/** Select one multisig request by KERIA notification id. */
export const selectMultisigRequestNotificationById =
    (notificationId: string) =>
    (state: RootState): MultisigRequestNotification | null =>
        selectKeriaNotificationById(notificationId)(state)?.multisigRequest ??
        null;

/** Select group identifiers visible in the connected wallet. */
export const selectMultisigGroupIdentifiers = (state: RootState) =>
    selectIdentifiers(state).filter((identifier) => 'group' in identifier);

/** Select durable multisig workflow records newest first. */
export const selectMultisigGroups = (state: RootState) =>
    state.multisig.groupIds
        .map((id) => state.multisig.groupsById[id])
        .filter((group) => group !== undefined)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

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

/**
 * Select locally stored challenge words newest first for resumable verify UX.
 */
export const selectStoredChallengeWords = (state: RootState) =>
    state.challenges.storedWordIds
        .map((id) => state.challenges.storedWordsById[id])
        .filter(
            (record): record is StoredChallengeWordsRecord =>
                record !== undefined
        )
        .sort(byNewestStoredChallengeWordsTimestamp);

/**
 * Select pending stored challenge words for one contact detail page.
 */
export const selectStoredChallengeWordsForContact =
    (contactId: string) =>
    (state: RootState): StoredChallengeWordsRecord[] =>
        selectStoredChallengeWords(state).filter(
            (record) => record.counterpartyAid === contactId
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

/** Count issuer-side credentials for dashboard summaries. */
export const selectIssuedCredentialCount = (state: RootState) =>
    selectIssuedCredentials(state).length;

/** Count holder-side credentials for dashboard summaries. */
export const selectHeldCredentialCount = (state: RootState) =>
    selectHeldCredentials(state).length;

/** Aggregate dashboard counters from normalized state. */
export const selectDashboardCounts = (state: RootState) => ({
    identifiers: selectIdentifiers(state).length,
    contacts: selectContacts(state).length,
    resolvedSchemas: selectResolvedCredentialSchemas(state).length,
    issuedCredentials: selectIssuedCredentialCount(state),
    heldCredentials: selectHeldCredentialCount(state),
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
