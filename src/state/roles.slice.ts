import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

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

const initialState: RolesState = {
    byRole: {
        issuer: emptyRole('issuer'),
        holder: emptyRole('holder'),
        verifier: emptyRole('verifier'),
    },
};

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
});

/** Action creators for updating role bindings. */
export const { roleRecorded } = rolesSlice.actions;

/** Reducer mounted at `state.roles`. */
export const rolesReducer = rolesSlice.reducer;
