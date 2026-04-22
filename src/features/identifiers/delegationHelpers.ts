import type { KeyState } from 'signify-ts';
import type {
    DelegationRequestNotification,
    NotificationRecord,
} from '../../state/notifications.slice';
import type {
    IdentifierDelegationChainNode,
    IdentifierSummary,
} from './identifierTypes';

/**
 * Delegation anchor shape accepted by SignifyTS `delegations().approve`.
 */
export interface DelegationAnchor {
    i: string;
    s: string;
    d: string;
}

/**
 * Runtime details recorded by delegated identifier workflows.
 */
export interface DelegationWorkflowDetails {
    delegatorAid: string;
    delegateAid: string;
    delegateEventSaid: string;
    sequence: string;
    anchor: DelegationAnchor;
    requestedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

const numberValue = (value: unknown): string | null =>
    typeof value === 'number' && Number.isFinite(value) ? String(value) : null;

const eventString = (
    event: Record<string, unknown>,
    key: string
): string | null => stringValue(event[key]) ?? numberValue(event[key]);

/**
 * Create the reusable delegation anchor from a delegated inception or rotation
 * event. This helper intentionally does not approve anything; approval happens
 * only when the delegator signs an anchor event.
 */
export const delegationAnchorFromEvent = (event: unknown): DelegationAnchor => {
    if (!isRecord(event)) {
        throw new Error('Delegation event is missing or malformed.');
    }

    const delegateAid = eventString(event, 'i');
    const sequence = eventString(event, 's');
    const delegateEventSaid = eventString(event, 'd');

    if (
        delegateAid === null ||
        sequence === null ||
        delegateEventSaid === null
    ) {
        throw new Error(
            'Delegation event must include delegate AID, sequence, and SAID.'
        );
    }

    return {
        i: delegateAid,
        s: sequence,
        d: delegateEventSaid,
    };
};

/**
 * Rebuild the anchor from a typed delegation request notification.
 */
export const delegationAnchorFromNotification = (
    request: DelegationRequestNotification
): DelegationAnchor => ({
    i: request.anchor.i,
    s: request.anchor.s,
    d: request.anchor.d,
});

/**
 * Return the delegator AID recorded in an identifier key state.
 */
export const identifierDelegatorAid = (
    identifier: IdentifierSummary | null
): string | null => {
    const delegatorAid =
        identifier === null ? null : stringValue(identifier.state?.di);

    return delegatorAid;
};

/**
 * Return true when a managed identifier is currently delegated.
 */
export const isDelegatedIdentifier = (
    identifier: IdentifierSummary | null
): boolean => identifierDelegatorAid(identifier) !== null;

/**
 * Build a delegation-chain display node from local identifier state.
 */
export const delegationChainNodeFromIdentifier = (
    identifier: IdentifierSummary,
    source: IdentifierDelegationChainNode['source'] = 'local'
): IdentifierDelegationChainNode => ({
    aid: identifier.prefix,
    alias: identifier.name,
    source,
    sequence: stringValue(identifier.state?.s),
    eventSaid: stringValue(identifier.state?.d),
    delegatorAid: identifierDelegatorAid(identifier),
});

/**
 * Build a delegation-chain display node from a resolved key state.
 */
export const delegationChainNodeFromKeyState = ({
    state,
    alias,
    source,
}: {
    state: KeyState;
    alias: string | null;
    source: IdentifierDelegationChainNode['source'];
}): IdentifierDelegationChainNode => ({
    aid: state.i,
    alias,
    source,
    sequence: stringValue(state.s),
    eventSaid: stringValue(state.d),
    delegatorAid: stringValue(state.di),
});

/**
 * Return the route-owned delegation request from a generic notification.
 */
export const delegationRequestFromNotificationRecord = (
    notification: NotificationRecord | null
): DelegationRequestNotification | null =>
    notification?.delegationRequest ?? null;
