import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Lifecycle of a credential registry known to the local issuer role. */
export type RegistryStatus = 'unknown' | 'creating' | 'ready' | 'error';

/**
 * Local registry projection keyed by registry id/key.
 */
export interface RegistryRecord {
    id: string;
    issuerAid: string;
    status: RegistryStatus;
    error: string | null;
    updatedAt: string | null;
}

/**
 * Registry slice state keyed by registry id.
 */
export interface RegistryState {
    byId: Record<string, RegistryRecord>;
    ids: string[];
}

const initialState: RegistryState = {
    byId: {},
    ids: [],
};

/**
 * Redux slice for credential registry creation/discovery state.
 */
export const registrySlice = createSlice({
    name: 'registry',
    initialState,
    reducers: {
        registryRecorded(state, { payload }: PayloadAction<RegistryRecord>) {
            state.byId[payload.id] = payload;
            if (!state.ids.includes(payload.id)) {
                state.ids.push(payload.id);
            }
        },
    },
});

/** Action creators for updating registry records. */
export const { registryRecorded } = registrySlice.actions;

/** Reducer mounted at `state.registry`. */
export const registryReducer = registrySlice.reducer;
