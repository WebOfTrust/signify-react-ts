import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/**
 * Subject attributes for the demo SEDI voter credential.
 */
export interface SediVoterCredentialAttributes {
    i: string;
    fullName: string;
    voterId: string;
    precinctId: string;
    county: string;
    jurisdiction: string;
    electionId: string;
    eligible: boolean;
    expires: string;
}

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
    attributes: SediVoterCredentialAttributes | null;
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

/**
 * Credential slice state keyed by credential SAID.
 */
export interface CredentialsState {
    bySaid: Record<string, CredentialSummaryRecord>;
    saids: string[];
    ipexActivityByCredentialSaid: Record<
        string,
        CredentialIpexActivityRecord[]
    >;
    ipexActivityLoadedAt: string | null;
}

const createInitialState = (): CredentialsState => ({
    bySaid: {},
    saids: [],
    ipexActivityByCredentialSaid: {},
    ipexActivityLoadedAt: null,
});

const initialState: CredentialsState = createInitialState();

/**
 * Redux slice for credential inventory and lifecycle status.
 */
export const credentialsSlice = createSlice({
    name: 'credentials',
    initialState,
    reducers: {
        credentialRecorded(
            state,
            { payload }: PayloadAction<CredentialSummaryRecord>
        ) {
            const existing = state.bySaid[payload.said];
            state.bySaid[payload.said] =
                existing === undefined
                    ? payload
                    : {
                          ...existing,
                          ...payload,
                          attributes:
                              payload.attributes ?? existing.attributes,
                          grantSaid: payload.grantSaid ?? existing.grantSaid,
                          admitSaid: payload.admitSaid ?? existing.admitSaid,
                          notificationId:
                              payload.notificationId ??
                              existing.notificationId,
                          issuedAt: payload.issuedAt ?? existing.issuedAt,
                          grantedAt: payload.grantedAt ?? existing.grantedAt,
                          admittedAt: payload.admittedAt ?? existing.admittedAt,
                          revokedAt: payload.revokedAt ?? existing.revokedAt,
                          error: payload.error ?? null,
                      };
            if (!state.saids.includes(payload.said)) {
                state.saids.push(payload.said);
            }
        },
        credentialInventoryLoaded(
            state,
            {
                payload,
            }: PayloadAction<{
                credentials: CredentialSummaryRecord[];
            }>
        ) {
            for (const credential of payload.credentials) {
                const existing = state.bySaid[credential.said];
                state.bySaid[credential.said] =
                    existing === undefined
                        ? credential
                        : {
                              ...existing,
                              ...credential,
                              attributes:
                                  credential.attributes ?? existing.attributes,
                              grantSaid:
                                  credential.grantSaid ?? existing.grantSaid,
                              admitSaid:
                                  credential.admitSaid ?? existing.admitSaid,
                              notificationId:
                                  credential.notificationId ??
                                  existing.notificationId,
                              grantedAt:
                                  credential.grantedAt ?? existing.grantedAt,
                              admittedAt:
                                  credential.admittedAt ?? existing.admittedAt,
                              revokedAt:
                                  credential.revokedAt ?? existing.revokedAt,
                              error: credential.error ?? existing.error,
                          };
                if (!state.saids.includes(credential.said)) {
                    state.saids.push(credential.said);
                }
            }
        },
        credentialIpexActivityLoaded(
            state,
            {
                payload,
            }: PayloadAction<{
                activities: CredentialIpexActivityRecord[];
                loadedAt: string;
            }>
        ) {
            const byCredential: Record<string, CredentialIpexActivityRecord[]> =
                {};
            for (const activity of payload.activities) {
                byCredential[activity.credentialSaid] = [
                    ...(byCredential[activity.credentialSaid] ?? []),
                    activity,
                ];
            }

            state.ipexActivityByCredentialSaid = byCredential;
            state.ipexActivityLoadedAt = payload.loadedAt;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(sessionConnecting, createInitialState)
            .addCase(sessionConnectionFailed, createInitialState)
            .addCase(sessionDisconnected, createInitialState);
    },
});

/** Action creators for updating credential summary state. */
export const {
    credentialInventoryLoaded,
    credentialIpexActivityLoaded,
    credentialRecorded,
} = credentialsSlice.actions;

/** Reducer mounted at `state.credentials`. */
export const credentialsReducer = credentialsSlice.reducer;
