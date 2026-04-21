import { Algos } from 'signify-ts';
import type {
    IdentifierCreateArgs,
    DynamicIdentifierField,
    IdentifierSummary,
} from './identifierTypes';

const NUMBER_FIELDS = new Set<keyof IdentifierCreateArgs>([
    'count',
    'ncount',
    'toad',
]);
const BOOLEAN_FIELDS = new Set<keyof IdentifierCreateArgs>(['transferable']);
const CSV_FIELDS = new Set<keyof IdentifierCreateArgs>([
    'prxs',
    'nxts',
    'wits',
    'keys',
    'ndigs',
]);

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
 * Convert dynamic create-dialog field rows into Signify identifier create args.
 *
 * This preserves legacy UI behavior: only `count` and `ncount` are parsed as
 * numbers, `transferable` is parsed as a boolean, and CSV fields are split
 * without trimming. Tightening those semantics should be a deliberate follow-up
 * with scenario coverage.
 */
export const parseIdentifierCreateArgs = (
    algo: Algos,
    fields: readonly DynamicIdentifierField[]
): IdentifierCreateArgs => {
    const args: IdentifierCreateArgs = {
        algo,
    };

    for (const { field, value } of fields) {
        if (NUMBER_FIELDS.has(field)) {
            args[field] = Number.parseInt(value, 10);
        } else if (BOOLEAN_FIELDS.has(field)) {
            args[field] = value === 'true';
        } else if (CSV_FIELDS.has(field)) {
            args[field] = value.split(',');
        } else {
            args[field] = value;
        }
    }

    return args;
};
