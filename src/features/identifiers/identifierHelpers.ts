import { Algos } from 'signify-ts';
import type { AppConfig } from '../../config';
import type {
    IdentifierCreateArgs,
    IdentifierCreateDraft,
    IdentifierSummary,
} from './identifierTypes';

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const identifierUnavailableValue = 'Unavailable';

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
 * Replace one identifier in a list with a freshly fetched summary.
 */
export const replaceIdentifierSummary = (
    identifiers: readonly IdentifierSummary[],
    updated: IdentifierSummary
): IdentifierSummary[] => {
    let replaced = false;
    const next = identifiers.map((identifier) => {
        if (
            identifier.prefix === updated.prefix ||
            identifier.name === updated.name
        ) {
            replaced = true;
            return updated;
        }

        return identifier;
    });

    return replaced ? next : [...next, updated];
};

/**
 * Best-effort identifier algorithm/type label from Signify's tagged HabState.
 */
export const identifierType = (identifier: IdentifierSummary): string =>
    'salty' in identifier
        ? 'salty'
        : 'randy' in identifier
          ? 'randy'
          : 'group' in identifier
            ? 'group'
            : 'extern' in identifier
              ? 'extern'
              : identifierUnavailableValue;

/**
 * Current public keys advertised by the identifier's current key state.
 */
export const identifierCurrentKeys = (
    identifier: IdentifierSummary
): readonly string[] => {
    const state = (identifier as { state?: { k?: unknown } }).state;

    if (!Array.isArray(state?.k)) {
        return [];
    }

    return state.k.filter((key): key is string => typeof key === 'string');
};

/**
 * First current public key for compact single-key display.
 */
export const identifierCurrentKey = (
    identifier: IdentifierSummary
): string | null => identifierCurrentKeys(identifier)[0] ?? null;

/**
 * Current key index for identifier types that expose local key-manager state.
 *
 * Do not derive this from event sequence numbers for unsupported identifier
 * types. Missing local manager metadata should render as unavailable.
 */
export const identifierKeyIndex = (
    identifier: IdentifierSummary
): number | null =>
    'salty' in identifier && typeof identifier.salty.kidx === 'number'
        ? identifier.salty.kidx
        : null;

/**
 * Identifier index for identifier types that expose local key-manager state.
 *
 * Do not derive this for randy/group/extern identifiers unless Signify exposes
 * an explicit field for it.
 */
export const identifierIdentifierIndex = (
    identifier: IdentifierSummary
): number | null =>
    'salty' in identifier && typeof identifier.salty.pidx === 'number'
        ? identifier.salty.pidx
        : null;

/**
 * Key derivation tier for identifier types that expose local key-manager state.
 */
export const identifierTier = (identifier: IdentifierSummary): string | null =>
    'salty' in identifier && typeof identifier.salty.tier === 'string'
        ? identifier.salty.tier
        : null;

/**
 * Format nullable identifier metadata without inventing unavailable values.
 */
export const formatIdentifierMetadata = (
    value: number | string | null | undefined
): string => {
    if (value === null || value === undefined || value === '') {
        return identifierUnavailableValue;
    }

    return String(value);
};

/**
 * Full identifier JSON payload for advanced inspection.
 */
export const identifierJson = (identifier: IdentifierSummary): string =>
    JSON.stringify(identifier, null, 2);

/**
 * Keep long AIDs readable while preserving both identifying edges.
 */
export const truncateMiddle = (
    value: string,
    edgeLength = 8,
    separator = '...'
): string => {
    const minimumTruncatedLength = edgeLength * 2 + separator.length;

    if (value.length <= minimumTruncatedLength) {
        return value;
    }

    return `${value.slice(0, edgeLength)}${separator}${value.slice(-edgeLength)}`;
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
