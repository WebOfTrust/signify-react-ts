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

/** Origin for a challenge record in session state. */
export type ChallengeSource = 'keria' | 'workflow';

/**
 * Durable summary of one challenge exchange.
 */
export interface ChallengeRecord {
    id: string;
    source?: ChallengeSource;
    direction: ChallengeDirection;
    role: string;
    counterpartyAid: string;
    counterpartyAlias?: string | null;
    localIdentifier?: string | null;
    localAid?: string | null;
    words: string[];
    wordsHash?: string | null;
    responseSaid?: string | null;
    authenticated: boolean;
    status: ChallengeStatus;
    result: string | null;
    error?: string | null;
    generatedAt?: string | null;
    sentAt?: string | null;
    verifiedAt?: string | null;
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

const challengeMergeKey = (challenge: ChallengeRecord): string =>
    challenge.wordsHash === undefined || challenge.wordsHash === null
        ? challenge.id
        : `${challenge.counterpartyAid}:${challenge.wordsHash}`;

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
            const inventoryKeys = new Set(
                payload.challenges.map(challengeMergeKey)
            );
            const preservedWorkflowRecords = state.ids
                .map((id) => state.byId[id])
                .filter(
                    (challenge): challenge is ChallengeRecord =>
                        challenge?.source === 'workflow' &&
                        !inventoryKeys.has(challengeMergeKey(challenge))
                );
            const nextChallenges = [
                ...preservedWorkflowRecords,
                ...payload.challenges,
            ];

            state.byId = Object.fromEntries(
                nextChallenges.map((challenge) => [challenge.id, challenge])
            );
            state.ids = nextChallenges.map((challenge) => challenge.id);
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
