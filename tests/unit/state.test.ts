import { describe, expect, it } from 'vitest';
import { createAppStore } from '../../src/state/store';
import {
    cancelRunningOperations,
    operationCanceled,
    operationFailed,
    operationStarted,
    operationSucceeded,
} from '../../src/state/operations.slice';
import {
    selectActiveOperations,
    selectLatestActiveOperationLabel,
    selectUnreadNotifications,
} from '../../src/state/selectors';
import {
    sessionConnected,
    sessionConnecting,
    sessionDisconnected,
} from '../../src/state/session.slice';
import { notificationRecorded } from '../../src/state/notifications.slice';

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
                route: '/exn/ipex/grant',
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
});
