import { describe, expect, it } from 'vitest';
import { buildTestConfig } from '../support/config';

describe('buildTestConfig', () => {
    it('defaults optional test fixtures to absent', () => {
        const config = buildTestConfig({});

        expect(config.fixtures.delegation).toEqual({
            delegatorPre: null,
            delegatorOobi: null,
        });
        expect(config.fixtures.multisig.memberOobis).toEqual([]);
    });

    it('parses optional fixture configuration only in test context', () => {
        const config = buildTestConfig({
            VITE_DELEGATOR_PRE: 'delegator-aid',
            VITE_DELEGATOR_OOBI: 'http://delegator.example.test/oobi',
            VITE_MULTISIG_MEMBER_OOBIS:
                'http://one.example/oobi, http://two.example/oobi',
        });

        expect(config.fixtures.delegation).toEqual({
            delegatorPre: 'delegator-aid',
            delegatorOobi: 'http://delegator.example.test/oobi',
        });
        expect(config.fixtures.multisig.memberOobis).toEqual([
            'http://one.example/oobi',
            'http://two.example/oobi',
        ]);
    });
});
