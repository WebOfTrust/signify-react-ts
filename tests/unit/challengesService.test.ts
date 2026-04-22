import { describe, expect, it } from 'vitest';
import { responseSaidFromChallengeOperation } from '../../src/services/challenges.service';

describe('challenge service helpers', () => {
    it('extracts the response SAID from a completed challenge operation', () => {
        expect(
            responseSaidFromChallengeOperation({
                response: {
                    exn: {
                        d: 'EresponseSaid',
                    },
                },
            })
        ).toBe('EresponseSaid');
    });

    it('rejects completed challenge operations without an EXN SAID', () => {
        expect(() =>
            responseSaidFromChallengeOperation({
                response: {
                    exn: {},
                },
            })
        ).toThrow('Challenge response EXN did not include a SAID.');
    });
});
