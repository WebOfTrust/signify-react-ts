import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Connection lifecycle mirrored from `AppRuntime` into Redux. */
export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * Serializable connection summary for shell/UI selectors.
 */
export interface SessionState {
    status: SessionStatus;
    booted: boolean;
    controllerAid: string | null;
    agentAid: string | null;
    error: string | null;
    connectedAt: string | null;
}

/**
 * Payload emitted after a successful Signify/KERIA connection.
 */
export interface SessionConnectedPayload {
    booted: boolean;
    controllerAid: string | null;
    agentAid: string | null;
    connectedAt: string;
}

const initialState: SessionState = {
    status: 'idle',
    booted: false,
    controllerAid: null,
    agentAid: null,
    error: null,
    connectedAt: null,
};

/**
 * Redux slice for session connection state.
 */
export const sessionSlice = createSlice({
    name: 'session',
    initialState,
    reducers: {
        sessionConnecting(state) {
            state.status = 'connecting';
            state.booted = false;
            state.controllerAid = null;
            state.agentAid = null;
            state.error = null;
            state.connectedAt = null;
        },
        sessionConnected(
            state,
            { payload }: PayloadAction<SessionConnectedPayload>
        ) {
            state.status = 'connected';
            state.booted = payload.booted;
            state.controllerAid = payload.controllerAid;
            state.agentAid = payload.agentAid;
            state.error = null;
            state.connectedAt = payload.connectedAt;
        },
        sessionStateRefreshed(
            state,
            {
                payload,
            }: PayloadAction<{
                controllerAid: string | null;
                agentAid: string | null;
            }>
        ) {
            state.controllerAid = payload.controllerAid;
            state.agentAid = payload.agentAid;
        },
        sessionConnectionFailed(state, { payload }: PayloadAction<string>) {
            state.status = 'error';
            state.booted = false;
            state.controllerAid = null;
            state.agentAid = null;
            state.error = payload;
            state.connectedAt = null;
        },
        sessionDisconnected() {
            return initialState;
        },
    },
});

/** Action creators for connection lifecycle updates. */
export const {
    sessionConnecting,
    sessionConnected,
    sessionStateRefreshed,
    sessionConnectionFailed,
    sessionDisconnected,
} = sessionSlice.actions;

/** Reducer mounted at `state.session`. */
export const sessionReducer = sessionSlice.reducer;
