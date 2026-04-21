import type { CreateIdentiferArgs, HabState } from 'signify-ts';

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

/**
 * Dynamic create-form fields exposed by the legacy identifier creator.
 *
 * This is intentionally UI-local. Do not treat it as the authoritative Signify
 * identifier create schema.
 */
export type IdentifierCreateField = Extract<
    keyof CreateIdentiferArgs,
    | 'transferable'
    | 'isith'
    | 'nsith'
    | 'wits'
    | 'toad'
    | 'proxy'
    | 'delpre'
    | 'dcode'
    | 'data'
    | 'pre'
    | 'states'
    | 'rstates'
    | 'prxs'
    | 'nxts'
    | 'mhab'
    | 'keys'
    | 'ndigs'
    | 'bran'
    | 'count'
    | 'ncount'
>;

export interface DynamicIdentifierField {
    field: IdentifierCreateField;
    value: string;
}

/**
 * Ordered select options for `IdentifierCreateDialog`.
 */
export const IDENTIFIER_CREATE_FIELDS: readonly IdentifierCreateField[] = [
    'transferable',
    'isith',
    'nsith',
    'wits',
    'toad',
    'proxy',
    'delpre',
    'dcode',
    'data',
    'pre',
    'states',
    'rstates',
    'prxs',
    'nxts',
    'mhab',
    'keys',
    'ndigs',
    'bran',
    'count',
    'ncount',
] as const;
