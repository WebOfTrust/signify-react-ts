import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

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

const createInitialState = (): RegistryState => ({
    byId: {},
    ids: [],
});

const initialState: RegistryState = createInitialState();

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
    extraReducers: (builder) => {
        builder
            .addCase(sessionConnecting, createInitialState)
            .addCase(sessionConnectionFailed, createInitialState)
            .addCase(sessionDisconnected, createInitialState);
    },
});

/** Action creators for updating registry records. */
export const { registryRecorded } = registrySlice.actions;

/** Reducer mounted at `state.registry`. */
export const registryReducer = registrySlice.reducer;
