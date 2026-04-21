import type { Operation as EffectionOperation } from 'effection';
import { AppServicesContext } from '../effects/contexts';
import { contactResolutionFailed, contactResolutionStarted } from '../state/contacts.slice';
import type { LocalRole } from '../state/roles.slice';

/**
 * Input for resolving an OOBI into a local contact for one demo role.
 */
export interface ResolveContactInput {
    role: LocalRole;
    alias: string;
    oobi: string;
}

/**
 * Input for workflows that act from a local role toward one recipient AID.
 */
export interface RoleAidInput {
    role: LocalRole;
    recipientAid: string;
}

/**
 * Input for responding to a generated challenge word list.
 */
export interface ChallengeResponseInput {
    role: LocalRole;
    challenge: string[];
}

/**
 * Input for polling notification routes for one local role.
 */
export interface NotificationPollInput {
    role: LocalRole;
    routes: string[];
}

/**
 * Input for resolving one schema OOBI.
 */
export interface SchemaResolutionInput {
    schemaOobi: string;
}

/**
 * Input for issuer workflows that only need the local issuer role.
 */
export interface IssuerRoleInput {
    issuerRole: LocalRole;
}

/**
 * Input for issuing a credential from a local issuer to a holder AID.
 */
export interface IssueCredentialInput {
    issuerRole: LocalRole;
    holderAid: string;
    draft: unknown;
}

/**
 * Input for grant/presentation style credential transfer workflows.
 */
export interface CredentialTransferInput {
    senderRole: LocalRole;
    recipientAid: string;
    credentialSaid: string;
}

/**
 * Input for holder admission of a granted credential.
 */
export interface AdmitCredentialInput {
    holderRole: LocalRole;
    grantSaid: string;
}

/**
 * Input for presenting a credential from holder to verifier.
 */
export interface PresentCredentialInput {
    holderRole: LocalRole;
    verifierAid: string;
    credentialSaid: string;
}

/**
 * Shared placeholder error for domain workflows that have state contracts but
 * do not yet have Signify/KERIA implementations.
 */
const workflowNotImplemented = (name: string): Error =>
    new Error(`${name} workflow is not implemented yet.`);

/**
 * Record contact resolution start/failure state until real OOBI resolution is
 * wired into this domain workflow.
 */
export function* resolveContactOp(
    input: ResolveContactInput
): EffectionOperation<never> {
    const services = yield* AppServicesContext.expect();
    const id = `${input.role}:${input.alias}`;
    const updatedAt = new Date().toISOString();

    services.store.dispatch(
        contactResolutionStarted({
            id,
            alias: input.alias,
            oobi: input.oobi,
            updatedAt,
        })
    );

    const error = workflowNotImplemented('resolveContactOp');
    services.store.dispatch(
        contactResolutionFailed({
            id,
            error: error.message,
            updatedAt: new Date().toISOString(),
        })
    );
    throw error;
}

/**
 * Placeholder for issuing a challenge from a local role to a recipient AID.
 */
export function* issueChallengeOp(
    input: RoleAidInput
): EffectionOperation<never> {
    yield* AppServicesContext.expect();
    void input;
    throw workflowNotImplemented('issueChallengeOp');
}

/**
 * Placeholder for responding to a received challenge.
 */
export function* respondToChallengeOp(
    input: ChallengeResponseInput
): EffectionOperation<never> {
    yield* AppServicesContext.expect();
    void input;
    throw workflowNotImplemented('respondToChallengeOp');
}

/**
 * Placeholder for polling KERIA notification routes.
 */
export function* pollNotificationsOp(
    input: NotificationPollInput
): EffectionOperation<never> {
    yield* AppServicesContext.expect();
    void input;
    throw workflowNotImplemented('pollNotificationsOp');
}

/**
 * Placeholder for resolving and recording a credential schema.
 */
export function* resolveSchemaOp(
    input: SchemaResolutionInput
): EffectionOperation<never> {
    yield* AppServicesContext.expect();
    void input;
    throw workflowNotImplemented('resolveSchemaOp');
}

/**
 * Placeholder for creating a credential registry for an issuer role.
 */
export function* createRegistryOp(
    input: IssuerRoleInput
): EffectionOperation<never> {
    yield* AppServicesContext.expect();
    void input;
    throw workflowNotImplemented('createRegistryOp');
}

/**
 * Placeholder for issuing a credential from an issuer role.
 */
export function* issueCredentialOp(
    input: IssueCredentialInput
): EffectionOperation<never> {
    yield* AppServicesContext.expect();
    void input;
    throw workflowNotImplemented('issueCredentialOp');
}

/**
 * Placeholder for granting a credential to another AID.
 */
export function* grantCredentialOp(
    input: CredentialTransferInput
): EffectionOperation<never> {
    yield* AppServicesContext.expect();
    void input;
    throw workflowNotImplemented('grantCredentialOp');
}

/**
 * Placeholder for admitting a granted credential as holder.
 */
export function* admitCredentialOp(
    input: AdmitCredentialInput
): EffectionOperation<never> {
    yield* AppServicesContext.expect();
    void input;
    throw workflowNotImplemented('admitCredentialOp');
}

/**
 * Placeholder for presenting a credential to a verifier AID.
 */
export function* presentCredentialOp(
    input: PresentCredentialInput
): EffectionOperation<never> {
    yield* AppServicesContext.expect();
    void input;
    throw workflowNotImplemented('presentCredentialOp');
}
