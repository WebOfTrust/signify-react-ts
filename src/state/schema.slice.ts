import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/** Resolution lifecycle for a credential schema OOBI. */
export type SchemaResolutionStatus = 'unknown' | 'resolving' | 'resolved' | 'error';

/**
 * Local schema resolution record keyed by schema SAID.
 */
export interface SchemaRecord {
    said: string;
    oobi: string | null;
    status: SchemaResolutionStatus;
    title: string | null;
    description: string | null;
    version: string | null;
    rules?: Record<string, unknown> | null;
    error: string | null;
    updatedAt: string | null;
}

/**
 * Schema slice state keyed by schema SAID.
 */
export interface SchemaState {
    bySaid: Record<string, SchemaRecord>;
    saids: string[];
}

const createInitialState = (): SchemaState => ({
    bySaid: {},
    saids: [],
});

const initialState: SchemaState = createInitialState();

/**
 * Redux slice for credential schema resolution state.
 */
export const schemaSlice = createSlice({
    name: 'schema',
    initialState,
    reducers: {
        schemaRecorded(state, { payload }: PayloadAction<SchemaRecord>) {
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

/** Action creators for updating schema resolution records. */
export const { schemaRecorded } = schemaSlice.actions;

/** Reducer mounted at `state.schema`. */
export const schemaReducer = schemaSlice.reducer;
