import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
    sessionConnectionFailed,
    sessionConnecting,
    sessionDisconnected,
} from './session.slice';

/** Demo role names used by issuer/holder/verifier workflows. */
export type LocalRole = 'issuer' | 'holder' | 'verifier';

/**
 * Local role binding to an AID and optional credential registry.
 */
export interface RoleRecord {
    role: LocalRole;
    alias: string | null;
    aid: string | null;
    registryId: string | null;
    updatedAt: string | null;
}

/**
 * Roles slice state keyed by the closed demo role set.
 */
export interface RolesState {
    byRole: Record<LocalRole, RoleRecord>;
}

/**
 * Create an unbound role record for initial state.
 */
const emptyRole = (role: LocalRole): RoleRecord => ({
    role,
    alias: null,
    aid: null,
    registryId: null,
    updatedAt: null,
});

const createInitialState = (): RolesState => ({
    byRole: {
        issuer: emptyRole('issuer'),
        holder: emptyRole('holder'),
        verifier: emptyRole('verifier'),
    },
});

const initialState: RolesState = createInitialState();

/**
 * Redux slice for issuer/holder/verifier role bindings.
 */
export const rolesSlice = createSlice({
    name: 'roles',
    initialState,
    reducers: {
        roleRecorded(state, { payload }: PayloadAction<RoleRecord>) {
            state.byRole[payload.role] = payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(sessionConnecting, createInitialState)
            .addCase(sessionConnectionFailed, createInitialState)
            .addCase(sessionDisconnected, createInitialState);
    },
});

/** Action creators for updating role bindings. */
export const { roleRecorded } = rolesSlice.actions;

/** Reducer mounted at `state.roles`. */
export const rolesReducer = rolesSlice.reducer;
