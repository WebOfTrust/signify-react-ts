import { describe, expect, it, vi } from 'vitest';
import type { SignifyClient } from 'signify-ts';
import { createAppRuntime } from '../../src/app/runtime';
import {
    CHALLENGE_REQUEST_ROUTE,
    CHALLENGE_TOPIC,
} from '../../src/services/challenges.service';
import {
    challengeRequestFromExchange,
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
    localAids: readonly string[] = []
) => {
    const runtime = createAppRuntime({ storage: null });
    try {
        return await runtime.runWorkflow(
            () => listNotificationsService({ client, contacts, localAids }),
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
});
