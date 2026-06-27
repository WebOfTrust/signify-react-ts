import { describe, expect, it, vi } from 'vitest';
import type { SignifyClient } from 'signify-ts';
import { createAppRuntime } from '../../../src/app/runtime';
import {
    listNotificationsService,
    W3C_VC_GRANT_NOTIFICATION_ROUTE,
} from '../../../src/services/notifications.service';
import type { IdentifierSummary } from '../../../src/domain/identifiers/identifierTypes';
import { loadedAt } from './helpers';

const w3cGrantExchange = {
    exn: {
        d: 'Ew3cgrant',
        i: 'Eissuer',
        rp: 'Eholder',
        dt: loadedAt,
        r: W3C_VC_GRANT_NOTIFICATION_ROUTE,
        a: {
            holderAid: 'Eholder',
            holderDid: 'did:webs:example.com:dws:Eholder',
            issuerAid: 'Eissuer',
            issuerDid: 'did:webs:example.com:dws:Eissuer',
            sourceCredentialSaid: 'Ecredential',
            schemaSaid: 'Eschema',
            issuanceId: 'issuance-1',
            vcJwt: 'vc.jwt.token',
            statusUrl: 'http://127.0.0.1:3901/status/Ecredential',
            profile: 'gleif-vrd-isomer-v1',
        },
    },
};

const holderIdentifier = {
    name: 'holder',
    prefix: 'Eholder',
} as IdentifierSummary;

const makeW3CClient = ({
    rawNotifications,
    exchange = w3cGrantExchange,
    credentials = [],
}: {
    rawNotifications: unknown;
    exchange?: unknown;
    credentials?: unknown[];
}) => {
    const notifications = {
        list: vi.fn(async () => rawNotifications),
        mark: vi.fn(async () => ''),
        delete: vi.fn(async () => undefined),
    };
    const exchanges = {
        get: vi.fn(async () => exchange),
    };
    const client = {
        notifications: () => notifications,
        exchanges: () => exchanges,
        groups: () => ({
            getRequest: vi.fn(async () => []),
        }),
        fetch: vi.fn(async (path: string) => ({
            json: async () =>
                path.includes('/w3c/credentials') ? { credentials } : [],
        })),
    } as unknown as SignifyClient;

    return { client, notifications, exchanges };
};

const runW3CNotifications = async ({
    client,
    localAids = ['Eholder'],
    localIdentifiers = [holderIdentifier],
}: {
    client: SignifyClient;
    localAids?: string[];
    localIdentifiers?: IdentifierSummary[];
}) => {
    const runtime = createAppRuntime({ storage: null });
    try {
        return await runtime.runWorkflow(
            () =>
                listNotificationsService({
                    client,
                    localAids,
                    localIdentifiers,
                }),
            { scope: 'app', track: false }
        );
    } finally {
        await runtime.destroy();
    }
};

const note = {
    i: 'w3c-note-1',
    dt: loadedAt,
    r: false,
    a: {
        r: W3C_VC_GRANT_NOTIFICATION_ROUTE,
        d: 'Ew3cgrant',
    },
};

describe('W3C VC-JWT grant notification hydration', () => {
    it('hydrates local holder grants before materialization completes', async () => {
        const { client } = makeW3CClient({
            rawNotifications: { notes: [note] },
            credentials: [],
        });

        const snapshot = await runW3CNotifications({ client });

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'w3c-note-1',
                read: false,
                status: 'unread',
                message: 'W3C VC-JWT grant received from Eissuer',
                w3cVcGrant: expect.objectContaining({
                    notificationId: 'w3c-note-1',
                    grantSaid: 'Ew3cgrant',
                    issuerAid: 'Eissuer',
                    holderAid: 'Eholder',
                    sourceCredentialSaid: 'Ecredential',
                    heldCredentialId: null,
                    vcJwt: 'vc.jwt.token',
                    status: 'received',
                }),
            }),
        ]);
    });

    it('marks local holder grants materialized when the held W3C credential exists', async () => {
        const { client } = makeW3CClient({
            rawNotifications: { notes: [note] },
            credentials: [
                {
                    credentialId: 'Ecredential',
                    sourceCredentialSaid: 'Ecredential',
                },
            ],
        });

        const snapshot = await runW3CNotifications({ client });

        expect(snapshot.notifications[0]).toEqual(
            expect.objectContaining({
                message: 'W3C VC-JWT grant materialized from Eissuer',
                w3cVcGrant: expect.objectContaining({
                    heldCredentialId: 'Ecredential',
                    status: 'materialized',
                }),
            })
        );
    });

    it('marks non-local holder grants read', async () => {
        const { client, notifications } = makeW3CClient({
            rawNotifications: { notes: [note] },
        });

        const snapshot = await runW3CNotifications({
            client,
            localAids: ['Eother'],
            localIdentifiers: [],
        });

        expect(notifications.mark).toHaveBeenCalledWith('w3c-note-1');
        expect(snapshot.notifications[0]).toEqual(
            expect.objectContaining({
                read: true,
                status: 'processed',
                message: 'W3C VC-JWT grant is not addressed to this wallet.',
                w3cVcGrant: expect.objectContaining({
                    status: 'notForThisWallet',
                }),
            })
        );
    });

    it('reports an error when the notification has no anchor SAID', async () => {
        const { client } = makeW3CClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'w3c-note-missing-anchor',
                        dt: loadedAt,
                        r: false,
                        a: { r: W3C_VC_GRANT_NOTIFICATION_ROUTE },
                    },
                ],
            },
        });

        const snapshot = await runW3CNotifications({ client });

        expect(snapshot.notifications[0]).toEqual(
            expect.objectContaining({
                status: 'error',
                message:
                    'W3C VC-JWT grant notification is missing its EXN SAID.',
            })
        );
    });

    it('reports malformed grant payloads as errors', async () => {
        const { client } = makeW3CClient({
            rawNotifications: { notes: [note] },
            exchange: {
                exn: {
                    d: 'Ew3cgrant',
                    r: W3C_VC_GRANT_NOTIFICATION_ROUTE,
                    a: {
                        holderAid: 'Eholder',
                    },
                },
            },
        });

        const snapshot = await runW3CNotifications({ client });

        expect(snapshot.notifications[0]).toEqual(
            expect.objectContaining({
                status: 'error',
                w3cVcGrant: expect.objectContaining({
                    status: 'error',
                    grantSaid: 'Ew3cgrant',
                }),
            })
        );
    });
});
