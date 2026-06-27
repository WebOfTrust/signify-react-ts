import type { SediVoterCredentialAttributes } from './sediVoterId';

export type { SediVoterCredentialAttributes } from './sediVoterId';

/**
 * Serializable subject attributes projected from a known credential schema.
 *
 * Keep this union explicit. Adding a new credential type means adding that
 * schema's attribute type here and a projector in the schema-specific domain
 * directory, not widening the app to untyped credential payloads.
 */
export type CredentialSubjectAttributes = SediVoterCredentialAttributes;

/** Local side of a credential known to this connected wallet. */
export type CredentialDirection = 'issued' | 'held';

/** Local status of a credential as it moves through issuer/holder flows. */
export type CredentialStatus =
    | 'draft'
    | 'issued'
    | 'grantSent'
    | 'pendingAdmit'
    | 'admitted'
    | 'revoked'
    | 'error';

/**
 * Minimal credential projection stored for workflow/UI coordination.
 */
export interface CredentialSummaryRecord {
    said: string;
    schemaSaid: string | null;
    registryId: string | null;
    issuerAid: string | null;
    holderAid: string | null;
    direction: CredentialDirection;
    status: CredentialStatus;
    grantSaid: string | null;
    admitSaid: string | null;
    notificationId: string | null;
    issuedAt: string | null;
    grantedAt: string | null;
    admittedAt: string | null;
    revokedAt: string | null;
    error: string | null;
    attributes: CredentialSubjectAttributes | null;
    updatedAt: string;
}

/** Raw ACDC edge reference extracted from the credential `e` block. */
export interface CredentialAcdcEdgeReference {
    label: string;
    said: string | null;
    operator: string | null;
    data: Record<string, unknown> | null;
}

/**
 * Generic ACDC detail record for schemas without local typed projectors.
 */
export interface CredentialAcdcRecord {
    said: string;
    schemaSaid: string | null;
    registryId: string | null;
    issuerAid: string | null;
    holderAid: string | null;
    subject: Record<string, unknown> | null;
    rules: unknown | null;
    edges: CredentialAcdcEdgeReference[];
    status: CredentialStatus | null;
    updatedAt: string;
}

/** Node in the rendered ACDC source/dependency graph. */
export interface CredentialChainGraphNodeRecord {
    said: string;
    schemaSaid: string | null;
    issuerAid: string | null;
    holderAid: string | null;
    unresolved: boolean;
    depth: number;
}

/** Directed source-to-dependent edge in an ACDC chain graph. */
export interface CredentialChainGraphEdgeRecord {
    id: string;
    from: string;
    to: string;
    label: string;
    operator: string | null;
}

/** Normalized chained ACDC DAG for one root credential. */
export interface CredentialChainGraphRecord {
    rootSaid: string;
    nodes: CredentialChainGraphNodeRecord[];
    edges: CredentialChainGraphEdgeRecord[];
    updatedAt: string;
}

/** IPEX exchange activity linked to one credential. */
export interface CredentialIpexActivityRecord {
    id: string;
    credentialSaid: string;
    exchangeSaid: string;
    route: string;
    kind: 'grant' | 'admit';
    direction: 'sent' | 'received' | 'unknown';
    senderAid: string | null;
    recipientAid: string | null;
    linkedGrantSaid: string | null;
    createdAt: string | null;
    updatedAt: string;
}

/** Resolution lifecycle for a credential schema OOBI. */
export type SchemaResolutionStatus =
    | 'unknown'
    | 'resolving'
    | 'resolved'
    | 'error';

/**
 * Local schema resolution record keyed by schema SAID.
 */
export interface SchemaRecord {
    said: string;
    oobi: string | null;
    status: SchemaResolutionStatus;
    title: string | null;
    description: string | null;
    credentialType: string | null;
    version: string | null;
    properties?: Record<string, unknown> | null;
    rules?: Record<string, unknown> | null;
    error: string | null;
    updatedAt: string | null;
}

/** Credential inventory plus embedded schemas observed while loading credentials. */
export interface CredentialInventorySnapshot {
    credentials: CredentialSummaryRecord[];
    acdcs: CredentialAcdcRecord[];
    chainGraphs: CredentialChainGraphRecord[];
    schemas: SchemaRecord[];
}

/** Lifecycle of a credential registry known to the local issuer role. */
export type RegistryStatus = 'unknown' | 'creating' | 'ready' | 'error';

/**
 * Local registry projection keyed by registry id/key.
 */
export interface RegistryRecord {
    id: string;
    name: string;
    registryName: string;
    regk: string;
    issuerAlias: string;
    issuerAid: string;
    status: RegistryStatus;
    error: string | null;
    updatedAt: string | null;
}

/** Holder-facing state for inbound credential grant notifications. */
export type CredentialGrantNotificationStatus =
    | 'actionable'
    | 'notForThisWallet'
    | 'admitted'
    | 'error';

/** Issuer-facing state for inbound credential admit notifications. */
export type CredentialAdmitNotificationStatus =
    | 'received'
    | 'notForThisWallet'
    | 'error';

/** Holder-facing state for inbound W3C VC-JWT grant notifications. */
export type W3CVcGrantNotificationStatus =
    | 'received'
    | 'materialized'
    | 'notForThisWallet'
    | 'error';

/**
 * Credential grant metadata hydrated from an IPEX grant EXN.
 */
export interface CredentialGrantNotification {
    notificationId: string;
    grantSaid: string;
    issuerAid: string;
    holderAid: string;
    credentialSaid: string;
    schemaSaid: string | null;
    attributes: Record<string, string | boolean>;
    createdAt: string;
    status: CredentialGrantNotificationStatus;
}

/**
 * Credential admit receipt metadata hydrated from an IPEX admit EXN.
 */
export interface CredentialAdmitNotification {
    notificationId: string;
    admitSaid: string;
    grantSaid: string | null;
    issuerAid: string | null;
    holderAid: string;
    createdAt: string;
    status: CredentialAdmitNotificationStatus;
}

/**
 * W3C VC-JWT grant metadata hydrated from a `/w3c/vc/grant` EXN.
 *
 * These grants are informational for the holder: KERIA materializes the held
 * W3C credential automatically after validating the grant payload.
 */
export interface W3CVcGrantNotification {
    notificationId: string;
    grantSaid: string;
    issuerAid: string;
    issuerDid: string;
    holderAid: string;
    holderDid: string;
    sourceCredentialSaid: string;
    schemaSaid: string;
    issuanceId: string;
    profile: string;
    statusUrl: string;
    vcJwt: string;
    heldCredentialId: string | null;
    createdAt: string;
    status: W3CVcGrantNotificationStatus;
    error: string | null;
}

/**
 * Minimal notification data required to project credential IPEX exchange
 * payloads without coupling domain helpers to the notification Redux slice.
 */
export interface CredentialExchangeNotificationReference {
    id: string;
    dt: string | null;
    read: boolean;
    anchorSaid: string | null;
}

/** Local identifier that may own credential registries. */
export interface CredentialRegistryOwner {
    issuerAlias: string;
    issuerAid: string;
}

/** Snapshot of registry inventory loaded for local issuer identifiers. */
export interface CredentialRegistryInventorySnapshot {
    registries: RegistryRecord[];
    loadedAt: string;
}
