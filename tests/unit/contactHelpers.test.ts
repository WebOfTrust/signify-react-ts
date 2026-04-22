import type { Contact } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import {
    abbreviateMiddle,
    aidFromOobi,
    aliasForOobiResolution,
    aliasFromOobi,
    challengeRecordsFromKeriaContacts,
    contactChallengeStatus,
    contactOobiGroups,
    contactOobiRoleSummary,
    componentTagsFromOobi,
    contactRecordFromKeriaContact,
    endpointRolesFromOobi,
    explicitOobiMetadataRoles,
    identifierAvailableOobiRoles,
    isWitnessContact,
    knownComponentsFromContacts,
    normalizeOobiUrlForResolution,
    pendingContactIdForOobi,
} from '../../src/features/contacts/contactHelpers';
import type { ContactRecord } from '../../src/state/contacts.slice';
import type { IdentifierSummary } from '../../src/features/identifiers/identifierTypes';

describe('contact helpers', () => {
    it('extracts aliases and strips local name hints before resolution', () => {
        const oobi =
            'http://127.0.0.1:3902/oobi/Ealice/agent?name=Alice&tag=watcher';

        expect(aliasFromOobi(oobi)).toBe('Alice');
        expect(aliasForOobiResolution(oobi, '')).toBe('Alice');
        expect(aliasForOobiResolution(oobi, 'Override')).toBe('Override');
        expect(normalizeOobiUrlForResolution(oobi)).toBe(
            'http://127.0.0.1:3902/oobi/Ealice/agent?tag=watcher'
        );
        expect(pendingContactIdForOobi(oobi, null)).toBe('pending:Alice');
        expect(aidFromOobi(oobi)).toBe('Ealice');
    });

    it('extracts component tags from OOBI paths and query tags', () => {
        expect(
            componentTagsFromOobi(
                'http://127.0.0.1:5642/oobi/Ewan/controller?tag=witness'
            )
        ).toEqual(['witness', 'controller']);
    });

    it('extracts endpoint roles from OOBI source in display order', () => {
        expect(
            endpointRolesFromOobi(
                'http://127.0.0.1:5642/oobi/Ewan/controller?role=witness'
            )
        ).toEqual(['witness', 'controller']);
        expect(
            endpointRolesFromOobi(
                'http://127.0.0.1:3902/oobi/Ealice/agent/Eagent'
            )
        ).toEqual(['agent']);
        expect(
            explicitOobiMetadataRoles(
                'http://127.0.0.1:3902/oobi/Ealice/agent/Eagent'
            )
        ).toEqual([]);
        expect(
            explicitOobiMetadataRoles(
                'http://127.0.0.1:5642/oobi/Ewan/controller?tag=witness'
            )
        ).toEqual(['witness']);
    });

    it('normalizes contact endpoints, well-knowns, and challenge counts', () => {
        const contact = {
            id: 'Econtact',
            alias: 'Alice',
            oobi: 'http://127.0.0.1:3902/oobi/Econtact/agent',
            ends: {
                agent: { Eagent: 'http://127.0.0.1:3902' },
                controller: {
                    Econtact: {
                        http: 'http://127.0.0.1:5642/',
                        tcp: 'tcp://127.0.0.1:5632/',
                    },
                },
                witness: null,
            },
            wellKnowns: [
                {
                    url: 'https://example.test/.well-known/keri/oobi',
                    dt: '2026-04-21T00:00:00.000Z',
                },
            ],
            challenges: [
                {
                    words: ['one', 'two'],
                    said: 'Ssaid',
                    authenticated: true,
                },
            ],
        } as unknown as Contact;

        const record = contactRecordFromKeriaContact(
            contact,
            '2026-04-21T00:00:01.000Z'
        );

        expect(record).toMatchObject({
            id: 'Econtact',
            alias: 'Alice',
            challengeCount: 1,
            authenticatedChallengeCount: 1,
            resolutionStatus: 'resolved',
        });
        expect(record.endpoints).toEqual([
            {
                role: 'agent',
                eid: 'Eagent',
                scheme: 'http',
                url: 'http://127.0.0.1:3902',
            },
            {
                role: 'controller',
                eid: 'Econtact',
                scheme: 'http',
                url: 'http://127.0.0.1:5642/',
            },
            {
                role: 'controller',
                eid: 'Econtact',
                scheme: 'tcp',
                url: 'tcp://127.0.0.1:5632/',
            },
        ]);
        expect(record.wellKnowns).toEqual([
            {
                url: 'https://example.test/.well-known/keri/oobi',
                dt: '2026-04-21T00:00:00.000Z',
            },
        ]);
        expect(knownComponentsFromContacts([record])).toHaveLength(4);
    });

    it('summarizes contact roles, witness grouping, challenge shields, and abbreviations', () => {
        const witness = {
            id: 'Ewitness',
            alias: 'Wan',
            aid: 'Ewitness',
            oobi: 'http://127.0.0.1:5642/oobi/Ewitness/controller?tag=witness',
            endpoints: [
                {
                    role: 'agent',
                    eid: 'Eagent',
                    scheme: 'http',
                    url: 'http://127.0.0.1:3902',
                },
            ],
            wellKnowns: [],
            componentTags: ['witness', 'controller'],
            challengeCount: 2,
            authenticatedChallengeCount: 0,
            resolutionStatus: 'resolved',
            error: null,
            updatedAt: '2026-04-21T00:00:00.000Z',
        } satisfies ContactRecord;
        const verified = {
            ...witness,
            id: 'Everified',
            alias: 'Alice',
            oobi: 'http://127.0.0.1:3902/oobi/Everified/agent',
            componentTags: ['agent'],
            challengeCount: 1,
            authenticatedChallengeCount: 1,
        } satisfies ContactRecord;

        expect(contactOobiRoleSummary(witness)).toMatchObject({
            primaryRole: 'witness',
            label: 'Witness OOBI +2',
        });
        expect(isWitnessContact(witness)).toBe(true);
        expect(contactChallengeStatus(witness).status).toBe('pending');
        expect(contactChallengeStatus(verified).status).toBe('verified');
        expect(abbreviateMiddle('abcdefghijklmnopqrstuvwxyz', 16)).toBe(
            'abcdefgh...stuvwxyz'
        );
    });

    it('does not group regular witnessed identifiers into the witness accordion', () => {
        const witnessedContact = {
            id: 'Elayla',
            alias: 'Layla',
            aid: 'Elayla',
            oobi: 'http://127.0.0.1:3902/oobi/Elayla/agent/Eagent',
            endpoints: [
                {
                    role: 'agent',
                    eid: 'Eagent',
                    scheme: 'http',
                    url: 'http://127.0.0.1:3902/',
                },
                {
                    role: 'witness',
                    eid: 'Ewitness',
                    scheme: 'http',
                    url: 'http://127.0.0.1:5642/',
                },
            ],
            wellKnowns: [],
            componentTags: ['agent'],
            challengeCount: 0,
            authenticatedChallengeCount: 0,
            resolutionStatus: 'resolved',
            error: null,
            updatedAt: '2026-04-21T00:00:00.000Z',
        } satisfies ContactRecord;

        expect(contactOobiRoleSummary(witnessedContact).roles).toEqual([
            'agent',
            'witness',
        ]);
        expect(isWitnessContact(witnessedContact)).toBe(false);
        expect(contactOobiGroups(witnessedContact)).toEqual([
            {
                role: 'agent',
                label: 'Agent OOBI',
                oobis: ['http://127.0.0.1:3902/oobi/Elayla/agent/Eagent'],
            },
            {
                role: 'witness',
                label: 'Witness OOBI',
                oobis: [
                    'http://127.0.0.1:5642/oobi/Ewitness/controller?tag=witness',
                ],
            },
        ]);
    });

    it('limits generated OOBI roles from identifier witness state', () => {
        const plain = {
            name: 'plain',
            prefix: 'Eplain',
            state: { b: [] },
            windexes: [],
        } as unknown as IdentifierSummary;
        const witnessed = {
            name: 'witnessed',
            prefix: 'Ewitnessed',
            state: { b: ['Bwitness'] },
            windexes: [],
        } as unknown as IdentifierSummary;

        expect(identifierAvailableOobiRoles(plain)).toEqual(['agent']);
        expect(identifierAvailableOobiRoles(witnessed)).toEqual([
            'agent',
            'witness',
        ]);
        expect(identifierAvailableOobiRoles(null)).toEqual([]);
    });

    it('extracts read-only challenge inventory from contacts', () => {
        const contacts = [
            {
                id: 'Econtact',
                alias: 'Alice',
                challenges: [
                    {
                        words: ['one', 'two'],
                        said: 'Ssaid',
                        authenticated: true,
                        dt: '2026-04-21T00:00:00.000Z',
                    },
                ],
            } as unknown as Contact,
        ];

        expect(
            challengeRecordsFromKeriaContacts(
                contacts,
                '2026-04-21T00:00:01.000Z'
            )
        ).toEqual([
            {
                id: 'Econtact:Ssaid',
                source: 'keria',
                direction: 'received',
                role: 'Alice',
                counterpartyAid: 'Econtact',
                words: ['one', 'two'],
                wordsHash: '42c28241',
                responseSaid: 'Ssaid',
                authenticated: true,
                status: 'verified',
                result: 'Ssaid',
                error: null,
                verifiedAt: '2026-04-21T00:00:00.000Z',
                updatedAt: '2026-04-21T00:00:00.000Z',
            },
        ]);
    });
});
