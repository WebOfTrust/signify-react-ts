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
import { listNotificationsService } from '../services/notifications.service';
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
import type { AppDispatch } from '../state/store';

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

const publishContactInventory = (
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

/**
 * Load session-scoped contact, challenge, and KERIA notification facts.
 */
export function* syncSessionInventoryOp(): EffectionOperation<SessionInventorySnapshot> {
    const services = yield* AppServicesContext.expect();
    const client = services.runtime.requireConnectedClient();
    const contactInventory = yield* listContactsService({ client });
    const notificationInventory = yield* listNotificationsService({ client });

    publishContactInventory(services.store.dispatch, contactInventory);
    services.store.dispatch(
        notificationInventoryLoaded({
            notifications: notificationInventory.notifications,
            loadedAt: notificationInventory.loadedAt,
        })
    );

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

        yield* sleep(Math.max(250, services.config.operations.liveRefreshMs));
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
