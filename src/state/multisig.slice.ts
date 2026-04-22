import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';
import type { MultisigGroupStatus } from '../features/multisig/multisigTypes';
import type { MultisigThresholdSpec } from '../features/multisig/multisigThresholds';

export interface MultisigGroupRecord {
    id: string;
    alias: string;
    groupAid: string | null;
    localMemberAid: string | null;
    signingMemberAids: string[];
    rotationMemberAids: string[];
    signingThreshold: MultisigThresholdSpec | null;
    rotationThreshold: MultisigThresholdSpec | null;
    status: MultisigGroupStatus;
    pendingRequestId: string | null;
    latestExchangeSaid: string | null;
    error: string | null;
    updatedAt: string;
}

export interface MultisigProposalRecord {
    id: string;
    route: string;
    exnSaid: string;
    groupAid: string | null;
    senderAid: string | null;
    signingMemberAids: string[];
    rotationMemberAids: string[];
    status: 'actionable' | 'processed' | 'notForThisWallet' | 'error';
    message: string | null;
    updatedAt: string;
}

export interface MultisigState {
    groupsById: Record<string, MultisigGroupRecord>;
    groupIds: string[];
    proposalsById: Record<string, MultisigProposalRecord>;
    proposalIds: string[];
}

const createInitialState = (): MultisigState => ({
    groupsById: {},
    groupIds: [],
    proposalsById: {},
    proposalIds: [],
});

const initialState = createInitialState();

const upsertGroup = (
    state: MultisigState,
    group: MultisigGroupRecord
): void => {
    state.groupsById[group.id] = group;
    if (!state.groupIds.includes(group.id)) {
        state.groupIds.push(group.id);
    }
};

const upsertProposal = (
    state: MultisigState,
    proposal: MultisigProposalRecord
): void => {
    state.proposalsById[proposal.id] = proposal;
    if (!state.proposalIds.includes(proposal.id)) {
        state.proposalIds.push(proposal.id);
    }
};

export const multisigSlice = createSlice({
    name: 'multisig',
    initialState,
    reducers: {
        multisigGroupRecorded(
            state,
            { payload }: PayloadAction<MultisigGroupRecord>
        ) {
            upsertGroup(state, payload);
        },
        multisigGroupStatusChanged(
            state,
            {
                payload,
            }: PayloadAction<{
                id: string;
                status: MultisigGroupStatus;
                updatedAt: string;
                error?: string | null;
                pendingRequestId?: string | null;
                latestExchangeSaid?: string | null;
                groupAid?: string | null;
            }>
        ) {
            const group = state.groupsById[payload.id];
            if (group === undefined) {
                return;
            }

            group.status = payload.status;
            group.updatedAt = payload.updatedAt;
            if (payload.error !== undefined) {
                group.error = payload.error;
            }
            if (payload.pendingRequestId !== undefined) {
                group.pendingRequestId = payload.pendingRequestId;
            }
            if (payload.latestExchangeSaid !== undefined) {
                group.latestExchangeSaid = payload.latestExchangeSaid;
            }
            if (payload.groupAid !== undefined) {
                group.groupAid = payload.groupAid;
            }
        },
        multisigProposalRecorded(
            state,
            { payload }: PayloadAction<MultisigProposalRecord>
        ) {
            upsertProposal(state, payload);
        },
        multisigProposalStatusChanged(
            state,
            {
                payload,
            }: PayloadAction<{
                id: string;
                status: MultisigProposalRecord['status'];
                updatedAt: string;
                message?: string | null;
            }>
        ) {
            const proposal = state.proposalsById[payload.id];
            if (proposal === undefined) {
                return;
            }

            proposal.status = payload.status;
            proposal.updatedAt = payload.updatedAt;
            proposal.message = payload.message ?? proposal.message;
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
    multisigGroupRecorded,
    multisigGroupStatusChanged,
    multisigProposalRecorded,
    multisigProposalStatusChanged,
} = multisigSlice.actions;

export const multisigReducer = multisigSlice.reducer;
