import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/** Resolution lifecycle for a contact OOBI. */
export type ContactResolutionStatus =
    | 'idle'
    | 'resolving'
    | 'resolved'
    | 'error';

/** KERIA endpoint roles surfaced from contact `ends` records. */
export type ContactEndpointRole =
    | 'agent'
    | 'controller'
    | 'witness'
    | 'registrar'
    | 'watcher'
    | 'judge'
    | 'juror'
    | 'peer'
    | 'mailbox';

/** One endpoint authorization known for a contact/component. */
export interface ContactEndpoint {
    role: ContactEndpointRole;
    eid: string;
    scheme: string;
    url: string;
}

/** One well-known record attached to a contact. */
export interface ContactWellKnown {
    url: string;
    dt: string;
}

/** Generated OOBI inventory for a local identifier. */
export interface GeneratedOobiRecord {
    id: string;
    identifier: string;
    role: 'agent' | 'witness';
    oobis: string[];
    generatedAt: string;
}

/**
 * Local contact record created from OOBI resolution.
 */
export interface ContactRecord {
    id: string;
    alias: string;
    aid: string | null;
    oobi: string | null;
    endpoints: ContactEndpoint[];
    wellKnowns: ContactWellKnown[];
    componentTags: string[];
    challengeCount: number;
    authenticatedChallengeCount: number;
    resolutionStatus: ContactResolutionStatus;
    error: string | null;
    updatedAt: string | null;
}

/**
 * Contact slice state keyed by stable contact id.
 */
export interface ContactsState {
    byId: Record<string, ContactRecord>;
    ids: string[];
    generatedOobis: Record<string, GeneratedOobiRecord>;
    generatedOobiIds: string[];
    loadedAt: string | null;
}

const createInitialState = (): ContactsState => ({
    byId: {},
    ids: [],
    generatedOobis: {},
    generatedOobiIds: [],
    loadedAt: null,
});

const initialState: ContactsState = createInitialState();

/**
 * Insert or replace a contact while preserving insertion order.
 */
const upsert = (state: ContactsState, contact: ContactRecord): void => {
    state.byId[contact.id] = contact;
    if (!state.ids.includes(contact.id)) {
        state.ids.push(contact.id);
    }
};

/**
 * Redux slice for contact/OOBI resolution state.
 */
export const contactsSlice = createSlice({
    name: 'contacts',
    initialState,
    reducers: {
        contactInventoryLoaded(
            state,
            {
                payload,
            }: PayloadAction<{ contacts: ContactRecord[]; loadedAt: string }>
        ) {
            const resolving = state.ids
                .map((id) => state.byId[id])
                .filter(
                    (contact): contact is ContactRecord =>
                        contact?.resolutionStatus === 'resolving'
                );
            state.byId = {};
            state.ids = [];
            for (const contact of payload.contacts) {
                upsert(state, contact);
            }
            for (const contact of resolving) {
                if (state.byId[contact.id] === undefined) {
                    upsert(state, contact);
                }
            }
            state.loadedAt = payload.loadedAt;
        },
        contactResolutionStarted(
            state,
            {
                payload,
            }: PayloadAction<{
                id: string;
                alias: string;
                oobi: string;
                updatedAt: string;
            }>
        ) {
            upsert(state, {
                id: payload.id,
                alias: payload.alias,
                aid: state.byId[payload.id]?.aid ?? null,
                oobi: payload.oobi,
                endpoints: state.byId[payload.id]?.endpoints ?? [],
                wellKnowns: state.byId[payload.id]?.wellKnowns ?? [],
                componentTags: state.byId[payload.id]?.componentTags ?? [],
                challengeCount: state.byId[payload.id]?.challengeCount ?? 0,
                authenticatedChallengeCount:
                    state.byId[payload.id]?.authenticatedChallengeCount ?? 0,
                resolutionStatus: 'resolving',
                error: null,
                updatedAt: payload.updatedAt,
            });
        },
        contactResolved(
            state,
            {
                payload,
            }: PayloadAction<{
                id: string;
                alias: string;
                aid: string;
                oobi: string | null;
                updatedAt: string;
            }>
        ) {
            const existing = state.byId[payload.id];
            upsert(state, {
                id: payload.id,
                alias: payload.alias,
                aid: payload.aid,
                oobi: payload.oobi,
                endpoints: existing?.endpoints ?? [],
                wellKnowns: existing?.wellKnowns ?? [],
                componentTags: existing?.componentTags ?? [],
                challengeCount: existing?.challengeCount ?? 0,
                authenticatedChallengeCount:
                    existing?.authenticatedChallengeCount ?? 0,
                resolutionStatus: 'resolved',
                error: null,
                updatedAt: payload.updatedAt,
            });
        },
        contactDeleted(state, { payload }: PayloadAction<{ id: string }>) {
            delete state.byId[payload.id];
            state.ids = state.ids.filter((id) => id !== payload.id);
        },
        generatedOobiRecorded(
            state,
            { payload }: PayloadAction<GeneratedOobiRecord>
        ) {
            state.generatedOobis[payload.id] = payload;
            state.generatedOobiIds = state.generatedOobiIds.filter(
                (id) => id !== payload.id
            );
            state.generatedOobiIds.push(payload.id);
        },
        contactResolutionFailed(
            state,
            {
                payload,
            }: PayloadAction<{ id: string; error: string; updatedAt: string }>
        ) {
            const contact = state.byId[payload.id];
            if (contact !== undefined) {
                contact.resolutionStatus = 'error';
                contact.error = payload.error;
                contact.updatedAt = payload.updatedAt;
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

/** Action creators for starting, completing, or failing OOBI resolution. */
export const {
    contactInventoryLoaded,
    contactResolutionStarted,
    contactResolved,
    contactDeleted,
    generatedOobiRecorded,
    contactResolutionFailed,
} = contactsSlice.actions;

/** Reducer mounted at `state.contacts`. */
export const contactsReducer = contactsSlice.reducer;
