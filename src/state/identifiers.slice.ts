import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { IdentifierSummary } from '../features/identifiers/identifierTypes';

/**
 * Identifier inventory state normalized by AID prefix.
 */
export interface IdentifiersState {
    byPrefix: Record<string, IdentifierSummary>;
    prefixes: string[];
    loadedAt: string | null;
    lastMutation: string | null;
}

const initialState: IdentifiersState = {
    byPrefix: {},
    prefixes: [],
    loadedAt: null,
    lastMutation: null,
};

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
});

/** Action creators for identifier list and mutation results. */
export const { identifierListLoaded, identifierCreated, identifierRotated } =
    identifiersSlice.actions;

/** Reducer mounted at `state.identifiers`. */
export const identifiersReducer = identifiersSlice.reducer;
