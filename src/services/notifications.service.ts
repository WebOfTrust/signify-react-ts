import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import type { ContactRecord } from '../domain/contacts/contactTypes';
import type { IdentifierSummary } from '../domain/identifiers/identifierTypes';
import { callPromise } from '../effects/promise';
import {
    aidSet,
    notificationRecordsFromResponse,
    notificationResponseProjectionFromNotes,
    parseKeriaNotificationResponse,
} from './notifications/base';
import {
    challengeRequestFromExchange,
    hydrateChallengeRequestNotifications,
} from './notifications/challenge';
import { hydrateCredentialIpexNotifications } from './notifications/credentialIpex';
import { hydrateW3CVcGrantNotifications } from './notifications/w3cGrant';
import { W3C_VC_GRANT_NOTIFICATION_ROUTE } from './notifications/w3cGrant';
import {
    DELEGATION_REQUEST_NOTIFICATION_ROUTE,
    hydrateDelegationRequestNotifications,
} from './notifications/delegation';
import {
    hydrateMultisigRequestNotifications,
    multisigResponseProgressMap,
} from './notifications/multisig';
import {
    listMultisigRequestExchanges,
    syntheticChallengeRequestNotifications,
    syntheticMultisigRequestNotifications,
} from './notifications/syntheticExchange';
import {
    isSyntheticChallengeNotificationId,
    isSyntheticExchangeNotificationId,
    SYNTHETIC_CHALLENGE_NOTIFICATION_PREFIX,
    SYNTHETIC_EXCHANGE_NOTIFICATION_PREFIX,
    syntheticChallengeNotificationId,
    syntheticExchangeNotificationId,
} from './notifications/syntheticIds';
import type { NotificationInventorySnapshot } from './notifications/types';

export type {
    NotificationInventorySnapshot,
    UnknownChallengeSenderNotice,
} from './notifications/types';

export {
    challengeRequestFromExchange,
    DELEGATION_REQUEST_NOTIFICATION_ROUTE,
    isSyntheticChallengeNotificationId,
    isSyntheticExchangeNotificationId,
    notificationRecordsFromResponse,
    SYNTHETIC_CHALLENGE_NOTIFICATION_PREFIX,
    SYNTHETIC_EXCHANGE_NOTIFICATION_PREFIX,
    syntheticChallengeNotificationId,
    syntheticExchangeNotificationId,
    W3C_VC_GRANT_NOTIFICATION_ROUTE,
};

/**
 * Load KERIA protocol notifications without mixing them with local app notices.
 */
export function* listNotificationsService({
    client,
    contacts = [],
    localAids = [],
    tombstonedExnSaids = [],
    respondedChallengeIds = [],
    respondedWordsHashes = [],
    localIdentifiers = [],
}: {
    client: SignifyClient;
    contacts?: readonly ContactRecord[];
    localAids?: readonly string[];
    localIdentifiers?: readonly IdentifierSummary[];
    tombstonedExnSaids?: readonly string[];
    respondedChallengeIds?: readonly string[];
    respondedWordsHashes?: readonly string[];
}): EffectionOperation<NotificationInventorySnapshot> {
    const response: unknown = yield* callPromise(() =>
        client.notifications().list()
    );
    const loadedAt = new Date().toISOString();
    const localAidSet = aidSet(localAids);
    const tombstoneSet = aidSet(tombstonedExnSaids);
    const notes = parseKeriaNotificationResponse(response);
    const projection = notificationResponseProjectionFromNotes(
        notes,
        loadedAt
    );
    const notifications = projection.notifications.filter(
        (notification) =>
            notification.anchorSaid === null ||
            !tombstoneSet.has(notification.anchorSaid)
    );
    const multisigExchanges = yield* listMultisigRequestExchanges({ client });
    const multisigResponseProgress =
        multisigResponseProgressMap(multisigExchanges);
    const ipexHydrated = yield* hydrateCredentialIpexNotifications({
        client,
        notifications,
        localAids: localAidSet,
        loadedAt,
    });
    const w3cGrantHydrated = yield* hydrateW3CVcGrantNotifications({
        client,
        notifications: ipexHydrated,
        localAids: localAidSet,
        localIdentifiers,
        loadedAt,
    });
    const delegationHydrated = yield* hydrateDelegationRequestNotifications({
        client,
        notifications: w3cGrantHydrated,
        noteAttrsById: projection.noteAttrsById,
        localAids: localAidSet,
        loadedAt,
    });
    const multisigHydrated = yield* hydrateMultisigRequestNotifications({
        client,
        notifications: delegationHydrated,
        localAids: localAidSet,
        loadedAt,
        responseProgress: multisigResponseProgress,
    });
    const multisigExistingExnSaids = new Set(
        multisigHydrated.flatMap((notification) =>
            notification.anchorSaid !== null ? [notification.anchorSaid] : []
        )
    );
    const syntheticMultisig = yield* syntheticMultisigRequestNotifications({
        client,
        exchanges: multisigExchanges,
        localAids: localAidSet,
        tombstonedExnSaids: tombstoneSet,
        loadedAt,
        existingExnSaids: multisigExistingExnSaids,
        responseProgress: multisigResponseProgress,
    });
    const hydrated = yield* hydrateChallengeRequestNotifications({
        client,
        notifications: [...multisigHydrated, ...syntheticMultisig],
        contacts,
        localAids: localAidSet,
        tombstonedExnSaids: tombstoneSet,
        loadedAt,
    });
    const existingExnSaids = new Set(
        hydrated.notifications.flatMap((notification) =>
            notification.challengeRequest?.exnSaid !== undefined
                ? [notification.challengeRequest.exnSaid]
                : notification.anchorSaid !== null
                  ? [notification.anchorSaid]
                  : []
        )
    );
    const synthetic = yield* syntheticChallengeRequestNotifications({
        client,
        contacts,
        localAids: localAidSet,
        tombstonedExnSaids: tombstoneSet,
        loadedAt,
        existingExnSaids,
        respondedChallengeIds: new Set(respondedChallengeIds),
        respondedWordsHashes: new Set(respondedWordsHashes),
    });

    return {
        notifications: [...hydrated.notifications, ...synthetic.notifications],
        loadedAt,
        unknownChallengeSenders: [
            ...hydrated.unknownChallengeSenders,
            ...synthetic.unknownChallengeSenders,
        ],
    };
}

/**
 * Mark a KERIA protocol notification read, then return refreshed inventory.
 */
export function* markNotificationReadService({
    client,
    notificationId,
    contacts = [],
    localAids = [],
    tombstonedExnSaids = [],
    respondedChallengeIds = [],
    respondedWordsHashes = [],
}: {
    client: SignifyClient;
    notificationId: string;
    contacts?: readonly ContactRecord[];
    localAids?: readonly string[];
    tombstonedExnSaids?: readonly string[];
    respondedChallengeIds?: readonly string[];
    respondedWordsHashes?: readonly string[];
}): EffectionOperation<NotificationInventorySnapshot> {
    yield* callPromise(() => client.notifications().mark(notificationId));
    return yield* listNotificationsService({
        client,
        contacts,
        localAids,
        tombstonedExnSaids,
        respondedChallengeIds,
        respondedWordsHashes,
    });
}

/**
 * Delete a KERIA protocol notification, then return refreshed inventory.
 */
export function* deleteNotificationService({
    client,
    notificationId,
    contacts = [],
    localAids = [],
    tombstonedExnSaids = [],
    respondedChallengeIds = [],
    respondedWordsHashes = [],
}: {
    client: SignifyClient;
    notificationId: string;
    contacts?: readonly ContactRecord[];
    localAids?: readonly string[];
    tombstonedExnSaids?: readonly string[];
    respondedChallengeIds?: readonly string[];
    respondedWordsHashes?: readonly string[];
}): EffectionOperation<NotificationInventorySnapshot> {
    yield* callPromise(() => client.notifications().delete(notificationId));
    return yield* listNotificationsService({
        client,
        contacts,
        localAids,
        tombstonedExnSaids,
        respondedChallengeIds,
        respondedWordsHashes,
    });
}
