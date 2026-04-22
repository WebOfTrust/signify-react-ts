import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/**
 * Global, non-secret interface preferences.
 */
export interface UiPreferencesState {
    hoverSoundMuted: boolean;
}

/**
 * Default browser UI preferences before localStorage rehydration.
 */
export const defaultUiPreferencesState: UiPreferencesState = {
    hoverSoundMuted: false,
};

/**
 * Reducers for global UI preferences that are independent of Signify sessions.
 */
export const uiPreferencesSlice = createSlice({
    name: 'uiPreferences',
    initialState: defaultUiPreferencesState,
    reducers: {
        hoverSoundMutedSet(state, { payload }: PayloadAction<boolean>) {
            state.hoverSoundMuted = payload;
        },
        hoverSoundMutedToggled(state) {
            state.hoverSoundMuted = !state.hoverSoundMuted;
        },
    },
});

export const { hoverSoundMutedSet, hoverSoundMutedToggled } =
    uiPreferencesSlice.actions;

/**
 * Reducer installed into the root Redux store for interface preferences.
 */
export const uiPreferencesReducer = uiPreferencesSlice.reducer;
