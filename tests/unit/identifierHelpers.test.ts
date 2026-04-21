import { describe, expect, it } from 'vitest';
import { Algos, type HabState, type KeyState } from 'signify-ts';
import { buildAppConfig } from '../../src/config';
import {
    defaultIdentifierCreateDraft,
    identifierCreateDraftToArgs,
    identifiersFromResponse,
    isIdentifierCreateDraft,
} from '../../src/features/identifiers/identifierHelpers';
import type { IdentifierCreateDraft } from '../../src/features/identifiers/identifierTypes';

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

describe('identifier create drafts', () => {
    const config = buildAppConfig({});

    it('maps the default draft to salty create args', () => {
        const draft: IdentifierCreateDraft = {
            ...defaultIdentifierCreateDraft(),
            name: 'alice',
        };

        expect(identifierCreateDraftToArgs(draft, config)).toEqual({
            algo: Algos.salty,
            transferable: true,
            count: 1,
            ncount: 1,
            isith: '1',
            nsith: '1',
        });
    });

    it('maps randy drafts without salty-only branch material', () => {
        const draft: IdentifierCreateDraft = {
            ...defaultIdentifierCreateDraft(),
            name: 'randy',
            algo: Algos.randy,
            bran: 'salty-branch',
        };

        expect(identifierCreateDraftToArgs(draft, config)).toEqual({
            algo: Algos.randy,
            transferable: true,
            count: 1,
            ncount: 1,
            isith: '1',
            nsith: '1',
        });
    });

    it('maps configured demo witnesses', () => {
        const draft: IdentifierCreateDraft = {
            ...defaultIdentifierCreateDraft(),
            name: 'witnessed',
            witnessMode: 'demo',
        };

        expect(identifierCreateDraftToArgs(draft, config)).toMatchObject({
            wits: config.witnesses.aids,
            toad: config.witnesses.toad,
        });
    });

    it('preserves advanced key counts and thresholds', () => {
        const draft: IdentifierCreateDraft = {
            ...defaultIdentifierCreateDraft(),
            name: 'advanced',
            count: 3,
            ncount: 4,
            isith: '2',
            nsith: '3',
        };

        expect(identifierCreateDraftToArgs(draft, config)).toMatchObject({
            count: 3,
            ncount: 4,
            isith: '2',
            nsith: '3',
        });
    });

    it('omits empty branch material and preserves non-empty salty branch material', () => {
        const baseDraft: IdentifierCreateDraft = {
            ...defaultIdentifierCreateDraft(),
            name: 'branch',
        };

        expect(identifierCreateDraftToArgs(baseDraft, config)).not.toHaveProperty(
            'bran'
        );
        expect(
            identifierCreateDraftToArgs(
                { ...baseDraft, bran: ' branch-code ' },
                config
            )
        ).toMatchObject({
            bran: 'branch-code',
        });
    });

    it('rejects malformed drafts', () => {
        const draft: IdentifierCreateDraft = {
            ...defaultIdentifierCreateDraft(),
            name: 'valid',
        };

        expect(isIdentifierCreateDraft(draft)).toBe(true);
        expect(isIdentifierCreateDraft({ ...draft, name: '' })).toBe(false);
        expect(isIdentifierCreateDraft({ ...draft, algo: Algos.group })).toBe(
            false
        );
        expect(isIdentifierCreateDraft({ ...draft, witnessMode: 'custom' })).toBe(
            false
        );
        expect(isIdentifierCreateDraft({ ...draft, count: 0 })).toBe(false);
        expect(isIdentifierCreateDraft({ ...draft, isith: '' })).toBe(false);
    });
});
