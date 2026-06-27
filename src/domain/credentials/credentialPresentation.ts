import type { CredentialSummaryRecord } from './credentialTypes';
import type { IdentifierSummary } from '../identifiers/identifierTypes';

/**
 * KERIA's current W3C presentation path supports the Isomer VRD credential only.
 *
 * Keep this explicit in the app so W3C Present does not look like a generic
 * replacement for IPEX Grant or a generic ACDC presentation mechanism.
 */
export const W3C_PRESENTABLE_VRD_SCHEMA_SAID =
    'EAyv2DLocYxJlPrWAfYBuHWDpjCStdQBzNLg0-3qQ-KP';

/** Return whether this credential can use the current W3C Present workflow. */
export const isW3CPresentableVrdCredential = (
    credential: CredentialSummaryRecord
): boolean => credential.schemaSaid === W3C_PRESENTABLE_VRD_SCHEMA_SAID;

/** Return whether this native credential can start QVI-side W3C issuance. */
export const isW3CIssuableVrdCredential = (
    credential: CredentialSummaryRecord
): boolean =>
    credential.direction === 'issued' &&
    credential.schemaSaid === W3C_PRESENTABLE_VRD_SCHEMA_SAID;

/** Select the local issuer AID that can start QVI-side W3C issuance. */
export const selectCredentialW3CIssuer = (
    credential: CredentialSummaryRecord,
    identifiers: readonly IdentifierSummary[]
): IdentifierSummary | null => {
    if (credential.issuerAid === null) {
        return null;
    }

    return (
        identifiers.find(
            (identifier) => identifier.prefix === credential.issuerAid
        ) ?? null
    );
};

/** Select the local AID that should run W3C Present for this credential. */
export const selectW3CPresenter = (
    credential: CredentialSummaryRecord,
    identifiers: readonly IdentifierSummary[]
): IdentifierSummary | null => {
    if (credential.direction !== 'held' || credential.holderAid === null) {
        return null;
    }

    return (
        identifiers.find(
            (identifier) => identifier.prefix === credential.holderAid
        ) ?? null
    );
};
