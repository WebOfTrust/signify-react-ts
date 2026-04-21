import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Resolution lifecycle for a contact OOBI. */
export type ContactResolutionStatus =
    | 'idle'
    | 'resolving'
    | 'resolved'
    | 'error';

/**
 * Local contact record created from OOBI resolution.
 */
export interface ContactRecord {
    id: string;
    alias: string;
    aid: string | null;
    oobi: string | null;
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
}

const initialState: ContactsState = {
    byId: {},
    ids: [],
};

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
            upsert(state, {
                id: payload.id,
                alias: payload.alias,
                aid: payload.aid,
                oobi: payload.oobi,
                resolutionStatus: 'resolved',
                error: null,
                updatedAt: payload.updatedAt,
            });
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
});

/** Action creators for starting, completing, or failing OOBI resolution. */
export const {
    contactResolutionStarted,
    contactResolved,
    contactResolutionFailed,
} = contactsSlice.actions;

/** Reducer mounted at `state.contacts`. */
export const contactsReducer = contactsSlice.reducer;
