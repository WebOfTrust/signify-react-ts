import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

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
}

const initialState: ChallengesState = {
    byId: {},
    ids: [],
};

/**
 * Redux slice for challenge/response workflow progress.
 */
export const challengesSlice = createSlice({
    name: 'challenges',
    initialState,
    reducers: {
        challengeRecorded(state, { payload }: PayloadAction<ChallengeRecord>) {
            state.byId[payload.id] = payload;
            if (!state.ids.includes(payload.id)) {
                state.ids.push(payload.id);
            }
        },
    },
});

/** Action creators for recording challenge workflow progress. */
export const { challengeRecorded } = challengesSlice.actions;

/** Reducer mounted at `state.challenges`. */
export const challengesReducer = challengesSlice.reducer;
