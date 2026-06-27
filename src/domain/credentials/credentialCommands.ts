import type { SediVoterCredentialAttributes } from './sediVoterId';

/**
 * Pure command contracts shared by route data, runtime, workflows, and
 * services. They intentionally contain no Redux, React, or Signify client
 * capabilities, only serializable user intent.
 */

/** Command data for resolving a credential schema OOBI. */
export interface ResolveCredentialSchemaInput {
    schemaSaid: string;
    schemaOobiUrl: string;
}

/** Command data for creating or discovering an issuer credential registry. */
export interface CreateCredentialRegistryInput {
    issuerAlias: string;
    issuerAid: string;
    registryName?: string;
}

/** Command data for issuing the demo SEDI voter credential. */
export interface IssueSediCredentialInput {
    issuerAlias: string;
    issuerAid: string;
    holderAid: string;
    registryId: string;
    schemaSaid: string;
    attributes: SediVoterCredentialAttributes;
}

/** Command data for sending an IPEX grant for an issued credential. */
export interface GrantCredentialInput {
    issuerAlias: string;
    issuerAid: string;
    holderAid: string;
    credentialSaid: string;
}

/** Command data for QVI-side W3C issuance from a native VRD credential. */
export interface StartW3CIssuanceInput {
    issuerAlias: string;
    issuerAid: string;
    credentialSaid: string;
}

/** Command data for holder-side admission of an inbound credential grant. */
export interface AdmitCredentialGrantInput {
    holderAlias: string;
    holderAid: string;
    notificationId: string;
    grantSaid: string;
}

/** Command data for presenting one VRD ACDC through the W3C VC-JWT path. */
export interface PresentCredentialInput {
    presenterAlias: string;
    presenterAid: string;
    credentialSaid: string;
    verifierRequest: Record<string, unknown>;
}
