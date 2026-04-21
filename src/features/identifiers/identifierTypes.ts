import { Algos, type CreateIdentiferArgs, type HabState } from 'signify-ts';

/**
 * Managed identifier shape returned by Signify/KERIA.
 *
 * Keep this alias transparent so app code consumes upstream domain types rather
 * than a hand-maintained local copy of identifier state.
 */
export type IdentifierSummary = HabState;

/**
 * Local async state for identifier create/rotate/load feedback.
 */
export type IdentifierActionState =
    | { status: 'idle'; message: null; error: null }
    | { status: 'running'; message: string; error: null }
    | { status: 'success'; message: string; error: null }
    | { status: 'error'; message: string; error: Error };

export const idleIdentifierAction: IdentifierActionState = {
    status: 'idle',
    message: null,
    error: null,
};

export type IdentifierCreateArgs = CreateIdentiferArgs;

export type IdentifierWitnessMode = 'none' | 'demo';

/**
 * User-intent draft for the single-sig identifier creator.
 *
 * Keep this narrower than upstream `CreateIdentiferArgs`: the form should
 * expose common identifier choices, while `identifierCreateDraftToArgs` owns
 * the mapping into the broader Signify API shape.
 */
export interface IdentifierCreateDraft {
    name: string;
    algo: Algos.salty | Algos.randy;
    transferable: boolean;
    witnessMode: IdentifierWitnessMode;
    count: number;
    ncount: number;
    isith: string;
    nsith: string;
    bran: string;
}
