import { describe, expect, it } from 'vitest';
import { defaultChallengeResponseIdentifierName } from '../../src/features/notifications/challengeRequestFormHelpers';
import type { IdentifierSummary } from '../../src/features/identifiers/identifierTypes';

const identifier = (name: string, prefix: string): IdentifierSummary =>
    ({ name, prefix }) as IdentifierSummary;

describe('challenge request form helpers', () => {
    it('preselects the local identifier that matches the challenge request recipient AID', () => {
        expect(
            defaultChallengeResponseIdentifierName(
                { recipientAid: 'Etarget' },
                [identifier('first', 'Efirst'), identifier('target', 'Etarget')]
            )
        ).toBe('target');
    });

    it('falls back to the first identifier when the recipient AID is unavailable', () => {
        expect(
            defaultChallengeResponseIdentifierName({ recipientAid: null }, [
                identifier('first', 'Efirst'),
                identifier('target', 'Etarget'),
            ])
        ).toBe('first');
    });

    it('falls back to the first identifier when the recipient AID is not local', () => {
        expect(
            defaultChallengeResponseIdentifierName(
                { recipientAid: 'Eunknown' },
                [identifier('first', 'Efirst'), identifier('target', 'Etarget')]
            )
        ).toBe('first');
    });
});
