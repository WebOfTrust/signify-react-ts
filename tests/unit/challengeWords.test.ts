import { describe, expect, it } from 'vitest';
import {
    challengeWordsFingerprint,
    parseChallengeWords,
    validateChallengeWords,
} from '../../src/features/contacts/challengeWords';

describe('challenge word helpers', () => {
    it('normalizes pasted challenge words', () => {
        expect(parseChallengeWords('  Able\nBaker\tCharlie  ')).toEqual([
            'able',
            'baker',
            'charlie',
        ]);
    });

    it('validates supported challenge word counts', () => {
        expect(
            validateChallengeWords(
                Array.from({ length: 12 }, (_, i) => `w${i}`)
            )
        ).toBeNull();
        expect(
            validateChallengeWords(
                Array.from({ length: 24 }, (_, i) => `w${i}`)
            )
        ).toBeNull();
        expect(validateChallengeWords([])).toBe(
            'Challenge words are required.'
        );
        expect(validateChallengeWords(['one', 'two'])).toBe(
            'Challenge must contain 12 or 24 words.'
        );
    });

    it('fingerprints normalized words without returning the phrase', () => {
        const words = ['one', 'two', 'three'];
        const fingerprint = challengeWordsFingerprint(words);

        expect(fingerprint).toMatch(/^[0-9a-f]{8}$/u);
        expect(fingerprint).toBe(challengeWordsFingerprint([...words]));
        expect(fingerprint).not.toContain(words.join(' '));
    });
});
