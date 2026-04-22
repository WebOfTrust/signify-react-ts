import { sleep, type Operation as EffectionOperation } from 'effection';
import { toErrorText } from '../effects/promise';
import { AppServicesContext } from '../effects/contexts';
import {
    aliasForOobiResolution,
    pendingContactIdForOobi,
} from '../features/contacts/contactHelpers';
import {
    deleteContactService,
    generateIdentifierOobiService,
    listContactsService,
    resolveContactOobiService,
    updateContactAliasService,
    type ContactInventorySnapshot,
    type OobiRole,
    type ResolveContactInput,
    type ResolveContactResult,
} from '../services/contacts.service';
import {
    listNotificationsService,
    type NotificationInventorySnapshot,
} from '../services/notifications.service';
import { appNotificationRecorded } from '../state/appNotifications.slice';
import { challengesLoaded } from '../state/challenges.slice';
import {
    contactDeleted,
    contactInventoryLoaded,
    contactResolutionFailed,
    contactResolutionStarted,
    generatedOobiRecorded,
    type GeneratedOobiRecord,
} from '../state/contacts.slice';
import { notificationInventoryLoaded } from '../state/notifications.slice';
import type { AppDispatch, AppStore } from '../state/store';
import type { ChallengeRecord } from '../state/challenges.slice';

export interface GenerateOobiInput {
    identifier: string;
    role: OobiRole;
}

export interface UpdateContactAliasInput {
    contactId: string;
    alias: string;
}

export interface SessionInventorySnapshot extends ContactInventorySnapshot {
    notificationsLoadedAt: string;
}

export const publishContactInventory = (
    dispatch: AppDispatch,
    inventory: ContactInventorySnapshot
): void => {
    dispatch(
        contactInventoryLoaded({
            contacts: inventory.contacts,
            loadedAt: inventory.loadedAt,
        })
    );
    dispatch(
        challengesLoaded({
            challenges: inventory.challenges,
            loadedAt: inventory.loadedAt,
        })
    );
};

export const publishNotificationInventory = (
    store: Pick<AppStore, 'dispatch' | 'getState'>,
    inventory: NotificationInventorySnapshot
): void => {
    store.dispatch(
        notificationInventoryLoaded({
            notifications: inventory.notifications,
            loadedAt: inventory.loadedAt,
        })
    );

    for (const unknownSender of inventory.unknownChallengeSenders) {
        const id = `challenge-sender-unknown:${unknownSender.notificationId}`;
        if (store.getState().appNotifications.byId[id] !== undefined) {
            continue;
        }

        store.dispatch(
            appNotificationRecorded({
                id,
                severity: 'warning',
                status: 'unread',
                title: 'Challenge request sender unknown',
                message:
                    'A challenge request came from an AID that is not in contacts. The KERIA notification was marked read.',
                createdAt: unknownSender.createdAt,
                readAt: null,
                operationId: null,
                links: [
                    {
                        rel: 'result',
                        label: 'View notifications',
                        path: '/notifications',
                    },
                ],
                payloadDetails: [
                    {
                        id: 'sender-aid',
                        label: 'Sender AID',
                        value: unknownSender.senderAid,
                        kind: 'aid',
                        copyable: true,
                    },
                    {
                        id: 'exchange-said',
                        label: 'EXN SAID',
                        value: unknownSender.exnSaid,
                        kind: 'text',
                        copyable: true,
                    },
                ],
            })
        );
    }
};

export const localIdentifierAids = (
    store: Pick<AppStore, 'getState'>
): string[] => {
    const { identifiers } = store.getState();
    const aids = identifiers.prefixes.flatMap((prefix) => {
        const identifier = identifiers.byPrefix[prefix];
        const aid = identifier?.prefix ?? prefix;
        return aid.trim().length > 0 ? [aid] : [];
    });

    return [...new Set(aids)];
};

const respondedChallengeKeys = (
    store: Pick<AppStore, 'getState'>,
    inventory: ContactInventorySnapshot
): {
    ids: string[];
    wordsHashes: string[];
} => {
    const allChallenges = [
        ...Object.values(store.getState().challenges.byId),
        ...inventory.challenges,
    ].filter(
        (challenge): challenge is ChallengeRecord => challenge !== undefined
    );
    const responded = allChallenges.filter(
        (challenge) =>
            challenge.status === 'responded' || challenge.status === 'verified'
    );

    return {
        ids: responded.map((challenge) => challenge.id),
        wordsHashes: responded.flatMap((challenge) =>
            challenge.wordsHash === undefined || challenge.wordsHash === null
                ? []
                : [challenge.wordsHash]
        ),
    };
};

/**
 * Load session-scoped contact, challenge, and KERIA notification facts.
 */
export function* syncSessionInventoryOp(): EffectionOperation<SessionInventorySnapshot> {
    const services = yield* AppServicesContext.expect();
    const client = services.runtime.requireConnectedClient();
    const contactInventory = yield* listContactsService({ client });
    const responded = respondedChallengeKeys(services.store, contactInventory);
    const notificationInventory = yield* listNotificationsService({
        client,
        contacts: contactInventory.contacts,
        localAids: localIdentifierAids(services.store),
        respondedChallengeIds: responded.ids,
        respondedWordsHashes: responded.wordsHashes,
    });

    publishContactInventory(services.store.dispatch, contactInventory);
    publishNotificationInventory(services.store, notificationInventory);

    return {
        ...contactInventory,
        notificationsLoadedAt: notificationInventory.loadedAt,
    };
}

/**
 * Session-scoped live polling loop for dashboard/contact inventory.
 */
export function* liveSessionInventoryOp(): EffectionOperation<void> {
    const services = yield* AppServicesContext.expect();
    let consecutiveFailures = 0;
    let warned = false;
    let keepPolling = true;

    while (keepPolling) {
        try {
            yield* syncSessionInventoryOp();
            consecutiveFailures = 0;
        } catch (error) {
            consecutiveFailures += 1;
            if (consecutiveFailures >= 3 && !warned) {
                warned = true;
                const createdAt = new Date().toISOString();
                services.store.dispatch(
                    appNotificationRecorded({
                        id: `live-sync-${createdAt}`,
                        severity: 'warning',
                        status: 'unread',
                        title: 'Live inventory sync stalled',
                        message: toErrorText(error),
                        createdAt,
                        readAt: null,
                        operationId: null,
                        links: [],
                        payloadDetails: [],
                    })
                );
            }
        }

        yield* sleep(
            Math.max(
                3000,
                Math.min(5000, services.config.operations.liveRefreshMs)
            )
        );
    }
}

/**
 * Generate a local identifier OOBI and record it for display.
 */
export function* generateOobiOp(
    input: GenerateOobiInput
): EffectionOperation<GeneratedOobiRecord> {
    const services = yield* AppServicesContext.expect();
    const record = yield* generateIdentifierOobiService({
        client: services.runtime.requireConnectedClient(),
        identifier: input.identifier,
        role: input.role,
        logger: services.logger,
    });

    services.store.dispatch(generatedOobiRecorded(record));
    return record;
}

/**
 * Resolve one OOBI and refresh contact/challenge inventory.
 */
export function* resolveContactOobiOp(
    input: ResolveContactInput
): EffectionOperation<ResolveContactResult> {
    const services = yield* AppServicesContext.expect();
    const alias = aliasForOobiResolution(input.oobi, input.alias);
    const pendingId = pendingContactIdForOobi(input.oobi, input.alias);
    const updatedAt = new Date().toISOString();

    services.store.dispatch(
        contactResolutionStarted({
            id: pendingId,
            alias: alias ?? 'Resolving contact',
            oobi: input.oobi.trim(),
            updatedAt,
        })
    );

    try {
        const result = yield* resolveContactOobiService({
            client: services.runtime.requireConnectedClient(),
            input,
            logger: services.logger,
        });
        services.store.dispatch(contactDeleted({ id: pendingId }));
        publishContactInventory(services.store.dispatch, result);
        return result;
    } catch (error) {
        services.store.dispatch(
            contactResolutionFailed({
                id: pendingId,
                error: toErrorText(error),
                updatedAt: new Date().toISOString(),
            })
        );
        throw error;
    }
}

/**
 * Delete one contact and refresh inventory.
 */
export function* deleteContactOp(
    contactId: string
): EffectionOperation<ContactInventorySnapshot> {
    const services = yield* AppServicesContext.expect();
    const inventory = yield* deleteContactService({
        client: services.runtime.requireConnectedClient(),
        contactId,
    });

    publishContactInventory(services.store.dispatch, inventory);
    return inventory;
}

/**
 * Update one contact alias and refresh inventory.
 */
export function* updateContactAliasOp(
    input: UpdateContactAliasInput
): EffectionOperation<ContactInventorySnapshot> {
    const services = yield* AppServicesContext.expect();
    const inventory = yield* updateContactAliasService({
        client: services.runtime.requireConnectedClient(),
        contactId: input.contactId,
        alias: input.alias,
    });

    publishContactInventory(services.store.dispatch, inventory);
    return inventory;
}
