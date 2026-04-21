import { Algos } from 'signify-ts';
import type { AppConfig } from '../../config';
import type {
    IdentifierCreateArgs,
    IdentifierCreateDraft,
    IdentifierSummary,
} from './identifierTypes';

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

/**
 * Runtime guard for the subset of `HabState` required by the identifier UI.
 */
export const isIdentifierSummary = (
    value: unknown
): value is IdentifierSummary =>
    isObjectRecord(value) &&
    typeof value.name === 'string' &&
    typeof value.prefix === 'string';

/**
 * Normalize the shapes returned by current and older Signify identifier list
 * calls.
 *
 * Some call sites see a bare array, while KERIA-backed list calls usually
 * return `{ aids: [...] }`. Keep this helper narrow and tested so the table
 * component does not learn transport response shapes.
 */
export const identifiersFromResponse = (
    response: unknown
): IdentifierSummary[] => {
    if (Array.isArray(response)) {
        return response.filter(isIdentifierSummary);
    }

    if (
        isObjectRecord(response) &&
        'aids' in response &&
        Array.isArray(response.aids)
    ) {
        return response.aids.filter(isIdentifierSummary);
    }

    return [];
};

/**
 * Default single-sig create draft used by the identifier create dialog.
 */
export const defaultIdentifierCreateDraft = (): IdentifierCreateDraft => ({
    name: '',
    algo: Algos.salty,
    transferable: true,
    witnessMode: 'none',
    count: 1,
    ncount: 1,
    isith: '1',
    nsith: '1',
    bran: '',
});

const isIdentifierCreateAlgo = (
    value: unknown
): value is IdentifierCreateDraft['algo'] =>
    value === Algos.salty || value === Algos.randy;

const isIdentifierWitnessMode = (
    value: unknown
): value is IdentifierCreateDraft['witnessMode'] =>
    value === 'none' || value === 'demo';

const isPositiveInteger = (value: unknown): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value > 0;

/**
 * Runtime guard for identifier create submissions from route actions.
 */
export const isIdentifierCreateDraft = (
    value: unknown
): value is IdentifierCreateDraft =>
    isObjectRecord(value) &&
    typeof value.name === 'string' &&
    value.name.trim().length > 0 &&
    isIdentifierCreateAlgo(value.algo) &&
    typeof value.transferable === 'boolean' &&
    isIdentifierWitnessMode(value.witnessMode) &&
    isPositiveInteger(value.count) &&
    isPositiveInteger(value.ncount) &&
    typeof value.isith === 'string' &&
    value.isith.trim().length > 0 &&
    typeof value.nsith === 'string' &&
    value.nsith.trim().length > 0 &&
    typeof value.bran === 'string';

/**
 * Convert the app's typed create draft into upstream Signify create args.
 */
export const identifierCreateDraftToArgs = (
    draft: IdentifierCreateDraft,
    config: AppConfig
): IdentifierCreateArgs => {
    const args: IdentifierCreateArgs = {
        algo: draft.algo,
        transferable: draft.transferable,
        count: draft.count,
        ncount: draft.ncount,
        isith: draft.isith,
        nsith: draft.nsith,
    };

    if (draft.algo === Algos.salty && draft.bran.trim().length > 0) {
        args.bran = draft.bran.trim();
    }

    if (draft.witnessMode === 'demo') {
        args.wits = config.witnesses.aids;
        args.toad = config.witnesses.toad;
    }

    return args;
};
