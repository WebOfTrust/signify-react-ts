/**
 * Minimal identifier shape rendered by the current UI.
 *
 * Signify returns richer per-algorithm payloads. Keep the index signature until
 * the identifier domain model is tightened; components should rely only on
 * `name`, `prefix`, and explicitly inspected dynamic fields.
 */
export interface IdentifierSummary {
    name: string;
    prefix: string;
    [key: string]: unknown;
}

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

/**
 * Dynamic create-form fields exposed by the legacy identifier creator.
 *
 * This is intentionally UI-local. Do not treat it as the authoritative Signify
 * identifier create schema.
 */
export type IdentifierCreateField =
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
    | 'ncount';

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
