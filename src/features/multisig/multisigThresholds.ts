import { Tholder } from 'signify-ts';

/**
 * Signify threshold values for weighted multisig groups.
 *
 * Flat weighted thresholds serialize as a single clause of member weights.
 * Nested thresholds serialize as ordered clauses, where each clause must meet
 * Signify's weighted threshold semantics independently.
 */
export type MultisigThresholdSith = string | number | string[] | string[][];

export type MultisigThresholdSpec =
    | {
          mode: 'autoEqual';
          memberAids: string[];
      }
    | {
          mode: 'customFlat';
          weights: MultisigThresholdWeight[];
      }
    | {
          mode: 'nestedWeighted';
          clauses: MultisigThresholdClause[];
      }
    | {
          mode: 'numeric';
          value: string | number;
      };

export interface MultisigThresholdWeight {
    memberAid: string;
    weight: string;
}

export interface MultisigThresholdClause {
    id: string;
    weights: MultisigThresholdWeight[];
}

export interface MultisigThresholdParseResult {
    spec: MultisigThresholdSpec;
    sith: MultisigThresholdSith;
    memberAids: string[];
}

const cleanAid = (aid: string): string => aid.trim();

const cleanWeight = (weight: string): string => weight.trim();

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');

const isNestedStringArray = (value: unknown): value is string[][] =>
    Array.isArray(value) && value.every(isStringArray);

const isThresholdWeight = (value: unknown): value is MultisigThresholdWeight =>
    isRecord(value) &&
    typeof value.memberAid === 'string' &&
    typeof value.weight === 'string' &&
    cleanAid(value.memberAid).length > 0 &&
    cleanWeight(value.weight).length > 0;

const isThresholdClause = (value: unknown): value is MultisigThresholdClause =>
    isRecord(value) &&
    typeof value.id === 'string' &&
    value.id.trim().length > 0 &&
    Array.isArray(value.weights) &&
    value.weights.every(isThresholdWeight);

export const isMultisigThresholdSpec = (
    value: unknown
): value is MultisigThresholdSpec => {
    if (!isRecord(value)) {
        return false;
    }

    if (value.mode === 'autoEqual') {
        return isStringArray(value.memberAids);
    }

    if (value.mode === 'customFlat') {
        return Array.isArray(value.weights) && value.weights.every(isThresholdWeight);
    }

    if (value.mode === 'nestedWeighted') {
        return (
            Array.isArray(value.clauses) &&
            value.clauses.every(isThresholdClause)
        );
    }

    return (
        value.mode === 'numeric' &&
        (typeof value.value === 'string' || typeof value.value === 'number') &&
        String(value.value).trim().length > 0
    );
};

const weightValue = (weight: string): number => {
    const normalized = cleanWeight(weight);
    const [numerator, denominator, ...extra] = normalized.split('/');
    if (extra.length > 0 || numerator === undefined || numerator.trim() === '') {
        return Number.NaN;
    }

    if (denominator === undefined) {
        return Number(numerator);
    }

    const top = Number(numerator);
    const bottom = Number(denominator);
    if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom === 0) {
        return Number.NaN;
    }

    return top / bottom;
};

const clauseWeightSum = (weights: readonly MultisigThresholdWeight[]): number =>
    weights.reduce((sum, item) => sum + weightValue(item.weight), 0);

const uniqueAids = (aids: readonly string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const aid of aids) {
        const normalized = cleanAid(aid);
        if (normalized.length === 0 || seen.has(normalized)) {
            continue;
        }

        seen.add(normalized);
        result.push(normalized);
    }

    return result;
};

/**
 * Return exact proportional weights for a member count.
 *
 * Signify treats weighted thresholds as satisfied when the selected weights
 * sum to one. Equal 1/N weights therefore require every listed member.
 */
export const equalMemberWeight = (memberCount: number): string => {
    if (memberCount <= 0) {
        return '0';
    }

    if (memberCount === 1) {
        return '1';
    }

    return `1/${memberCount}`;
};

/**
 * Build the default all-members-required weighted threshold for ordered AIDs.
 */
export const equalMemberWeights = (
    memberAids: readonly string[]
): MultisigThresholdWeight[] => {
    const aids = uniqueAids(memberAids);
    const weight = equalMemberWeight(aids.length);

    return aids.map((memberAid) => ({
        memberAid,
        weight,
    }));
};

/**
 * Normalize a threshold spec after member add/remove/reorder changes.
 */
export const thresholdSpecForMembers = (
    memberAids: readonly string[]
): MultisigThresholdSpec => ({
    mode: 'autoEqual',
    memberAids: uniqueAids(memberAids),
});

export const thresholdSpecFromClauses = (
    clauses: readonly MultisigThresholdClause[]
): MultisigThresholdSpec => {
    const normalized = clauses
        .map((clause, index) => ({
            id: clause.id.trim() || `clause-${index + 1}`,
            weights: clause.weights
                .map((item) => ({
                    memberAid: cleanAid(item.memberAid),
                    weight: cleanWeight(item.weight),
                }))
                .filter(
                    (item) =>
                        item.memberAid.length > 0 && item.weight.length > 0
                ),
        }))
        .filter((clause) => clause.weights.length > 0);

    return normalized.length === 1
        ? { mode: 'customFlat', weights: normalized[0]?.weights ?? [] }
        : { mode: 'nestedWeighted', clauses: normalized };
};

/**
 * Serialize the app threshold spec to the exact `isith/nsith` value Signify
 * expects. The order must match the `states/rstates` order sent with it.
 */
export const thresholdSpecToSith = (
    spec: MultisigThresholdSpec
): MultisigThresholdSith => {
    if (spec.mode === 'numeric') {
        return spec.value;
    }

    if (spec.mode === 'autoEqual') {
        return equalMemberWeights(spec.memberAids).map((item) => item.weight);
    }

    if (spec.mode === 'customFlat') {
        return spec.weights.map((item) => cleanWeight(item.weight));
    }

    return spec.clauses.map((clause) =>
        clause.weights.map((item) => cleanWeight(item.weight))
    );
};

export const thresholdLeafCount = (sith: MultisigThresholdSith): number => {
    if (Array.isArray(sith)) {
        return isNestedStringArray(sith)
            ? sith.reduce((count, clause) => count + clause.length, 0)
            : sith.length;
    }

    return 0;
};

export const thresholdSpecLeafCount = (spec: MultisigThresholdSpec): number =>
    thresholdLeafCount(thresholdSpecToSith(spec));

/**
 * Return ordered member AIDs referenced by a threshold spec.
 */
export const thresholdSpecMemberAids = (
    spec: MultisigThresholdSpec
): string[] => {
    if (spec.mode === 'numeric') {
        return [];
    }

    if (spec.mode === 'autoEqual') {
        return uniqueAids(spec.memberAids);
    }

    if (spec.mode === 'customFlat') {
        return uniqueAids(spec.weights.map((item) => item.memberAid));
    }

    return uniqueAids(
        spec.clauses.flatMap((clause) =>
            clause.weights.map((item) => item.memberAid)
        )
    );
};

export const thresholdSpecFromSith = (
    sith: MultisigThresholdSith,
    memberAids: readonly string[]
): MultisigThresholdSpec => {
    const aids = uniqueAids(memberAids);
    if (!Array.isArray(sith)) {
        return {
            mode: 'numeric',
            value: sith,
        };
    }

    if (isNestedStringArray(sith)) {
        let offset = 0;
        return {
            mode: 'nestedWeighted',
            clauses: sith.map((clause, clauseIndex) => {
                const weights = clause.map((weight, weightIndex) => ({
                    memberAid: aids[offset + weightIndex] ?? '',
                    weight,
                }));
                offset += clause.length;
                return {
                    id: `clause-${clauseIndex + 1}`,
                    weights,
                };
            }),
        };
    }

    return {
        mode: 'customFlat',
        weights: sith.map((weight, index) => ({
            memberAid: aids[index] ?? '',
            weight,
        })),
    };
};

export const parseThresholdSith = (
    raw: string
): MultisigThresholdSith | null => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(trimmed);
        if (
            typeof parsed === 'number' ||
            typeof parsed === 'string' ||
            isStringArray(parsed) ||
            isNestedStringArray(parsed)
        ) {
            return parsed;
        }
        return null;
    } catch {
        return trimmed;
    }
};

export const parseThresholdSpec = (
    raw: string,
    memberAids: readonly string[]
): MultisigThresholdParseResult | null => {
    const sith = parseThresholdSith(raw);
    if (sith === null) {
        return null;
    }

    const spec = thresholdSpecFromSith(sith, memberAids);
    return {
        spec,
        sith,
        memberAids: thresholdSpecMemberAids(spec),
    };
};

/**
 * Ensure a threshold can be parsed by Signify before protocol submission.
 */
export const validateThresholdSpec = (
    spec: MultisigThresholdSpec
): string | null => {
    if (!isMultisigThresholdSpec(spec)) {
        return 'Invalid threshold specification.';
    }

    let sith: MultisigThresholdSith;
    try {
        sith = thresholdSpecToSith(spec);
    } catch {
        return 'Invalid threshold specification.';
    }

    if (Array.isArray(sith) && sith.length === 0) {
        return 'At least one threshold member is required.';
    }

    if (spec.mode === 'customFlat' && spec.weights.length === 0) {
        return 'At least one threshold member is required.';
    }

    if (spec.mode === 'nestedWeighted' && spec.clauses.length === 0) {
        return 'At least one threshold clause is required.';
    }

    if (spec.mode === 'nestedWeighted') {
        const emptyClause = spec.clauses.find(
            (clause) => clause.weights.length === 0
        );
        if (emptyClause !== undefined) {
            return 'Each threshold clause requires at least one member.';
        }
    }

    const clauses =
        spec.mode === 'customFlat'
            ? [{ id: 'flat', weights: spec.weights }]
            : spec.mode === 'nestedWeighted'
              ? spec.clauses
              : [];
    for (const clause of clauses) {
        const sum = clauseWeightSum(clause.weights);
        if (!Number.isFinite(sum)) {
            return 'Threshold weights must be valid numbers or fractions.';
        }
        if (sum < 1) {
            return 'Each threshold clause must sum to at least 1.';
        }
    }

    try {
        new Tholder({ sith });
        return null;
    } catch (error) {
        return error instanceof Error
            ? error.message
            : 'Invalid threshold specification.';
    }
};

export const validateThresholdSpecForMembers = ({
    spec,
    memberAids,
}: {
    spec: MultisigThresholdSpec;
    memberAids: readonly string[];
}): string | null => {
    const baseError = validateThresholdSpec(spec);
    if (baseError !== null) {
        return baseError;
    }

    const uniqueMembers = uniqueAids(memberAids);
    if (uniqueMembers.length === 0) {
        return 'At least one threshold member is required.';
    }

    if (spec.mode === 'numeric') {
        return null;
    }

    const referenced = thresholdSpecMemberAids(spec);
    if (referenced.length !== uniqueMembers.length) {
        return 'Threshold member order must match the selected member list.';
    }

    if (referenced.some((aid, index) => aid !== uniqueMembers[index])) {
        return 'Threshold member order must match the selected member list.';
    }

    const leafCount = thresholdSpecLeafCount(spec);
    if (leafCount !== uniqueMembers.length) {
        return 'Threshold leaf count must match the selected member list.';
    }

    return null;
};

/**
 * Human-readable compact threshold summary for tables and notifications.
 */
export const thresholdSummary = (spec: MultisigThresholdSpec): string => {
    const sith = thresholdSpecToSith(spec);

    if (Array.isArray(sith)) {
        return JSON.stringify(sith);
    }

    return String(sith);
};

export const sithSummary = (sith: MultisigThresholdSith | null): string =>
    sith === null
        ? 'Unavailable'
        : Array.isArray(sith)
          ? JSON.stringify(sith)
          : String(sith);
