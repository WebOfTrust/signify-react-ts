import type {
    DynamicIdentifierField,
    IdentifierSummary,
} from './identifierTypes';

const NUMBER_FIELDS = new Set(['count', 'ncount']);
const BOOLEAN_FIELDS = new Set(['transferable']);
const CSV_FIELDS = new Set([
    'icodes',
    'ncodes',
    'prxs',
    'nxts',
    'cuts',
    'adds',
    'wits',
]);

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
        return response as IdentifierSummary[];
    }

    if (
        typeof response === 'object' &&
        response !== null &&
        'aids' in response &&
        Array.isArray(response.aids)
    ) {
        return response.aids as IdentifierSummary[];
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
    algo: string,
    fields: readonly DynamicIdentifierField[]
): Record<string, unknown> => {
    const args: Record<string, unknown> = {
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
