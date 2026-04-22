import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

export type ExchangeTombstoneReason = 'userDismissed';

export interface ExchangeTombstoneRecord {
    exnSaid: string;
    route: string;
    notificationId?: string | null;
    reason: ExchangeTombstoneReason;
    createdAt: string;
}

export interface ExchangeTombstonesState {
    bySaid: Record<string, ExchangeTombstoneRecord>;
    saids: string[];
}

const createInitialState = (): ExchangeTombstonesState => ({
    bySaid: {},
    saids: [],
});

const initialState = createInitialState();

export const exchangeTombstonesSlice = createSlice({
    name: 'exchangeTombstones',
    initialState,
    reducers: {
        exchangeTombstoneRecorded(
            state,
            { payload }: PayloadAction<ExchangeTombstoneRecord>
        ) {
            state.bySaid[payload.exnSaid] = payload;
            if (!state.saids.includes(payload.exnSaid)) {
                state.saids.push(payload.exnSaid);
            }
        },
        exchangeTombstonesRehydrated(
            state,
            { payload }: PayloadAction<{ records: ExchangeTombstoneRecord[] }>
        ) {
            state.bySaid = Object.fromEntries(
                payload.records.map((record) => [record.exnSaid, record])
            );
            state.saids = payload.records.map((record) => record.exnSaid);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(sessionConnecting, createInitialState)
            .addCase(sessionConnectionFailed, createInitialState)
            .addCase(sessionDisconnected, createInitialState);
    },
});

export const { exchangeTombstoneRecorded, exchangeTombstonesRehydrated } =
    exchangeTombstonesSlice.actions;

export const exchangeTombstonesReducer = exchangeTombstonesSlice.reducer;
