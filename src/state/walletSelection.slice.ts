import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/**
 * Wallet-wide UI selection shared by top bar and feature routes.
 */
export interface WalletSelectionState {
    selectedAid: string | null;
    selectedRegistryId: string | null;
}

const createInitialState = (): WalletSelectionState => ({
    selectedAid: null,
    selectedRegistryId: null,
});

const initialState: WalletSelectionState = createInitialState();

export const walletSelectionSlice = createSlice({
    name: 'walletSelection',
    initialState,
    reducers: {
        walletAidSelected(state, { payload }: PayloadAction<{ aid: string }>) {
            const aid = payload.aid.trim();
            if (aid.length === 0) {
                state.selectedAid = null;
                state.selectedRegistryId = null;
                return;
            }

            if (state.selectedAid !== aid) {
                state.selectedRegistryId = null;
            }
            state.selectedAid = aid;
        },
        walletAidCleared(state) {
            state.selectedAid = null;
            state.selectedRegistryId = null;
        },
        walletRegistrySelected(
            state,
            { payload }: PayloadAction<{ registryId: string }>
        ) {
            const registryId = payload.registryId.trim();
            state.selectedRegistryId =
                registryId.length === 0 ? null : registryId;
        },
        walletRegistryCleared(state) {
            state.selectedRegistryId = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(sessionConnecting, createInitialState)
            .addCase(sessionConnectionFailed, createInitialState)
            .addCase(sessionDisconnected, createInitialState);
    },
});

export const {
    walletAidSelected,
    walletAidCleared,
    walletRegistrySelected,
    walletRegistryCleared,
} = walletSelectionSlice.actions;

export const walletSelectionReducer = walletSelectionSlice.reducer;
