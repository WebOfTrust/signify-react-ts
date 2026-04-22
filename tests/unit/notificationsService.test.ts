import { describe, expect, it, vi } from 'vitest';
import type { SignifyClient } from 'signify-ts';
import { createAppRuntime } from '../../src/app/runtime';
import {
    CHALLENGE_REQUEST_ROUTE,
    CHALLENGE_TOPIC,
} from '../../src/services/challenges.service';
import {
    challengeRequestFromExchange,
    DELEGATION_REQUEST_NOTIFICATION_ROUTE,
    listNotificationsService,
    notificationRecordsFromResponse,
} from '../../src/services/notifications.service';
import type { ContactRecord } from '../../src/state/contacts.slice';

const loadedAt = '2026-04-22T00:00:00.000Z';

const contact = {
    id: 'Esender',
    alias: 'Alice',
    aid: 'Esender',
    oobi: null,
    endpoints: [],
    wellKnowns: [],
    componentTags: [],
    challengeCount: 0,
    authenticatedChallengeCount: 0,
    resolutionStatus: 'resolved',
    error: null,
    updatedAt: loadedAt,
} satisfies ContactRecord;

const challengeExchange = {
    exn: {
        d: 'Eexn',
        i: 'Esender',
        rp: 'Erecipient',
        dt: loadedAt,
        r: CHALLENGE_REQUEST_ROUTE,
        a: {
            i: 'Erecipient',
            challengeId: 'challenge-1',
            wordsHash: 'hash-one',
            strength: 128,
        },
    },
};

const makeClient = ({
    rawNotifications,
    exchange = challengeExchange,
    queryExchanges = [],
}: {
    rawNotifications: unknown;
    exchange?: unknown;
    queryExchanges?: unknown[];
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
        fetch: vi.fn(async () => ({
            json: async () => queryExchanges,
        })),
    } as unknown as SignifyClient;

    return { client, notifications, exchanges };
};

const runListNotifications = async (
    client: SignifyClient,
    contacts: readonly ContactRecord[] = [],
    localAids: readonly string[] = [],
    tombstonedExnSaids: readonly string[] = []
) => {
    const runtime = createAppRuntime({ storage: null });
    try {
        return await runtime.runWorkflow(
            () =>
                listNotificationsService({
                    client,
                    contacts,
                    localAids,
                    tombstonedExnSaids,
                }),
            { scope: 'app', track: false }
        );
    } finally {
        await runtime.destroy();
    }
};

describe('notification service helpers', () => {
    it('normalizes Signify notification responses that wrap notes', () => {
        expect(
            notificationRecordsFromResponse(
                {
                    notes: [
                        {
                            i: 'note-1',
                            dt: loadedAt,
                            r: false,
                            a: {
                                r: CHALLENGE_REQUEST_ROUTE,
                                d: 'Eexn',
                                m: 'message',
                            },
                        },
                    ],
                },
                loadedAt
            )
        ).toEqual([
            expect.objectContaining({
                id: 'note-1',
                read: false,
                route: CHALLENGE_REQUEST_ROUTE,
                anchorSaid: 'Eexn',
                status: 'unread',
                message: 'message',
            }),
        ]);
    });

    it('parses challenge request EXNs without raw challenge words', () => {
        const [notification] = notificationRecordsFromResponse(
            [
                {
                    i: 'note-1',
                    dt: loadedAt,
                    r: false,
                    a: { r: CHALLENGE_REQUEST_ROUTE, d: 'Eexn' },
                },
            ],
            loadedAt
        );

        expect(
            challengeRequestFromExchange({
                notification,
                exchange: challengeExchange,
                senderAlias: 'Alice',
                status: 'actionable',
                loadedAt,
            })
        ).toEqual({
            notificationId: 'note-1',
            exnSaid: 'Eexn',
            senderAid: 'Esender',
            senderAlias: 'Alice',
            recipientAid: 'Erecipient',
            challengeId: 'challenge-1',
            wordsHash: 'hash-one',
            strength: 128,
            createdAt: loadedAt,
            status: 'actionable',
        });
        expect(JSON.stringify(challengeExchange)).not.toContain('"words":');
        expect(CHALLENGE_TOPIC).toBe('challenge');
    });

    it('hydrates known challenge request senders as actionable', async () => {
        const { client, exchanges } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'note-1',
                        dt: loadedAt,
                        r: false,
                        a: { r: '/exn', d: 'Eexn' },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(client, [contact]);

        expect(exchanges.get).toHaveBeenCalledWith('Eexn');
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'note-1',
                status: 'unread',
                challengeRequest: expect.objectContaining({
                    senderAlias: 'Alice',
                    status: 'actionable',
                    wordsHash: 'hash-one',
                }),
            }),
        ]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('hydrates challenge requests from exchange query when no KERIA note exists', async () => {
        const { client, exchanges } = makeClient({
            rawNotifications: { notes: [] },
            queryExchanges: [challengeExchange],
        });

        const snapshot = await runListNotifications(client, [contact]);

        expect(exchanges.get).not.toHaveBeenCalled();
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'challenge-request:Eexn',
                route: CHALLENGE_REQUEST_ROUTE,
                status: 'unread',
                challengeRequest: expect.objectContaining({
                    notificationId: 'challenge-request:Eexn',
                    senderAlias: 'Alice',
                    status: 'actionable',
                }),
            }),
        ]);
    });

    it('filters tombstoned synthetic challenge request exchanges', async () => {
        const { client } = makeClient({
            rawNotifications: { notes: [] },
            queryExchanges: [challengeExchange],
        });

        const snapshot = await runListNotifications(
            client,
            [contact],
            [],
            ['Eexn']
        );

        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('filters KERIA notifications with tombstoned anchors before hydration', async () => {
        const { client, exchanges } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'note-1',
                        dt: loadedAt,
                        r: false,
                        a: { r: '/exn', d: 'Eexn' },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(
            client,
            [contact],
            [],
            ['Eexn']
        );

        expect(exchanges.get).not.toHaveBeenCalled();
        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('filters hydrated KERIA challenge requests with tombstoned EXN SAIDs', async () => {
        const { client, exchanges } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'note-1',
                        dt: loadedAt,
                        r: false,
                        a: { r: '/exn', d: 'Eanchor' },
                    },
                ],
            },
            exchange: challengeExchange,
        });

        const snapshot = await runListNotifications(
            client,
            [contact],
            [],
            ['Eexn']
        );

        expect(exchanges.get).toHaveBeenCalledWith('Eanchor');
        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('ignores locally-authored challenge request exchanges', async () => {
        const outboundExchange = {
            exn: {
                d: 'Eoutbound',
                i: 'Erecipient',
                rp: 'Esender',
                dt: loadedAt,
                r: CHALLENGE_REQUEST_ROUTE,
                a: {
                    i: 'Esender',
                    challengeId: 'challenge-outbound',
                    wordsHash: 'hash-outbound',
                    strength: 128,
                },
            },
        };
        const { client } = makeClient({
            rawNotifications: { notes: [] },
            queryExchanges: [outboundExchange],
        });

        const snapshot = await runListNotifications(
            client,
            [contact],
            ['Erecipient']
        );

        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('does not warn for outbound challenge requests before local identifiers are loaded', async () => {
        const outboundExchange = {
            exn: {
                d: 'Eoutbound',
                i: 'Erecipient',
                rp: 'Esender',
                dt: loadedAt,
                r: CHALLENGE_REQUEST_ROUTE,
                a: {
                    i: 'Esender',
                    challengeId: 'challenge-outbound',
                    wordsHash: 'hash-outbound',
                    strength: 128,
                },
            },
        };
        const { client } = makeClient({
            rawNotifications: { notes: [] },
            queryExchanges: [outboundExchange],
        });

        const snapshot = await runListNotifications(client, [contact]);

        expect(snapshot.notifications).toEqual([]);
        expect(snapshot.unknownChallengeSenders).toEqual([]);
    });

    it('marks unknown challenge request senders read and reports one notice', async () => {
        const { client, notifications } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'note-1',
                        dt: loadedAt,
                        r: false,
                        a: { r: '/exn', d: 'Eexn' },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(client, []);

        expect(notifications.mark).toHaveBeenCalledWith('note-1');
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'note-1',
                read: true,
                status: 'processed',
                challengeRequest: expect.objectContaining({
                    senderAid: 'Esender',
                    status: 'senderUnknown',
                }),
            }),
        ]);
        expect(snapshot.unknownChallengeSenders).toEqual([
            {
                notificationId: 'note-1',
                exnSaid: 'Eexn',
                senderAid: 'Esender',
                createdAt: loadedAt,
            },
        ]);
    });

    it('hydrates direct delegation requests as actionable for local delegators', async () => {
        const { client } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'delegate-note-1',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: DELEGATION_REQUEST_NOTIFICATION_ROUTE,
                            delpre: 'Edelegator',
                            src: 'Edelegate',
                            ked: {
                                t: 'dip',
                                i: 'Edelegate',
                                s: '0',
                                d: 'Edelegate-event',
                                di: 'Edelegator',
                            },
                        },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(client, [], ['Edelegator']);

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'delegate-note-1',
                route: DELEGATION_REQUEST_NOTIFICATION_ROUTE,
                status: 'unread',
                delegationRequest: {
                    notificationId: 'delegate-note-1',
                    delegatorAid: 'Edelegator',
                    delegateAid: 'Edelegate',
                    delegateEventSaid: 'Edelegate-event',
                    sequence: '0',
                    anchor: {
                        i: 'Edelegate',
                        s: '0',
                        d: 'Edelegate-event',
                    },
                    sourceAid: 'Edelegate',
                    createdAt: loadedAt,
                    status: 'actionable',
                },
            }),
        ]);
    });

    it('does not hydrate delegation requests from generic exchange notifications', async () => {
        const { client } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'delegate-exn-note',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: '/exn',
                            d: 'Edelegate-exn',
                        },
                    },
                ],
            },
            exchange: {
                exn: {
                    d: 'Edelegate-exn',
                    i: 'Edelegate',
                    dt: loadedAt,
                    r: DELEGATION_REQUEST_NOTIFICATION_ROUTE,
                    a: {
                        delpre: 'Edelegator',
                    },
                    e: {
                        evt: {
                            t: 'dip',
                            i: 'Edelegate',
                            s: '0',
                            d: 'Edelegate-event',
                            di: 'Edelegator',
                        },
                    },
                },
            },
        });

        const snapshot = await runListNotifications(client, [], ['Edelegator']);

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'delegate-exn-note',
                route: '/exn',
                status: 'unread',
                delegationRequest: null,
            }),
        ]);
    });

    it('marks delegation requests read when the delegator is not local', async () => {
        const { client, notifications } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'delegate-note-2',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: DELEGATION_REQUEST_NOTIFICATION_ROUTE,
                            delpre: 'Edelegator',
                            ked: {
                                t: 'drt',
                                i: 'Edelegate',
                                s: '1',
                                d: 'Edelegate-rotation',
                                di: 'Edelegator',
                            },
                        },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(client, [], ['Eother']);

        expect(notifications.mark).toHaveBeenCalledWith('delegate-note-2');
        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'delegate-note-2',
                read: true,
                status: 'processed',
                delegationRequest: expect.objectContaining({
                    delegatorAid: 'Edelegator',
                    delegateAid: 'Edelegate',
                    delegateEventSaid: 'Edelegate-rotation',
                    sequence: '1',
                    status: 'notForThisWallet',
                }),
            }),
        ]);
    });

    it('reports malformed delegation request payloads', async () => {
        const { client } = makeClient({
            rawNotifications: {
                notes: [
                    {
                        i: 'delegate-note-3',
                        dt: loadedAt,
                        r: false,
                        a: {
                            r: DELEGATION_REQUEST_NOTIFICATION_ROUTE,
                            delpre: 'Edelegator',
                        },
                    },
                ],
            },
        });

        const snapshot = await runListNotifications(client, [], ['Edelegator']);

        expect(snapshot.notifications).toEqual([
            expect.objectContaining({
                id: 'delegate-note-3',
                status: 'error',
                delegationRequest: null,
                message: expect.stringContaining('Delegation event'),
            }),
        ]);
    });
});
