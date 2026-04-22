import { describe, expect, it, vi } from 'vitest';
import type { SignifyClient } from 'signify-ts';
import { createAppRuntime } from '../../src/app/runtime';
import {
    approveDelegationRequestService,
    type ApproveDelegationInput,
} from '../../src/services/delegations.service';

const request = {
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
    createdAt: '2026-04-22T00:00:00.000Z',
    status: 'actionable' as const,
};

const input: ApproveDelegationInput = {
    notificationId: request.notificationId,
    delegatorName: 'delegator',
    request,
};

const makeClient = ({ prefix = 'Edelegator' }: { prefix?: string } = {}) => {
    const approve = vi.fn(async () => ({
        op: vi.fn(async () => ({
            name: 'delegation.Edelegate-event',
        })),
    }));
    const get = vi.fn(async () => ({ name: 'delegator', prefix }));
    const wait = vi.fn(async () => ({
        name: 'delegation.Edelegate-event',
        done: true,
    }));
    const deleteNotification = vi.fn(async () => undefined);
    const mark = vi.fn(async () => undefined);
    const client = {
        identifiers: () => ({ get }),
        delegations: () => ({ approve }),
        operations: () => ({ wait }),
        notifications: () => ({
            delete: deleteNotification,
            mark,
        }),
    } as unknown as SignifyClient;

    return { client, approve, get, wait, deleteNotification, mark };
};

const runApprove = async (client: SignifyClient) => {
    const runtime = createAppRuntime({ storage: null });
    try {
        return await runtime.runWorkflow(
            () => approveDelegationRequestService({ client, input }),
            { scope: 'app', track: false }
        );
    } finally {
        await runtime.destroy();
    }
};

describe('approveDelegationRequestService', () => {
    it('validates local delegator ownership and approves with the reusable anchor', async () => {
        const { client, approve, get, wait, deleteNotification } = makeClient();

        await expect(runApprove(client)).resolves.toMatchObject({
            delegatorAid: 'Edelegator',
            delegateAid: 'Edelegate',
            delegateEventSaid: 'Edelegate-event',
            sequence: '0',
            requestedAt: request.createdAt,
        });
        expect(get).toHaveBeenCalledWith('delegator');
        expect(approve).toHaveBeenCalledWith('delegator', request.anchor);
        expect(wait).toHaveBeenCalledOnce();
        expect(deleteNotification).toHaveBeenCalledWith('delegate-note-1');
    });

    it('rejects approvals when the selected identifier is not the delegator', async () => {
        const { client, approve } = makeClient({ prefix: 'Eother' });

        await expect(runApprove(client)).rejects.toThrow(
            'Delegation request delegator does not match'
        );
        expect(approve).not.toHaveBeenCalled();
    });
});
