import { describe, expect, it } from 'vitest';
import {
    identifiersFromResponse,
    parseIdentifierCreateArgs,
} from '../../src/features/identifiers/identifierHelpers';

describe('identifiersFromResponse', () => {
    it('normalizes direct identifier arrays', () => {
        const identifiers = [{ name: 'alice', prefix: 'Ealice' }];

        expect(identifiersFromResponse(identifiers)).toEqual(identifiers);
    });

    it('normalizes KERIA list responses with aids', () => {
        const identifiers = [{ name: 'bob', prefix: 'Ebob' }];

        expect(identifiersFromResponse({ aids: identifiers })).toEqual(
            identifiers
        );
    });

    it('returns an empty list for unrecognized responses', () => {
        expect(identifiersFromResponse(null)).toEqual([]);
        expect(identifiersFromResponse({})).toEqual([]);
    });
});

describe('parseIdentifierCreateArgs', () => {
    it('parses number, boolean, csv, and string fields', () => {
        expect(
            parseIdentifierCreateArgs('salty', [
                { field: 'count', value: '3' },
                { field: 'transferable', value: 'true' },
                { field: 'wits', value: 'wit-one,wit-two' },
                { field: 'bran', value: 'branch-code' },
            ])
        ).toEqual({
            algo: 'salty',
            count: 3,
            transferable: true,
            wits: ['wit-one', 'wit-two'],
            bran: 'branch-code',
        });
    });

    it('preserves false boolean and string numeric fields from the legacy form', () => {
        expect(
            parseIdentifierCreateArgs('randy', [
                { field: 'transferable', value: 'false' },
                { field: 'toad', value: '2' },
            ])
        ).toEqual({
            algo: 'randy',
            transferable: false,
            toad: '2',
        });
    });
});
