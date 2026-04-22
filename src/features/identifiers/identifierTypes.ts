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

/**
 * Reusable idle action state for identifier route feedback.
 */
export const idleIdentifierAction: IdentifierActionState = {
    status: 'idle',
    message: null,
    error: null,
};

/**
 * Upstream Signify create-identifier args alias used at the service boundary.
 */
export type IdentifierCreateArgs = CreateIdentiferArgs;

/**
 * Witness selection mode exposed by the identifier create form.
 */
export type IdentifierWitnessMode = 'none' | 'demo';

/**
 * Delegation mode selected by the identifier create form.
 *
 * `none` keeps the existing self-addressing inception behavior. `delegated`
 * maps to Signify's `delpre` create argument and starts a long-running
 * delegate workflow that waits for manual delegator approval.
 */
export type IdentifierDelegationDraft =
    | { mode: 'none' }
    | { mode: 'delegated'; delegatorAid: string };

/**
 * One selectable delegator candidate in the create dialog.
 */
export interface IdentifierDelegatorOption {
    aid: string;
    label: string;
    source: 'local' | 'contact';
}

/**
 * One node in an identifier delegation chain, ordered from leaf/delegate to
 * root delegator.
 */
export interface IdentifierDelegationChainNode {
    aid: string;
    alias: string | null;
    source: 'local' | 'contact' | 'keyState' | 'unknown';
    sequence: string | null;
    eventSaid: string | null;
    delegatorAid: string | null;
}

/**
 * Async detail state for recursive delegation-chain loading.
 */
export interface IdentifierDelegationChainState {
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string | null;
    nodes: IdentifierDelegationChainNode[];
}

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
    delegation: IdentifierDelegationDraft;
    count: number;
    ncount: number;
    isith: string;
    nsith: string;
    bran: string;
}
