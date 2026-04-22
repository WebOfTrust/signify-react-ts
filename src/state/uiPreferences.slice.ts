import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UiPreferencesState {
    hoverSoundMuted: boolean;
}

export const defaultUiPreferencesState: UiPreferencesState = {
    hoverSoundMuted: false,
};

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

export const uiPreferencesReducer = uiPreferencesSlice.reducer;
