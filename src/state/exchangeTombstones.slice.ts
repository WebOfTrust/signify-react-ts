import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/**
 * Local reason for hiding an exchange-backed notification from app inventory.
 */
export type ExchangeTombstoneReason = 'userDismissed';

/**
 * Persisted marker for an EXN that KERIA may still return from exchange query.
 */
export interface ExchangeTombstoneRecord {
    exnSaid: string;
    route: string;
    notificationId?: string | null;
    reason: ExchangeTombstoneReason;
    createdAt: string;
}

/**
 * Normalized tombstone state keyed by EXN SAID.
 */
export interface ExchangeTombstonesState {
    bySaid: Record<string, ExchangeTombstoneRecord>;
    saids: string[];
}

const createInitialState = (): ExchangeTombstonesState => ({
    bySaid: {},
    saids: [],
});

const initialState = createInitialState();

/**
 * Slice for app-local deletes of exchange-backed synthetic notifications.
 */
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

/**
 * Reducer installed into the root store for exchange tombstone facts.
 */
export const exchangeTombstonesReducer = exchangeTombstonesSlice.reducer;
