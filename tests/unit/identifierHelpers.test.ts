import { describe, expect, it } from 'vitest';
import { Algos, type HabState, type KeyState } from 'signify-ts';
import {
    identifiersFromResponse,
    parseIdentifierCreateArgs,
} from '../../src/features/identifiers/identifierHelpers';

const keyState = (prefix: string): KeyState => ({
    i: prefix,
    s: '0',
    p: '',
    d: `${prefix}-event`,
    f: '0',
    dt: '2026-04-21T00:00:00.000000+00:00',
    et: 'icp',
    kt: '1',
    k: [`${prefix}-key`],
    nt: '1',
    n: [`${prefix}-next`],
    bt: '0',
    b: [],
    c: [],
    ee: {
        s: '0',
        d: `${prefix}-event`,
    },
    di: '',
});

const identifier = (name: string, prefix: string): HabState => ({
    name,
    prefix,
    icp_dt: '2026-04-21T00:00:00.000000+00:00',
    state: keyState(prefix),
    transferable: true,
    windexes: [],
    salty: {
        tier: 'low',
        sxlt: '',
        pidx: 0,
        kidx: 0,
        stem: '',
        dcode: '',
        icodes: [],
        ncodes: [],
        transferable: true,
    },
});

describe('identifiersFromResponse', () => {
    it('normalizes direct identifier arrays', () => {
        const identifiers = [identifier('alice', 'Ealice')];

        expect(identifiersFromResponse(identifiers)).toEqual(identifiers);
    });

    it('normalizes KERIA list responses with aids', () => {
        const identifiers = [identifier('bob', 'Ebob')];

        expect(identifiersFromResponse({ aids: identifiers })).toEqual(
            identifiers
        );
    });

    it('filters malformed entries from recognized response containers', () => {
        const valid = identifier('carol', 'Ecarol');

        expect(identifiersFromResponse([valid, { name: 'missing-prefix' }])).toEqual([
            valid,
        ]);
        expect(
            identifiersFromResponse({ aids: [{ prefix: 'missing-name' }, valid] })
        ).toEqual([valid]);
    });

    it('returns an empty list for unrecognized responses', () => {
        expect(identifiersFromResponse(null)).toEqual([]);
        expect(identifiersFromResponse({})).toEqual([]);
    });
});

describe('parseIdentifierCreateArgs', () => {
    it('parses number, boolean, csv, and string fields', () => {
        expect(
            parseIdentifierCreateArgs(Algos.salty, [
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

    it('parses upstream numeric create fields and preserves string fields', () => {
        expect(
            parseIdentifierCreateArgs(Algos.randy, [
                { field: 'transferable', value: 'false' },
                { field: 'toad', value: '2' },
                { field: 'bran', value: 'branch-code' },
            ])
        ).toEqual({
            algo: Algos.randy,
            transferable: false,
            toad: 2,
            bran: 'branch-code',
        });
    });
});
