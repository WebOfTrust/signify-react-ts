import { describe, expect, it } from 'vitest';
import {
    equalMemberWeight,
    equalMemberWeights,
    isMultisigThresholdSpec,
    parseThresholdSpec,
    sithSummary,
    thresholdSpecFromSith,
    thresholdSpecForMembers,
    thresholdSpecMemberAids,
    thresholdSpecToSith,
    validateThresholdSpecForMembers,
    validateThresholdSpec,
} from '../../src/features/multisig/multisigThresholds';

describe('multisig threshold helpers', () => {
    it('builds equal all-members-required proportional weights', () => {
        expect(equalMemberWeight(0)).toBe('0');
        expect(equalMemberWeight(1)).toBe('1');
        expect(equalMemberWeight(2)).toBe('1/2');
        expect(equalMemberWeight(3)).toBe('1/3');
        expect(equalMemberWeights(['Ea', 'Eb', 'Ec'])).toEqual([
            { memberAid: 'Ea', weight: '1/3' },
            { memberAid: 'Eb', weight: '1/3' },
            { memberAid: 'Ec', weight: '1/3' },
        ]);
    });

    it('serializes auto-equal threshold specs to Signify sith arrays', () => {
        const spec = thresholdSpecForMembers(['Ea', 'Eb']);

        expect(thresholdSpecMemberAids(spec)).toEqual(['Ea', 'Eb']);
        expect(thresholdSpecToSith(spec)).toEqual(['1/2', '1/2']);
        expect(validateThresholdSpec(spec)).toBeNull();
    });

    it('serializes nested weighted threshold clauses without losing order', () => {
        const spec = {
            mode: 'nestedWeighted',
            clauses: [
                {
                    id: 'ops',
                    weights: [
                        { memberAid: 'Ea', weight: '1/2' },
                        { memberAid: 'Eb', weight: '1/2' },
                    ],
                },
                {
                    id: 'recovery',
                    weights: [{ memberAid: 'Ec', weight: '1' }],
                },
            ],
        } as const;

        expect(thresholdSpecMemberAids(spec)).toEqual(['Ea', 'Eb', 'Ec']);
        expect(thresholdSpecToSith(spec)).toEqual([
            ['1/2', '1/2'],
            ['1'],
        ]);
        expect(validateThresholdSpec(spec)).toBeNull();
    });

    it('rejects empty weighted thresholds', () => {
        expect(
            validateThresholdSpec({
                mode: 'customFlat',
                weights: [],
            })
        ).toBe('At least one threshold member is required.');
    });

    it('rejects malformed mode-only threshold specs', () => {
        expect(isMultisigThresholdSpec({ mode: 'customFlat' })).toBe(false);
        expect(isMultisigThresholdSpec({ mode: 'nestedWeighted' })).toBe(false);
        expect(isMultisigThresholdSpec({ mode: 'numeric' })).toBe(false);
    });

    it('parses manual numeric and JSON weighted thresholds', () => {
        expect(parseThresholdSpec('2', ['Ea', 'Eb'])?.spec).toEqual({
            mode: 'numeric',
            value: 2,
        });
        expect(parseThresholdSpec('"2"', ['Ea', 'Eb'])?.spec).toEqual({
            mode: 'numeric',
            value: '2',
        });
        expect(parseThresholdSpec('["1/2","1/2"]', ['Ea', 'Eb'])?.spec).toEqual({
            mode: 'customFlat',
            weights: [
                { memberAid: 'Ea', weight: '1/2' },
                { memberAid: 'Eb', weight: '1/2' },
            ],
        });
        expect(
            parseThresholdSpec('[["1/2","1/2"],["1"]]', ['Ea', 'Eb', 'Ec'])
                ?.spec
        ).toEqual({
            mode: 'nestedWeighted',
            clauses: [
                {
                    id: 'clause-1',
                    weights: [
                        { memberAid: 'Ea', weight: '1/2' },
                        { memberAid: 'Eb', weight: '1/2' },
                    ],
                },
                {
                    id: 'clause-2',
                    weights: [{ memberAid: 'Ec', weight: '1' }],
                },
            ],
        });
    });

    it('round-trips protocol sith values into member-bound specs', () => {
        const spec = thresholdSpecFromSith(
            [
                ['1/2', '1/2'],
                ['1'],
            ],
            ['Ea', 'Eb', 'Ec']
        );

        expect(thresholdSpecMemberAids(spec)).toEqual(['Ea', 'Eb', 'Ec']);
        expect(thresholdSpecToSith(spec)).toEqual([
            ['1/2', '1/2'],
            ['1'],
        ]);
        expect(sithSummary(thresholdSpecToSith(spec))).toBe(
            '[["1/2","1/2"],["1"]]'
        );
    });

    it('validates weighted member order, leaf count, and clause sums', () => {
        expect(
            validateThresholdSpecForMembers({
                spec: {
                    mode: 'customFlat',
                    weights: [
                        { memberAid: 'Ea', weight: '1/3' },
                        { memberAid: 'Eb', weight: '1/3' },
                    ],
                },
                memberAids: ['Ea', 'Eb'],
            })
        ).toBe('Each threshold clause must sum to at least 1.');

        expect(
            validateThresholdSpecForMembers({
                spec: {
                    mode: 'customFlat',
                    weights: [
                        { memberAid: 'Eb', weight: '1/2' },
                        { memberAid: 'Ea', weight: '1/2' },
                    ],
                },
                memberAids: ['Ea', 'Eb'],
            })
        ).toBe('Threshold member order must match the selected member list.');
    });
});
