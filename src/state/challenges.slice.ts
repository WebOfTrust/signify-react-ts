import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/** Direction of a challenge relative to this local app. */
export type ChallengeDirection = 'issued' | 'received';

/** Lifecycle state for challenge/response verification. */
export type ChallengeStatus = 'pending' | 'responded' | 'verified' | 'failed';

/**
 * Durable summary of one challenge exchange.
 */
export interface ChallengeRecord {
    id: string;
    direction: ChallengeDirection;
    role: string;
    counterpartyAid: string;
    words: string[];
    authenticated: boolean;
    status: ChallengeStatus;
    result: string | null;
    updatedAt: string;
}

/**
 * Challenge slice state keyed by local challenge id.
 */
export interface ChallengesState {
    byId: Record<string, ChallengeRecord>;
    ids: string[];
    loadedAt: string | null;
}

const createInitialState = (): ChallengesState => ({
    byId: {},
    ids: [],
    loadedAt: null,
});

const initialState: ChallengesState = createInitialState();

/**
 * Redux slice for challenge/response workflow progress.
 */
export const challengesSlice = createSlice({
    name: 'challenges',
    initialState,
    reducers: {
        challengesLoaded(
            state,
            {
                payload,
            }: PayloadAction<{
                challenges: ChallengeRecord[];
                loadedAt: string;
            }>
        ) {
            state.byId = Object.fromEntries(
                payload.challenges.map((challenge) => [
                    challenge.id,
                    challenge,
                ])
            );
            state.ids = payload.challenges.map((challenge) => challenge.id);
            state.loadedAt = payload.loadedAt;
        },
        challengeRecorded(state, { payload }: PayloadAction<ChallengeRecord>) {
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

/** Action creators for recording challenge workflow progress. */
export const { challengesLoaded, challengeRecorded } = challengesSlice.actions;

/** Reducer mounted at `state.challenges`. */
export const challengesReducer = challengesSlice.reducer;
