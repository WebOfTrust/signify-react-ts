import type { SignifyClient } from 'signify-ts';
import * as signifyW3cModule from 'signify-w3c';

export type JsonObject = Record<string, unknown>;

export interface DecodedJwt {
    header: JsonObject;
    payload: JsonObject;
    signature: Uint8Array;
    signingInput: Uint8Array;
}

export interface W3CIssuanceContext {
    issuanceId: string;
    issuerName: string;
    issuerAid: string;
    holderAid: string;
    sourceCredentialSaid: string;
    schemaSaid: string;
    issuerDid: string;
    holderDid: string;
    statusUrl: string;
    statusBaseUrl?: string;
    profile: string;
    state: string;
    sourceCredential?: JsonObject;
    decodedVc?: JsonObject | null;
    vcJwt?: string | null;
    grantSaid?: string | null;
    error?: string | null;
    [key: string]: unknown;
}

export interface W3CHeldCredential {
    credentialId: string;
    holderName: string;
    holderAid: string;
    holderDid: string;
    issuerAid: string;
    issuerDid: string;
    sourceCredentialSaid: string;
    schemaSaid: string;
    profile: string;
    statusUrl: string;
    vcJwt?: string;
    decodedVc?: JsonObject;
    state: string;
    error?: string | null;
    [key: string]: unknown;
}

export interface W3CPresentationResult {
    presentationId?: string | null;
    presentTxId?: string | null;
    holderName: string;
    holderAid: string;
    holderDid: string;
    contactId?: string;
    requestDescriptor?: JsonObject;
    state: string;
    nonce?: string | null;
    aud?: string | null;
    selectedCredentialId?: string | null;
    vpJwt?: string | null;
    verifierResponse?: unknown;
    submissionEndpoint?: string | null;
    error?: string | null;
    [key: string]: unknown;
}

interface IssueW3CCredentialArgs {
    client: SignifyClient;
    issuerName: string;
    sourceCredentialSaid: string;
    timeoutMs?: number;
    pollMs?: number;
}

interface PresentW3CCredentialArgs {
    client: SignifyClient;
    holderName: string;
    credentialId: string;
    verifierRequest: JsonObject;
}

interface W3CKeriaClientInstance {
    createIssuance(
        name: string,
        sourceCredentialSaid: string
    ): Promise<W3CIssuanceContext>;
    issuance(name: string, issuanceId: string): Promise<W3CIssuanceContext>;
    submitVcJwt(
        name: string,
        issuanceId: string,
        vcJwt: string
    ): Promise<W3CIssuanceContext>;
    deliverIssuance(
        name: string,
        issuance: W3CIssuanceContext
    ): Promise<W3CIssuanceContext>;
    credentials(name: string): Promise<W3CHeldCredential[]>;
    credential(name: string, credentialId: string): Promise<W3CHeldCredential>;
    present(
        name: string,
        descriptor: JsonObject,
        vpJwt: string
    ): Promise<W3CPresentationResult>;
}

interface SignifyW3CModule {
    W3C_GRANT_ROUTE: string;
    W3CKeriaClient: new (client: SignifyClient) => W3CKeriaClientInstance;
    decodeJwt(token: string): DecodedJwt;
    issueW3CCredential(
        args: IssueW3CCredentialArgs
    ): Promise<W3CIssuanceContext>;
    presentW3CCredential(
        args: PresentW3CCredentialArgs
    ): Promise<W3CPresentationResult>;
}

const signifyW3c = signifyW3cModule as unknown as SignifyW3CModule;

// Keep this app's consumed W3C edge surface explicit while delegating runtime
// behavior to the pinned signify-w3c package.
export const W3C_GRANT_ROUTE = signifyW3c.W3C_GRANT_ROUTE;
export const W3CKeriaClient = signifyW3c.W3CKeriaClient;

export const decodeJwt = (token: string): DecodedJwt =>
    signifyW3c.decodeJwt(token);

export const issueW3CCredential = (
    args: IssueW3CCredentialArgs
): Promise<W3CIssuanceContext> => signifyW3c.issueW3CCredential(args);

export const presentW3CCredential = (
    args: PresentW3CCredentialArgs
): Promise<W3CPresentationResult> => signifyW3c.presentW3CCredential(args);

export type W3CKeriaClient = W3CKeriaClientInstance;
