import type { Operation as EffectionOperation } from 'effection';
import { callPromise } from '../effects/promise';
import { AppServicesContext } from '../effects/contexts';
import { isSyntheticExchangeNotificationId } from '../services/notifications.service';
import { exchangeTombstoneRecorded } from '../state/exchangeTombstones.slice';
import { syncSessionInventoryOp } from './contacts.op';

/**
 * Workflow command for hiding an exchange-backed notification from app UI.
 */
export interface DismissExchangeNotificationInput {
    notificationId: string;
    exnSaid: string;
    route: string;
}

const requireNonEmpty = (value: string, label: string): string => {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error(`${label} is required.`);
    }

    return normalized;
};

/**
 * Tombstone a synthetic/real exchange notification and best-effort delete it.
 */
export function* dismissExchangeNotificationOp(
    input: DismissExchangeNotificationInput
): EffectionOperation<void> {
    const services = yield* AppServicesContext.expect();
    const client = services.runtime.requireConnectedClient();
    const notificationId = requireNonEmpty(
        input.notificationId,
        'Notification id'
    );
    const exnSaid = requireNonEmpty(input.exnSaid, 'EXN SAID');
    const route = requireNonEmpty(input.route, 'Route');
    const createdAt = new Date().toISOString();

    services.store.dispatch(
        exchangeTombstoneRecorded({
            exnSaid,
            route,
            notificationId,
            reason: 'userDismissed',
            createdAt,
        })
    );

    if (!isSyntheticExchangeNotificationId(notificationId)) {
        try {
            yield* callPromise(() =>
                client.notifications().delete(notificationId)
            );
        } catch {
            // Tombstones are authoritative local UI state; KERIA deletion is
            // only a best-effort cleanup for real notification notes.
        }
    }

    try {
        yield* syncSessionInventoryOp();
    } catch {
        // The live sync loop will retry. The tombstone above is enough for
        // immediate local suppression even when the refresh is unavailable.
    }
}
