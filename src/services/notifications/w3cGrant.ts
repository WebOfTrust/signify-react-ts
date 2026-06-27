import type { Operation as EffectionOperation } from 'effection';
import type { SignifyClient } from 'signify-ts';
import {
    W3C_GRANT_ROUTE,
    W3CKeriaClient,
    type W3CHeldCredential,
} from '../../integrations/signifyW3c';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import type { W3CVcGrantNotification } from '../../domain/credentials/credentialTypes';
import { callPromise, toErrorText } from '../../effects/promise';
import type { NotificationRecord } from '../../state/notifications.slice';
import {
    exchangeExn,
    requireRecord,
    stringValue,
} from './base';

export const W3C_VC_GRANT_NOTIFICATION_ROUTE = W3C_GRANT_ROUTE;

const timestampText = (
    notification: NotificationRecord,
    exn: Record<string, unknown>,
    loadedAt: string
): string => stringValue(exn.dt) ?? notification.dt ?? loadedAt;

const holderIdentifierForAid = (
    localIdentifiers: readonly IdentifierSummary[],
    holderAid: string
): IdentifierSummary | null =>
    localIdentifiers.find((identifier) => identifier.prefix === holderAid) ??
    null;

const matchesGrantCredential = (
    credential: W3CHeldCredential,
    sourceCredentialSaid: string
): boolean => {
    const credentialId = stringValue(credential.credentialId);
    const credentialSourceSaid = stringValue(credential.sourceCredentialSaid);
    return (
        credentialId === sourceCredentialSaid ||
        credentialSourceSaid === sourceCredentialSaid
    );
};

const heldCredentialIdForGrant = (
    credentials: readonly W3CHeldCredential[],
    sourceCredentialSaid: string
): string | null => {
    const credential =
        credentials.find((candidate) =>
            matchesGrantCredential(candidate, sourceCredentialSaid)
        ) ?? null;
    return credential === null ? null : stringValue(credential.credentialId);
};

const w3cGrantFromExchange = ({
    notification,
    exchange,
    heldCredentialId,
    loadedAt,
    status,
    error = null,
}: {
    notification: NotificationRecord;
    exchange: unknown;
    heldCredentialId: string | null;
    loadedAt: string;
    status: W3CVcGrantNotification['status'];
    error?: string | null;
}): W3CVcGrantNotification => {
    const exn = exchangeExn(exchange);
    const attrs = requireRecord(exn.a, 'W3C VC-JWT grant payload');
    const grantSaid = stringValue(exn.d) ?? notification.anchorSaid;
    const issuerAid = stringValue(attrs.issuerAid);
    const issuerDid = stringValue(attrs.issuerDid);
    const holderAid = stringValue(attrs.holderAid);
    const holderDid = stringValue(attrs.holderDid);
    const sourceCredentialSaid = stringValue(attrs.sourceCredentialSaid);
    const schemaSaid = stringValue(attrs.schemaSaid);
    const issuanceId = stringValue(attrs.issuanceId);
    const profile = stringValue(attrs.profile);
    const statusUrl = stringValue(attrs.statusUrl);
    const vcJwt = stringValue(attrs.vcJwt);

    if (
        grantSaid === null ||
        issuerAid === null ||
        issuerDid === null ||
        holderAid === null ||
        holderDid === null ||
        sourceCredentialSaid === null ||
        schemaSaid === null ||
        issuanceId === null ||
        profile === null ||
        statusUrl === null ||
        vcJwt === null
    ) {
        throw new Error('W3C VC-JWT grant payload is missing required fields.');
    }

    return {
        notificationId: notification.id,
        grantSaid,
        issuerAid,
        issuerDid,
        holderAid,
        holderDid,
        sourceCredentialSaid,
        schemaSaid,
        issuanceId,
        profile,
        statusUrl,
        vcJwt,
        heldCredentialId,
        createdAt: timestampText(notification, exn, loadedAt),
        status,
        error,
    };
};

function* hydrateW3CVcGrantNotification({
    client,
    notification,
    localAids,
    localIdentifiers,
    loadedAt,
}: {
    client: SignifyClient;
    notification: NotificationRecord;
    localAids: ReadonlySet<string>;
    localIdentifiers: readonly IdentifierSummary[];
    loadedAt: string;
}): EffectionOperation<NotificationRecord> {
    if (notification.route !== W3C_VC_GRANT_NOTIFICATION_ROUTE) {
        return notification;
    }

    if (notification.anchorSaid === null) {
        return {
            ...notification,
            status: 'error',
            message: 'W3C VC-JWT grant notification is missing its EXN SAID.',
        };
    }

    try {
        const exchange = yield* callPromise(() =>
            client.exchanges().get(notification.anchorSaid as string)
        );
        const exn = exchangeExn(exchange);
        if (stringValue(exn.r) !== W3C_VC_GRANT_NOTIFICATION_ROUTE) {
            return {
                ...notification,
                status: 'error',
                message:
                    'W3C VC-JWT grant notification referenced a non-W3C grant EXN.',
            };
        }

        const attrs = requireRecord(exn.a, 'W3C VC-JWT grant payload');
        const holderAid = stringValue(attrs.holderAid);
        const sourceCredentialSaid = stringValue(attrs.sourceCredentialSaid);
        if (holderAid === null || sourceCredentialSaid === null) {
            throw new Error(
                'W3C VC-JWT grant payload is missing holder or credential identifiers.'
            );
        }

        if (!localAids.has(holderAid)) {
            if (!notification.read) {
                yield* callPromise(() =>
                    client.notifications().mark(notification.id)
                );
            }

            return {
                ...notification,
                read: true,
                status: 'processed',
                message: 'W3C VC-JWT grant is not addressed to this wallet.',
                w3cVcGrant: w3cGrantFromExchange({
                    notification,
                    exchange,
                    heldCredentialId: null,
                    loadedAt,
                    status: 'notForThisWallet',
                }),
            };
        }

        const holderIdentifier = holderIdentifierForAid(
            localIdentifiers,
            holderAid
        );
        const heldCredentials =
            holderIdentifier === null
                ? []
                : yield* callPromise(() =>
                      new W3CKeriaClient(client).credentials(
                          holderIdentifier.name
                      )
                  );
        const heldCredentialId = heldCredentialIdForGrant(
            heldCredentials,
            sourceCredentialSaid
        );
        const grantStatus =
            heldCredentialId === null ? 'received' : 'materialized';
        const grant = w3cGrantFromExchange({
            notification,
            exchange,
            heldCredentialId,
            loadedAt,
            status: grantStatus,
        });

        return {
            ...notification,
            status: notification.read ? 'processed' : 'unread',
            message:
                grantStatus === 'materialized'
                    ? `W3C VC-JWT grant materialized from ${grant.issuerAid}`
                    : `W3C VC-JWT grant received from ${grant.issuerAid}`,
            w3cVcGrant: grant,
        };
    } catch (error) {
        return {
            ...notification,
            status: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Unable to hydrate W3C VC-JWT grant notification.',
            w3cVcGrant:
                notification.anchorSaid === null
                    ? null
                    : {
                          notificationId: notification.id,
                          grantSaid: notification.anchorSaid,
                          issuerAid: 'unknown',
                          issuerDid: 'unknown',
                          holderAid: 'unknown',
                          holderDid: 'unknown',
                          sourceCredentialSaid: 'unknown',
                          schemaSaid: 'unknown',
                          issuanceId: 'unknown',
                          profile: 'unknown',
                          statusUrl: 'unknown',
                          vcJwt: '',
                          heldCredentialId: null,
                          createdAt: notification.dt ?? loadedAt,
                          status: 'error',
                          error: toErrorText(error),
                      },
        };
    }
}

export function* hydrateW3CVcGrantNotifications({
    client,
    notifications,
    localAids,
    localIdentifiers = [],
    loadedAt,
}: {
    client: SignifyClient;
    notifications: NotificationRecord[];
    localAids: ReadonlySet<string>;
    localIdentifiers?: readonly IdentifierSummary[];
    loadedAt: string;
}): EffectionOperation<NotificationRecord[]> {
    const hydrated: NotificationRecord[] = [];

    for (const notification of notifications) {
        hydrated.push(
            yield* hydrateW3CVcGrantNotification({
                client,
                notification,
                localAids,
                localIdentifiers,
                loadedAt,
            })
        );
    }

    return hydrated;
}
