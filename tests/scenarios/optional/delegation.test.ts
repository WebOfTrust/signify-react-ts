import { describe, expect, it } from 'vitest';
import { testConfig } from '../../support/config';
import {
    addAgentEndRole,
    createIdentifier,
    createRole,
    type Role,
    resolveOobi,
    serderFromOperation,
    uniqueAlias,
} from '../../support/keria';
import { delegationAnchorFromEvent } from '../../../src/features/identifiers/delegationHelpers';
import type { DelegationAnchor } from '../../../src/features/identifiers/delegationHelpers';
import { DELEGATION_REQUEST_NOTIFICATION_ROUTE } from '../../../src/services/notifications.service';

/*
 * Optional delegation fixture scenario.
 *
 * This verifies the delegated-AID path only when an external delegator prefix
 * and OOBI have been supplied by the local test environment.
 */
const delegationConfig = testConfig.fixtures.delegation;
const hasDelegationConfig =
    delegationConfig.delegatorPre !== null &&
    delegationConfig.delegatorOobi !== null;

/**
 * Narrow nullable fixture values after `it.skipIf` has guarded the scenario.
 */
const requireFixtureValue = (value: string | null, message: string): string => {
    if (value === null) {
        throw new Error(message);
    }

    return value;
};

const notificationItemsFromResponse = (
    raw: unknown
): Record<string, unknown>[] => {
    if (Array.isArray(raw)) {
        return raw.filter(
            (item): item is Record<string, unknown> =>
                typeof item === 'object' && item !== null
        );
    }

    if (
        typeof raw === 'object' &&
        raw !== null &&
        Array.isArray((raw as { notes?: unknown }).notes)
    ) {
        return (raw as { notes: unknown[] }).notes.filter(
            (item): item is Record<string, unknown> =>
                typeof item === 'object' && item !== null
        );
    }

    return [];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const embeddedDelegationEvent = (
    value: Record<string, unknown>
): Record<string, unknown> | null => {
    for (const key of ['ked', 'event', 'evt', 'icp', 'dip', 'rot', 'drt']) {
        const candidate = value[key];
        if (isRecord(candidate)) {
            return candidate;
        }
    }

    const embeds = value.e;
    if (isRecord(embeds)) {
        for (const key of ['ked', 'event', 'evt', 'icp', 'dip', 'rot', 'drt']) {
            const candidate = embeds[key];
            if (isRecord(candidate)) {
                return candidate;
            }
        }
    }

    return null;
};

interface ObservedDelegationRequest {
    notificationId: string;
    delegatorAid: string;
    delegateAid: string;
    delegateEventSaid: string;
    sequence: string;
    anchor: DelegationAnchor;
    sourceAid: string | null;
    createdAt: string;
}

const requestFromPayload = ({
    notification,
    payload,
    sourceAid,
}: {
    notification: Record<string, unknown>;
    payload: Record<string, unknown>;
    sourceAid: string | null;
}): ObservedDelegationRequest | null => {
    const event = embeddedDelegationEvent(payload);
    if (event === null) {
        return null;
    }

    const anchor = delegationAnchorFromEvent(event);
    const delegatorAid = stringValue(payload.delpre) ?? stringValue(event.di);
    if (delegatorAid === null) {
        return null;
    }

    return {
        notificationId: stringValue(notification.i) ?? anchor.d,
        delegatorAid,
        delegateAid: anchor.i,
        delegateEventSaid: anchor.d,
        sequence: anchor.s,
        anchor,
        sourceAid,
        createdAt:
            stringValue(payload.dt) ??
            stringValue(notification.dt) ??
            new Date().toISOString(),
    };
};

const requestFromNotification = (
    note: Record<string, unknown>
): ObservedDelegationRequest | null => {
    const attrs = isRecord(note.a) ? note.a : {};
    const route = stringValue(attrs.r);

    if (route !== DELEGATION_REQUEST_NOTIFICATION_ROUTE) {
        return null;
    }

    return requestFromPayload({
        notification: note,
        payload: attrs,
        sourceAid: stringValue(attrs.src) ?? stringValue(attrs.i),
    });
};

const waitForDelegationRequestNotification = async (
    role: Role,
    delegatorAid: string,
    delegateEventSaid: string,
    timeoutMs = 30_000
): Promise<ObservedDelegationRequest> => {
    const timeoutAt = Date.now() + timeoutMs;

    while (Date.now() < timeoutAt) {
        const response = await role.client.notifications().list();
        for (const note of notificationItemsFromResponse(response)) {
            const request = requestFromNotification(note);
            if (
                request?.delegatorAid === delegatorAid &&
                request.delegateEventSaid === delegateEventSaid
            ) {
                return request;
            }
        }

        await new Promise((resolve) => globalThis.setTimeout(resolve, 1000));
    }

    throw new Error('Delegation request notification was not delivered.');
};

describe.sequential('delegation fixture', () => {
    it.skipIf(!hasDelegationConfig)(
        'creates a delegated AID when a delegator fixture is configured',
        async () => {
            const delegatorPre = requireFixtureValue(
                delegationConfig.delegatorPre,
                'Set VITE_DELEGATOR_PRE to run this optional scenario.'
            );
            const delegatorOobi = requireFixtureValue(
                delegationConfig.delegatorOobi,
                'Set VITE_DELEGATOR_OOBI to run this optional scenario.'
            );
            const role = await createRole('delegate');
            await resolveOobi(role, delegatorOobi, 'delegator');

            const alias = uniqueAlias('delegated');
            const result = await role.client
                .identifiers()
                .create(alias, { delpre: delegatorPre });
            const completed = await role.waitEvent(result, `creates ${alias}`);
            const serder = serderFromOperation(completed.response);
            const aid = await role.client.identifiers().get(alias);

            expect(serder.pre).toBe(aid.prefix);
            expect(delegatorPre).toBeTruthy();
        },
        180_000
    );

    it.skipIf(!delegationConfig.autoApprove)(
        'auto-approves delegation only when the explicit test flag is enabled',
        async () => {
            const delegator = await createRole('delegator');
            const delegate = await createRole('delegate');
            const delegatorAlias = uniqueAlias('delegator');
            const delegatorAid = await createIdentifier(
                delegator,
                delegatorAlias
            );
            const delegatorOobi = await addAgentEndRole(
                delegator,
                delegatorAlias
            );
            await resolveOobi(delegate, delegatorOobi, delegatorAlias);

            const delegateContactAlias = uniqueAlias('delegate-contact');
            await createIdentifier(delegate, delegateContactAlias);
            const delegateOobi = await addAgentEndRole(
                delegate,
                delegateContactAlias
            );
            await resolveOobi(delegator, delegateOobi, delegateContactAlias);

            const delegateAlias = uniqueAlias('delegated');
            const result = await delegate.client
                .identifiers()
                .create(delegateAlias, { delpre: delegatorAid.prefix });
            const operation = await result.op();
            const expectedAnchor = delegationAnchorFromEvent(result.serder.sad);
            const request = await waitForDelegationRequestNotification(
                delegator,
                delegatorAid.prefix,
                expectedAnchor.d
            );
            const anchor = request.anchor;

            expect(request.delegatorAid).toBe(delegatorAid.prefix);
            expect(request.delegateAid).toBe(anchor.i);
            expect(request.delegateEventSaid).toBe(anchor.d);
            expect(request.sequence).toBe(anchor.s);

            const queryOperation = await delegate.client
                .keyStates()
                .query(delegatorAid.prefix, undefined, anchor);
            const approval = await delegator.client
                .delegations()
                .approve(delegatorAlias, anchor);

            await Promise.all([
                delegate.waitOperation(
                    queryOperation,
                    `queries approval for ${delegateAlias}`
                ),
                delegator.waitEvent(
                    approval,
                    `approves delegation for ${delegateAlias}`
                ),
            ]);
            await delegate.waitOperation(
                operation,
                `completes delegated ${delegateAlias}`
            );

            const delegated = await delegate.client
                .identifiers()
                .get(delegateAlias);
            expect(delegated.state.di).toBe(delegatorAid.prefix);
        },
        180_000
    );
});
