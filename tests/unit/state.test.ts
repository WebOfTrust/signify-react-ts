import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/state/store';
import {
    cancelRunningOperations,
    operationCanceled,
    operationFailed,
    operationStarted,
    operationSucceeded,
    operationsRehydrated,
} from '../../src/state/operations.slice';
import {
    selectActiveOperations,
    selectAppNotifications,
    selectUnreadAppNotifications,
    selectLatestActiveOperationLabel,
    selectUnreadNotifications,
    selectContacts,
    selectContactById,
    selectKnownComponents,
    selectChallenges,
    selectChallengesForContact,
    selectDashboardCounts,
} from '../../src/state/selectors';
import {
    sessionConnected,
    sessionConnecting,
    sessionDisconnected,
} from '../../src/state/session.slice';
import { notificationRecorded } from '../../src/state/notifications.slice';
import {
    challengeRecorded,
    challengesLoaded,
} from '../../src/state/challenges.slice';
import {
    contactInventoryLoaded,
    generatedOobiRecorded,
} from '../../src/state/contacts.slice';
import { identifierListLoaded } from '../../src/state/identifiers.slice';
import {
    allAppNotificationsRead,
    appNotificationRecorded,
} from '../../src/state/appNotifications.slice';

describe('RTK state foundation', () => {
    it('records session connection facts without live capabilities', () => {
        const store = createAppStore();

        store.dispatch(sessionConnecting());
        expect(store.getState().session.status).toBe('connecting');

        store.dispatch(
            sessionConnected({
                booted: true,
                controllerAid: 'Econtroller',
                agentAid: 'Eagent',
                connectedAt: '2026-04-21T00:00:00.000Z',
            })
        );

        expect(store.getState().session).toMatchObject({
            status: 'connected',
            booted: true,
            controllerAid: 'Econtroller',
            agentAid: 'Eagent',
        });

        store.dispatch(sessionDisconnected());
        expect(store.getState().session.status).toBe('idle');
    });

    it('tracks operation lifecycle and active operation labels', () => {
        const store = createAppStore();

        store.dispatch(
            operationStarted({
                requestId: 'op-1',
                label: 'Creating identifier...',
                kind: 'createIdentifier',
                startedAt: '2026-04-21T00:00:00.000Z',
            })
        );
        expect(selectLatestActiveOperationLabel(store.getState())).toBe(
            'Creating identifier...'
        );

        store.dispatch(
            operationSucceeded({
                requestId: 'op-1',
                finishedAt: '2026-04-21T00:00:01.000Z',
            })
        );
        expect(selectActiveOperations(store.getState())).toHaveLength(0);

        store.dispatch(
            operationStarted({
                requestId: 'op-2',
                label: 'Rotating identifier...',
                kind: 'rotateIdentifier',
                startedAt: '2026-04-21T00:00:02.000Z',
            })
        );
        store.dispatch(
            operationFailed({
                requestId: 'op-2',
                error: 'KERIA rejected request',
                finishedAt: '2026-04-21T00:00:03.000Z',
            })
        );
        expect(store.getState().operations.byId['op-2']).toMatchObject({
            status: 'error',
            error: 'KERIA rejected request',
        });

        store.dispatch(
            operationStarted({
                requestId: 'op-3',
                label: 'Resolving contact...',
                kind: 'resolveContact',
                startedAt: '2026-04-21T00:00:04.000Z',
            })
        );
        store.dispatch(
            operationCanceled({
                requestId: 'op-3',
                reason: 'Route aborted.',
                finishedAt: '2026-04-21T00:00:05.000Z',
            })
        );
        expect(store.getState().operations.byId['op-3']).toMatchObject({
            status: 'canceled',
            canceledReason: 'Route aborted.',
        });
    });

    it('cancels running operations on session teardown', () => {
        const store = createAppStore();

        store.dispatch(
            operationStarted({
                requestId: 'op-1',
                label: 'Polling notifications...',
                kind: 'pollNotifications',
                startedAt: '2026-04-21T00:00:00.000Z',
            })
        );
        store.dispatch(
            cancelRunningOperations({
                reason: 'Session disconnected.',
                finishedAt: '2026-04-21T00:00:01.000Z',
            })
        );

        expect(store.getState().operations.byId['op-1']).toMatchObject({
            status: 'canceled',
            canceledReason: 'Session disconnected.',
        });
    });

    it('selects unread notifications', () => {
        const store = createAppStore();

        store.dispatch(
            notificationRecorded({
                id: 'n-1',
                dt: '2026-04-21T00:00:00.000Z',
                read: false,
                route: '/exn/ipex/grant',
                anchorSaid: null,
                status: 'unread',
                message: null,
                updatedAt: '2026-04-21T00:00:00.000Z',
            })
        );

        expect(selectUnreadNotifications(store.getState())).toHaveLength(1);
        expect(JSON.parse(JSON.stringify(store.getState()))).toMatchObject(
            store.getState()
        );
    });

    it('tracks contact inventory, generated OOBIs, components, and challenges', () => {
        const store = createAppStore();

        store.dispatch(
            contactInventoryLoaded({
                loadedAt: '2026-04-21T00:00:00.000Z',
                contacts: [
                    {
                        id: 'Econtact',
                        alias: 'Wan',
                        aid: 'Econtact',
                        oobi: 'http://127.0.0.1:5642/oobi/Econtact/controller?tag=witness',
                        endpoints: [
                            {
                                role: 'agent',
                                eid: 'Eagent',
                                scheme: 'http',
                                url: 'http://127.0.0.1:3902',
                            },
                        ],
                        wellKnowns: [],
                        componentTags: ['witness'],
                        challengeCount: 1,
                        authenticatedChallengeCount: 1,
                        resolutionStatus: 'resolved',
                        error: null,
                        updatedAt: '2026-04-21T00:00:00.000Z',
                    },
                ],
            })
        );
        store.dispatch(
            generatedOobiRecorded({
                id: 'alice:agent',
                identifier: 'alice',
                role: 'agent',
                oobis: ['http://127.0.0.1:3902/oobi/Ealice/agent'],
                generatedAt: '2026-04-21T00:00:01.000Z',
            })
        );
        store.dispatch(
            challengesLoaded({
                loadedAt: '2026-04-21T00:00:02.000Z',
                challenges: [
                    {
                        id: 'challenge-1',
                        direction: 'received',
                        role: 'Wan',
                        counterpartyAid: 'Econtact',
                        words: ['one', 'two'],
                        authenticated: true,
                        status: 'verified',
                        result: 'Ssaid',
                        updatedAt: '2026-04-21T00:00:02.000Z',
                    },
                ],
            })
        );

        expect(selectContacts(store.getState())).toHaveLength(1);
        expect(selectContactById('Econtact')(store.getState())?.alias).toBe(
            'Wan'
        );
        expect(
            selectKnownComponents(store.getState()).map((item) => item.role)
        ).toEqual(['agent', 'witness']);
        expect(selectChallenges(store.getState())).toHaveLength(1);
        expect(
            selectChallengesForContact('Econtact')(store.getState())
        ).toEqual([expect.objectContaining({ id: 'challenge-1' })]);
        expect(selectDashboardCounts(store.getState())).toMatchObject({
            contacts: 1,
            knownComponents: 2,
            challenges: 1,
        });
        expect(store.getState().contacts.generatedOobiIds).toEqual([
            'alice:agent',
        ]);
    });

    it('preserves workflow challenge records across inventory refreshes', () => {
        const store = createAppStore();

        store.dispatch(
            challengeRecorded({
                id: 'workflow-challenge-1',
                source: 'workflow',
                direction: 'issued',
                role: 'challenger',
                counterpartyAid: 'Econtact',
                counterpartyAlias: 'Wan',
                localIdentifier: 'alice',
                localAid: 'Ealice',
                words: Array.from({ length: 12 }, (_, index) => `word${index}`),
                wordsHash: 'hash-one',
                responseSaid: null,
                authenticated: false,
                status: 'pending',
                result: null,
                error: null,
                generatedAt: '2026-04-21T00:00:01.000Z',
                sentAt: null,
                verifiedAt: null,
                updatedAt: '2026-04-21T00:00:01.000Z',
            })
        );
        store.dispatch(
            challengesLoaded({
                loadedAt: '2026-04-21T00:00:02.000Z',
                challenges: [],
            })
        );

        expect(selectChallenges(store.getState())).toEqual([
            expect.objectContaining({ id: 'workflow-challenge-1' }),
        ]);

        store.dispatch(
            challengesLoaded({
                loadedAt: '2026-04-21T00:00:03.000Z',
                challenges: [
                    {
                        id: 'Econtact:Eresponse',
                        source: 'keria',
                        direction: 'received',
                        role: 'Wan',
                        counterpartyAid: 'Econtact',
                        words: Array.from(
                            { length: 12 },
                            (_, index) => `word${index}`
                        ),
                        wordsHash: 'hash-one',
                        responseSaid: 'Eresponse',
                        authenticated: true,
                        status: 'verified',
                        result: 'Eresponse',
                        error: null,
                        verifiedAt: '2026-04-21T00:00:03.000Z',
                        updatedAt: '2026-04-21T00:00:03.000Z',
                    },
                ],
            })
        );

        expect(selectChallenges(store.getState())).toEqual([
            expect.objectContaining({
                id: 'Econtact:Eresponse',
                status: 'verified',
            }),
        ]);
    });

    it('clears session-scoped inventory when a new connection starts', () => {
        const store = createAppStore();

        store.dispatch(
            contactInventoryLoaded({
                loadedAt: '2026-04-21T00:00:00.000Z',
                contacts: [
                    {
                        id: 'Econtact',
                        alias: 'Layla',
                        aid: 'Econtact',
                        oobi: null,
                        endpoints: [],
                        wellKnowns: [],
                        componentTags: [],
                        challengeCount: 0,
                        authenticatedChallengeCount: 0,
                        resolutionStatus: 'resolved',
                        error: null,
                        updatedAt: '2026-04-21T00:00:00.000Z',
                    },
                ],
            })
        );
        store.dispatch(
            generatedOobiRecorded({
                id: 'alice:agent',
                identifier: 'alice',
                role: 'agent',
                oobis: ['http://127.0.0.1:3902/oobi/Ealice/agent'],
                generatedAt: '2026-04-21T00:00:01.000Z',
            })
        );
        store.dispatch(
            identifierListLoaded({
                loadedAt: '2026-04-21T00:00:01.000Z',
                identifiers: [
                    {
                        name: 'alice',
                        prefix: 'Ealice',
                    } as never,
                ],
            })
        );
        store.dispatch(
            notificationRecorded({
                id: 'n-1',
                dt: '2026-04-21T00:00:00.000Z',
                read: false,
                route: '/exn',
                anchorSaid: null,
                status: 'unread',
                message: null,
                updatedAt: '2026-04-21T00:00:00.000Z',
            })
        );
        store.dispatch(
            challengesLoaded({
                loadedAt: '2026-04-21T00:00:02.000Z',
                challenges: [
                    {
                        id: 'challenge-1',
                        direction: 'received',
                        role: 'Layla',
                        counterpartyAid: 'Econtact',
                        words: ['one', 'two'],
                        authenticated: false,
                        status: 'responded',
                        result: null,
                        updatedAt: '2026-04-21T00:00:02.000Z',
                    },
                ],
            })
        );

        store.dispatch(sessionConnecting());

        expect(selectContacts(store.getState())).toHaveLength(0);
        expect(selectChallenges(store.getState())).toHaveLength(0);
        expect(selectUnreadNotifications(store.getState())).toHaveLength(0);
        expect(store.getState().contacts.generatedOobiIds).toEqual([]);
        expect(store.getState().identifiers.prefixes).toEqual([]);
    });

    it('tracks unread app notifications separately from KERIA notifications', () => {
        const store = createAppStore();

        store.dispatch(
            appNotificationRecorded({
                id: 'app-n-1',
                severity: 'success',
                status: 'unread',
                title: 'Identifier created',
                message: 'The identifier operation completed.',
                createdAt: '2026-04-21T00:00:00.000Z',
                readAt: null,
                operationId: 'op-1',
                links: [
                    {
                        rel: 'operation',
                        label: 'View operation',
                        path: '/operations/op-1',
                    },
                ],
                payloadDetails: [],
            })
        );

        expect(selectUnreadAppNotifications(store.getState())).toHaveLength(1);
        expect(selectUnreadNotifications(store.getState())).toHaveLength(0);
    });

    it('selects app notifications newest first and marks them read', () => {
        const store = createAppStore();

        store.dispatch(
            appNotificationRecorded({
                id: 'app-n-old',
                severity: 'info',
                status: 'unread',
                title: 'Old',
                message: 'Old notification',
                createdAt: '2026-04-21T00:00:00.000Z',
                readAt: null,
                operationId: null,
                links: [],
                payloadDetails: [],
            })
        );
        store.dispatch(
            appNotificationRecorded({
                id: 'app-n-new',
                severity: 'success',
                status: 'unread',
                title: 'New',
                message: 'New notification',
                createdAt: '2026-04-21T00:00:01.000Z',
                readAt: null,
                operationId: null,
                links: [],
                payloadDetails: [],
            })
        );

        expect(
            selectAppNotifications(store.getState()).map(
                (notification) => notification.id
            )
        ).toEqual(['app-n-new', 'app-n-old']);

        store.dispatch(
            allAppNotificationsRead({
                readAt: '2026-04-21T00:00:02.000Z',
            })
        );

        expect(selectUnreadAppNotifications(store.getState())).toHaveLength(0);
        expect(
            store.getState().appNotifications.byId['app-n-new']
        ).toMatchObject({
            status: 'read',
            readAt: '2026-04-21T00:00:02.000Z',
        });
    });

    it('rehydrates running operations as interrupted', () => {
        const store = createAppStore();

        store.dispatch(
            operationsRehydrated({
                interruptedAt: '2026-04-21T00:00:01.000Z',
                records: [
                    {
                        requestId: 'op-running',
                        label: 'Running...',
                        title: 'Running operation',
                        description: null,
                        kind: 'resolveContact',
                        status: 'running',
                        phase: 'running',
                        resourceKeys: ['contact:alice'],
                        operationRoute: '/operations/op-running',
                        resultRoute: null,
                        notificationId: null,
                        payloadDetails: [],
                        keriaOperationName: null,
                        startedAt: '2026-04-21T00:00:00.000Z',
                        finishedAt: null,
                        error: null,
                        canceledReason: null,
                    },
                ],
            })
        );

        expect(store.getState().operations.byId['op-running']).toMatchObject({
            status: 'interrupted',
            phase: 'interrupted',
            finishedAt: '2026-04-21T00:00:01.000Z',
        });
    });
});
