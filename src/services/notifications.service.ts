import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import { callPromise } from '../effects/promise';
import type { NotificationRecord } from '../state/notifications.slice';

export interface NotificationInventorySnapshot {
    notifications: NotificationRecord[];
    loadedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;

const notificationRecordsFromResponse = (
    raw: unknown,
    loadedAt: string
): NotificationRecord[] => {
    if (!Array.isArray(raw)) {
        return [];
    }

    return raw.flatMap((item) => {
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

        return [
            {
                id,
                dt,
                read,
                route,
                anchorSaid: stringValue(attrs.d),
                status: read ? 'processed' : 'unread',
                message: stringValue(attrs.m),
                updatedAt: dt ?? loadedAt,
            },
        ];
    });
};

/**
 * Load KERIA protocol notifications without mixing them with local app notices.
 */
export function* listNotificationsService({
    client,
}: {
    client: SignifyClient;
}): EffectionOperation<NotificationInventorySnapshot> {
    const raw: unknown = yield* callPromise(() => client.notifications().list());
    const loadedAt = new Date().toISOString();
    return {
        notifications: notificationRecordsFromResponse(raw, loadedAt),
        loadedAt,
    };
}

/**
 * Mark a KERIA protocol notification read, then return refreshed inventory.
 */
export function* markNotificationReadService({
    client,
    notificationId,
}: {
    client: SignifyClient;
    notificationId: string;
}): EffectionOperation<NotificationInventorySnapshot> {
    yield* callPromise(() => client.notifications().mark(notificationId));
    return yield* listNotificationsService({ client });
}

/**
 * Delete a KERIA protocol notification, then return refreshed inventory.
 */
export function* deleteNotificationService({
    client,
    notificationId,
}: {
    client: SignifyClient;
    notificationId: string;
}): EffectionOperation<NotificationInventorySnapshot> {
    yield* callPromise(() => client.notifications().delete(notificationId));
    return yield* listNotificationsService({ client });
}
