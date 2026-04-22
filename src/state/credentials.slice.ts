import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/** Local status of a credential as it moves through issuer/holder/verifier flows. */
export type CredentialStatus =
    | 'draft'
    | 'issued'
    | 'granted'
    | 'admitted'
    | 'presented'
    | 'revoked';

/**
 * Minimal credential projection stored for workflow/UI coordination.
 */
export interface CredentialSummaryRecord {
    said: string;
    schemaSaid: string | null;
    issuerAid: string | null;
    holderAid: string | null;
    status: CredentialStatus;
    updatedAt: string;
}

/**
 * Credential slice state keyed by credential SAID.
 */
export interface CredentialsState {
    bySaid: Record<string, CredentialSummaryRecord>;
    saids: string[];
}

const createInitialState = (): CredentialsState => ({
    bySaid: {},
    saids: [],
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
            state.bySaid[payload.said] = payload;
            if (!state.saids.includes(payload.said)) {
                state.saids.push(payload.said);
            }
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
export const { credentialRecorded } = credentialsSlice.actions;

/** Reducer mounted at `state.credentials`. */
export const credentialsReducer = credentialsSlice.reducer;
