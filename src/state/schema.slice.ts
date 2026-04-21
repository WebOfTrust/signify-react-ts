import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Resolution lifecycle for a credential schema OOBI. */
export type SchemaResolutionStatus = 'unknown' | 'resolving' | 'resolved' | 'error';

/**
 * Local schema resolution record keyed by schema SAID.
 */
export interface SchemaRecord {
    said: string;
    oobi: string | null;
    status: SchemaResolutionStatus;
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

const initialState: SchemaState = {
    bySaid: {},
    saids: [],
};

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
});

/** Action creators for updating schema resolution records. */
export const { schemaRecorded } = schemaSlice.actions;

/** Reducer mounted at `state.schema`. */
export const schemaReducer = schemaSlice.reducer;
