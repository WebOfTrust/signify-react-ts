import { describe, expect, it } from 'vitest';
import { schemaRuleViews } from '../../src/features/dashboard/schemaRules';

describe('dashboard credential schema rules', () => {
    it('flattens every schema rules leaf into dotted name and value rows', () => {
        expect(
            schemaRuleViews({
                usageDisclaimer: {
                    l: 'Usage disclaimer',
                    d: 'Use of a valid, unexpired, and non-revoked credential does not by itself grant voting rights.',
                },
                privacyPolicy: {
                    section1: {
                        parta: 'Only request necessary fields.',
                        partb: true,
                    },
                    references: ['ACDC', 'IPEX'],
                },
            })
        ).toEqual([
            {
                name: 'usageDisclaimer.l',
                value: 'Usage disclaimer',
            },
            {
                name: 'usageDisclaimer.d',
                value: 'Use of a valid, unexpired, and non-revoked credential does not by itself grant voting rights.',
            },
            {
                name: 'privacyPolicy.section1.parta',
                value: 'Only request necessary fields.',
            },
            {
                name: 'privacyPolicy.section1.partb',
                value: 'true',
            },
            {
                name: 'privacyPolicy.references.0',
                value: 'ACDC',
            },
            {
                name: 'privacyPolicy.references.1',
                value: 'IPEX',
            },
        ]);
    });

    it('preserves empty nested collections as leaf values', () => {
        expect(
            schemaRuleViews({
                emptyObject: {},
                emptyArray: [],
            })
        ).toEqual([
            { name: 'emptyObject', value: '{}' },
            { name: 'emptyArray', value: '[]' },
        ]);
    });
});
