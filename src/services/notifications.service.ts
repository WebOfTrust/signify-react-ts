import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import { callPromise } from '../effects/promise';
import { CHALLENGE_REQUEST_ROUTE } from './challenges.service';
import type { ContactRecord } from '../state/contacts.slice';
import type {
    ChallengeRequestNotification,
    ChallengeRequestNotificationStatus,
    NotificationRecord,
} from '../state/notifications.slice';

export interface NotificationInventorySnapshot {
    notifications: NotificationRecord[];
    loadedAt: string;
    unknownChallengeSenders: UnknownChallengeSenderNotice[];
}

export interface UnknownChallengeSenderNotice {
    notificationId: string;
    exnSaid: string;
    senderAid: string;
    createdAt: string;
}

export const SYNTHETIC_CHALLENGE_NOTIFICATION_PREFIX = 'challenge-request:';
export const SYNTHETIC_EXCHANGE_NOTIFICATION_PREFIX = 'exchange:';

export const syntheticChallengeNotificationId = (exnSaid: string): string =>
    `${SYNTHETIC_CHALLENGE_NOTIFICATION_PREFIX}${exnSaid}`;

export const isSyntheticChallengeNotificationId = (id: string): boolean =>
    id.startsWith(SYNTHETIC_CHALLENGE_NOTIFICATION_PREFIX);

export const syntheticExchangeNotificationId = (exnSaid: string): string =>
    `${SYNTHETIC_EXCHANGE_NOTIFICATION_PREFIX}${exnSaid}`;

export const isSyntheticExchangeNotificationId = (id: string): boolean =>
    isSyntheticChallengeNotificationId(id) ||
    id.startsWith(SYNTHETIC_EXCHANGE_NOTIFICATION_PREFIX);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const numberValue = (value: unknown): number | null => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }

    if (typeof value !== 'string' || value.trim().length === 0) {
        return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};

const notificationItemsFromResponse = (raw: unknown): unknown[] => {
    if (Array.isArray(raw)) {
        return raw;
    }

    if (isRecord(raw) && Array.isArray(raw.notes)) {
        return raw.notes;
    }

    return [];
};

export const notificationRecordsFromResponse = (
    raw: unknown,
    loadedAt: string
): NotificationRecord[] => {
    return notificationItemsFromResponse(raw).flatMap((item) => {
        if (!isRecord(item)) {
            return [];
        }

        const id = stringValue(item.i);
        if (id === null) {
            return [];
        }

        const attrs = isRecord(item.a) ? item.a : {};
        const route = stringValue(attrs.r) ?? 'unknown';
        const dt = stringValue(item.dt);
        const read = item.r === true;
        const anchorSaid = stringValue(attrs.d) ?? stringValue(item.d);

        return [
            {
                id,
                dt,
                read,
                route,
                anchorSaid,
                status: read ? 'processed' : 'unread',
                message: stringValue(attrs.m),
                challengeRequest: null,
                updatedAt: dt ?? loadedAt,
            },
        ];
    });
};

const contactForAid = (
    contacts: readonly ContactRecord[],
    aid: string
): ContactRecord | null =>
    contacts.find((contact) => contact.aid === aid || contact.id === aid) ??
    null;

const aidSet = (aids: readonly string[]): ReadonlySet<string> =>
    new Set(aids.map((aid) => aid.trim()).filter((aid) => aid.length > 0));

const exchangeExn = (exchange: unknown): Record<string, unknown> => {
    if (!isRecord(exchange) || !isRecord(exchange.exn)) {
        throw new Error(
            'Challenge request notification did not include an EXN.'
        );
    }

    return exchange.exn;
};

const exchangeRoute = (exchange: unknown): string | null =>
    stringValue(exchangeExn(exchange).r);

const exchangeSaid = (exchange: unknown): string | null =>
    stringValue(exchangeExn(exchange).d);

const exchangeRecipientAid = (exchange: unknown): string | null => {
    const exn = exchangeExn(exchange);
    const attrs = isRecord(exn.a) ? exn.a : {};

    return stringValue(exn.rp) ?? stringValue(attrs.i);
};

const isOutboundOrUnrelatedChallengeRequest = ({
    contacts,
    localAids,
    recipientAid,
    sender,
    senderAid,
}: {
    contacts: readonly ContactRecord[];
    localAids: ReadonlySet<string>;
    recipientAid: string | null;
    sender: ContactRecord | null;
    senderAid: string;
}): boolean => {
    if (localAids.has(senderAid)) {
        return true;
    }

    if (localAids.size > 0) {
        return recipientAid === null || !localAids.has(recipientAid);
    }

    return (
        sender === null &&
        recipientAid !== null &&
        contactForAid(contacts, recipientAid) !== null
    );
};

export const challengeRequestFromExchange = ({
    notification,
    exchange,
    senderAlias,
    status,
    loadedAt,
}: {
    notification: NotificationRecord;
    exchange: unknown;
    senderAlias: string;
    status: ChallengeRequestNotificationStatus;
    loadedAt: string;
}): ChallengeRequestNotification => {
    const exn = exchangeExn(exchange);
    const route = stringValue(exn.r);
    if (route !== CHALLENGE_REQUEST_ROUTE) {
        throw new Error(
            `Expected ${CHALLENGE_REQUEST_ROUTE} EXN, received ${route ?? 'unknown route'}.`
        );
    }

    const attrs = isRecord(exn.a) ? exn.a : {};
    const exnSaid = stringValue(exn.d) ?? notification.anchorSaid;
    const senderAid = stringValue(exn.i);
    const recipientAid = stringValue(exn.rp) ?? stringValue(attrs.i);
    const challengeId = stringValue(attrs.challengeId);
    const wordsHash = stringValue(attrs.wordsHash);
    const strength = numberValue(attrs.strength);
    const createdAt =
        stringValue(exn.dt) ??
        notification.dt ??
        notification.updatedAt ??
        loadedAt;

    if (exnSaid === null) {
        throw new Error('Challenge request EXN is missing its SAID.');
    }

    if (senderAid === null) {
        throw new Error('Challenge request EXN is missing its sender AID.');
    }

    if (challengeId === null || wordsHash === null || strength === null) {
        throw new Error('Challenge request EXN is missing challenge metadata.');
    }

    return {
        notificationId: notification.id,
        exnSaid,
        senderAid,
        senderAlias,
        recipientAid,
        challengeId,
        wordsHash,
        strength,
        createdAt,
        status,
    };
};

function* hydrateChallengeRequestNotification({
    client,
    notification,
    contacts,
    localAids,
    loadedAt,
}: {
    client: SignifyClient;
    notification: NotificationRecord;
    contacts: readonly ContactRecord[];
    localAids: ReadonlySet<string>;
    loadedAt: string;
}): EffectionOperation<{
    notification: NotificationRecord;
    unknownChallengeSender: UnknownChallengeSenderNotice | null;
}> {
    const canHydrate =
        notification.route === CHALLENGE_REQUEST_ROUTE ||
        (notification.anchorSaid !== null && notification.route === '/exn');
    if (!canHydrate) {
        return { notification, unknownChallengeSender: null };
    }

    if (notification.anchorSaid === null) {
        return {
            notification: {
                ...notification,
                status: 'error',
                message:
                    'Challenge request notification is missing its EXN SAID.',
            },
            unknownChallengeSender: null,
        };
    }

    try {
        const anchorSaid = notification.anchorSaid;
        const exchange = yield* callPromise(() =>
            client.exchanges().get(anchorSaid)
        );
        if (exchangeRoute(exchange) !== CHALLENGE_REQUEST_ROUTE) {
            return notification.route === CHALLENGE_REQUEST_ROUTE
                ? {
                      notification: {
                          ...notification,
                          status: 'error',
                          message:
                              'Challenge request notification referenced a non-challenge EXN.',
                      },
                      unknownChallengeSender: null,
                  }
                : { notification, unknownChallengeSender: null };
        }

        const provisional = challengeRequestFromExchange({
            notification,
            exchange,
            senderAlias: 'Unknown sender',
            status: 'actionable',
            loadedAt,
        });
        const sender = contactForAid(contacts, provisional.senderAid);
        const recipientAid = exchangeRecipientAid(exchange);
        if (
            isOutboundOrUnrelatedChallengeRequest({
                contacts,
                localAids,
                recipientAid,
                sender,
                senderAid: provisional.senderAid,
            })
        ) {
            if (!notification.read) {
                yield* callPromise(() =>
                    client.notifications().mark(notification.id)
                );
            }

            return {
                notification: {
                    ...notification,
                    read: true,
                    status: 'processed',
                    message:
                        'Challenge request was ignored because it is not inbound to this wallet.',
                    challengeRequest: null,
                },
                unknownChallengeSender: null,
            };
        }

        if (sender === null) {
            if (!notification.read) {
                yield* callPromise(() =>
                    client.notifications().mark(notification.id)
                );
            }

            const challengeRequest = {
                ...provisional,
                status: 'senderUnknown' as const,
            };
            return {
                notification: {
                    ...notification,
                    read: true,
                    status: 'processed',
                    message:
                        'Challenge request sender is not in contacts; notification was marked read.',
                    challengeRequest,
                },
                unknownChallengeSender: notification.read
                    ? null
                    : {
                          notificationId: notification.id,
                          exnSaid: challengeRequest.exnSaid,
                          senderAid: challengeRequest.senderAid,
                          createdAt: challengeRequest.createdAt,
                      },
            };
        }

        const challengeRequest = {
            ...provisional,
            senderAlias: sender.alias,
            status: notification.read ? 'responded' : 'actionable',
        } satisfies ChallengeRequestNotification;

        return {
            notification: {
                ...notification,
                status: notification.read ? 'processed' : 'unread',
                message:
                    notification.message ??
                    `Challenge request from ${sender.alias}`,
                challengeRequest,
            },
            unknownChallengeSender: null,
        };
    } catch (error) {
        const message =
            error instanceof Error
                ? error.message
                : 'Unable to hydrate challenge request notification.';
        return {
            notification: {
                ...notification,
                status: 'error',
                message,
                challengeRequest: null,
            },
            unknownChallengeSender: null,
        };
    }
}

function* hydrateChallengeRequestNotifications({
    client,
    notifications,
    contacts,
    localAids,
    tombstonedExnSaids,
    loadedAt,
}: {
    client: SignifyClient;
    notifications: NotificationRecord[];
    contacts: readonly ContactRecord[];
    localAids: ReadonlySet<string>;
    tombstonedExnSaids: ReadonlySet<string>;
    loadedAt: string;
}): EffectionOperation<{
    notifications: NotificationRecord[];
    unknownChallengeSenders: UnknownChallengeSenderNotice[];
}> {
    const hydrated: NotificationRecord[] = [];
    const unknownChallengeSenders: UnknownChallengeSenderNotice[] = [];

    for (const notification of notifications) {
        const result = yield* hydrateChallengeRequestNotification({
            client,
            notification,
            contacts,
            localAids,
            loadedAt,
        });
        const exnSaid =
            result.notification.challengeRequest?.exnSaid ??
            result.notification.anchorSaid;
        if (exnSaid !== null && tombstonedExnSaids.has(exnSaid)) {
            continue;
        }

        hydrated.push(result.notification);
        if (result.unknownChallengeSender !== null) {
            unknownChallengeSenders.push(result.unknownChallengeSender);
        }
    }

    return { notifications: hydrated, unknownChallengeSenders };
}

const challengeRequestExchangesFromResponse = (raw: unknown): unknown[] =>
    Array.isArray(raw)
        ? raw.filter((item) => {
              try {
                  return exchangeRoute(item) === CHALLENGE_REQUEST_ROUTE;
              } catch {
                  return false;
              }
          })
        : [];

function* listChallengeRequestExchanges({
    client,
}: {
    client: SignifyClient;
}): EffectionOperation<unknown[]> {
    const raw: unknown = yield* callPromise(() =>
        client
            .fetch('/exchanges/query', 'POST', {
                filter: {
                    '-r': CHALLENGE_REQUEST_ROUTE,
                },
                limit: 50,
            })
            .then((response) => response.json())
    );

    return challengeRequestExchangesFromResponse(raw);
}

const syntheticNotificationFromExchange = (
    exchange: unknown,
    loadedAt: string
): NotificationRecord | null => {
    const exn = exchangeExn(exchange);
    const exnSaid = stringValue(exn.d);
    if (exnSaid === null) {
        return null;
    }

    const dt = stringValue(exn.dt) ?? loadedAt;
    return {
        id: syntheticChallengeNotificationId(exnSaid),
        dt,
        read: false,
        route: CHALLENGE_REQUEST_ROUTE,
        anchorSaid: exnSaid,
        status: 'unread',
        message: null,
        challengeRequest: null,
        updatedAt: dt,
    };
};

function* syntheticChallengeRequestNotifications({
    client,
    contacts,
    localAids,
    tombstonedExnSaids,
    loadedAt,
    existingExnSaids,
    respondedChallengeIds,
    respondedWordsHashes,
}: {
    client: SignifyClient;
    contacts: readonly ContactRecord[];
    localAids: ReadonlySet<string>;
    tombstonedExnSaids: ReadonlySet<string>;
    loadedAt: string;
    existingExnSaids: ReadonlySet<string>;
    respondedChallengeIds: ReadonlySet<string>;
    respondedWordsHashes: ReadonlySet<string>;
}): EffectionOperation<{
    notifications: NotificationRecord[];
    unknownChallengeSenders: UnknownChallengeSenderNotice[];
}> {
    const exchanges = yield* listChallengeRequestExchanges({ client });
    const notifications: NotificationRecord[] = [];
    const unknownChallengeSenders: UnknownChallengeSenderNotice[] = [];

    for (const exchange of exchanges) {
        const exnSaid = exchangeSaid(exchange);
        if (
            exnSaid === null ||
            existingExnSaids.has(exnSaid) ||
            tombstonedExnSaids.has(exnSaid)
        ) {
            continue;
        }

        const notification = syntheticNotificationFromExchange(
            exchange,
            loadedAt
        );
        if (notification === null) {
            continue;
        }

        try {
            const provisional = challengeRequestFromExchange({
                notification,
                exchange,
                senderAlias: 'Unknown sender',
                status: 'actionable',
                loadedAt,
            });
            const recipientAid = exchangeRecipientAid(exchange);
            const sender = contactForAid(contacts, provisional.senderAid);
            if (
                isOutboundOrUnrelatedChallengeRequest({
                    contacts,
                    localAids,
                    recipientAid,
                    sender,
                    senderAid: provisional.senderAid,
                })
            ) {
                continue;
            }

            if (sender === null) {
                const challengeRequest = {
                    ...provisional,
                    status: 'senderUnknown' as const,
                };
                notifications.push({
                    ...notification,
                    read: true,
                    status: 'processed',
                    message:
                        'Challenge request sender is not in contacts; synthetic notification was closed.',
                    challengeRequest,
                });
                unknownChallengeSenders.push({
                    notificationId: notification.id,
                    exnSaid: challengeRequest.exnSaid,
                    senderAid: challengeRequest.senderAid,
                    createdAt: challengeRequest.createdAt,
                });
                continue;
            }

            const responded =
                respondedChallengeIds.has(provisional.challengeId) ||
                respondedWordsHashes.has(provisional.wordsHash);
            const challengeRequest = {
                ...provisional,
                senderAlias: sender.alias,
                status: responded ? 'responded' : 'actionable',
            } satisfies ChallengeRequestNotification;
            notifications.push({
                ...notification,
                read: responded,
                status: responded ? 'processed' : 'unread',
                message: `Challenge request from ${sender.alias}`,
                challengeRequest,
            });
        } catch (error) {
            notifications.push({
                ...notification,
                status: 'error',
                message:
                    error instanceof Error
                        ? error.message
                        : 'Unable to hydrate challenge request exchange.',
            });
        }
    }

    return { notifications, unknownChallengeSenders };
}

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
}: {
    client: SignifyClient;
    contacts?: readonly ContactRecord[];
    localAids?: readonly string[];
    tombstonedExnSaids?: readonly string[];
    respondedChallengeIds?: readonly string[];
    respondedWordsHashes?: readonly string[];
}): EffectionOperation<NotificationInventorySnapshot> {
    const raw: unknown = yield* callPromise(() =>
        client.notifications().list()
    );
    const loadedAt = new Date().toISOString();
    const localAidSet = aidSet(localAids);
    const tombstoneSet = aidSet(tombstonedExnSaids);
    const notifications = notificationRecordsFromResponse(raw, loadedAt).filter(
        (notification) =>
            notification.anchorSaid === null ||
            !tombstoneSet.has(notification.anchorSaid)
    );
    const hydrated = yield* hydrateChallengeRequestNotifications({
        client,
        notifications,
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
