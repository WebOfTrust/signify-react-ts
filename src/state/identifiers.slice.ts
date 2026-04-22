import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { IdentifierSummary } from '../features/identifiers/identifierTypes';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/**
 * Identifier inventory state normalized by AID prefix.
 */
export interface IdentifiersState {
    byPrefix: Record<string, IdentifierSummary>;
    prefixes: string[];
    loadedAt: string | null;
    lastMutation: string | null;
}

const createInitialState = (): IdentifiersState => ({
    byPrefix: {},
    prefixes: [],
    loadedAt: null,
    lastMutation: null,
});

const initialState: IdentifiersState = createInitialState();

/**
 * Replace identifier inventory after a list/create/rotate operation.
 */
const replaceIdentifiers = (
    state: IdentifiersState,
    identifiers: IdentifierSummary[],
    loadedAt: string
): void => {
    state.byPrefix = Object.fromEntries(
        identifiers.map((identifier) => [identifier.prefix, identifier])
    );
    state.prefixes = identifiers.map((identifier) => identifier.prefix);
    state.loadedAt = loadedAt;
};

/**
 * Redux slice for managed identifier inventory and last mutation metadata.
 */
export const identifiersSlice = createSlice({
    name: 'identifiers',
    initialState,
    reducers: {
        identifierListLoaded(
            state,
            {
                payload,
            }: PayloadAction<{
                identifiers: IdentifierSummary[];
                loadedAt: string;
            }>
        ) {
            replaceIdentifiers(state, payload.identifiers, payload.loadedAt);
        },
        identifierLoaded(
            state,
            {
                payload,
            }: PayloadAction<{
                identifier: IdentifierSummary;
                loadedAt: string;
            }>
        ) {
            state.byPrefix[payload.identifier.prefix] = payload.identifier;
            if (!state.prefixes.includes(payload.identifier.prefix)) {
                state.prefixes.push(payload.identifier.prefix);
            }
            state.loadedAt = payload.loadedAt;
        },
        identifierCreated(
            state,
            {
                payload,
            }: PayloadAction<{
                name: string;
                identifiers: IdentifierSummary[];
                updatedAt: string;
            }>
        ) {
            replaceIdentifiers(state, payload.identifiers, payload.updatedAt);
            state.lastMutation = `created:${payload.name}`;
        },
        identifierRotated(
            state,
            {
                payload,
            }: PayloadAction<{
                aid: string;
                identifiers: IdentifierSummary[];
                updatedAt: string;
            }>
        ) {
            replaceIdentifiers(state, payload.identifiers, payload.updatedAt);
            state.lastMutation = `rotated:${payload.aid}`;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(sessionConnecting, createInitialState)
            .addCase(sessionConnectionFailed, createInitialState)
            .addCase(sessionDisconnected, createInitialState);
    },
});

/** Action creators for identifier list and mutation results. */
export const {
    identifierListLoaded,
    identifierLoaded,
    identifierCreated,
    identifierRotated,
} = identifiersSlice.actions;

/** Reducer mounted at `state.identifiers`. */
export const identifiersReducer = identifiersSlice.reducer;
