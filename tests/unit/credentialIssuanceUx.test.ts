import { describe, expect, it } from 'vitest';
import { appConfig } from '../../src/config';
import {
    hasSediVoterIssueDraftErrors,
    validateSediVoterIssueDraft,
} from '../../src/features/credentials/credentialIssueForm';
import {
    readyCredentialRegistriesForIssuer,
    resolvedCredentialHolderContacts,
} from '../../src/features/credentials/credentialSelection';
import {
    grantsForAid,
    issuerStatsForAid,
    registryTilesForIssuer,
    walletStatsForAid,
} from '../../src/features/credentials/credentialViewModels';
import { credentialRecorded } from '../../src/state/credentials.slice';
import { registryInventoryLoaded } from '../../src/state/registry.slice';
import { schemaRecorded } from '../../src/state/schema.slice';
import {
    selectCredentialRegistries,
    selectIssueableCredentialTypeViews,
} from '../../src/state/selectors';
import { createAppStore } from '../../src/state/store';
import type { ContactRecord } from '../../src/state/contacts.slice';
import type { CredentialSummaryRecord } from '../../src/state/credentials.slice';
import type { CredentialGrantNotification } from '../../src/state/notifications.slice';
import type { RegistryRecord } from '../../src/state/registry.slice';

const now = '2026-04-22T00:00:00.000Z';

const registry = (
    id: string,
    issuerAid: string,
    status: RegistryRecord['status'] = 'ready'
): RegistryRecord => ({
    id,
    name: `issuer-${issuerAid}`,
    registryName: `registry-${id}`,
    regk: status === 'ready' ? id : '',
    issuerAlias: `issuer-${issuerAid}`,
    issuerAid,
    status,
    error: null,
    updatedAt: now,
});

const credential = (
    said: string,
    overrides: Partial<CredentialSummaryRecord> = {}
): CredentialSummaryRecord => ({
    said,
    schemaSaid: appConfig.schemas.sediVoterId.said ?? 'Eschema',
    registryId: 'Eregistry1',
    issuerAid: 'Eissuer',
    holderAid: 'Eholder',
    direction: 'issued',
    status: 'issued',
    grantSaid: null,
    admitSaid: null,
    notificationId: null,
    issuedAt: now,
    grantedAt: null,
    admittedAt: null,
    revokedAt: null,
    attributes: null,
    error: null,
    updatedAt: now,
    ...overrides,
});

const grant = (
    notificationId: string,
    holderAid: string
): CredentialGrantNotification => ({
    notificationId,
    grantSaid: `Egrant-${notificationId}`,
    issuerAid: 'Eissuer',
    holderAid,
    credentialSaid: `Ecredential-${notificationId}`,
    schemaSaid: appConfig.schemas.sediVoterId.said,
    status: 'actionable',
    attributes: {},
    createdAt: now,
});

describe('credential issuance UX selectors', () => {
    it('returns field-level SEDI issue draft validation errors', () => {
        const errors = validateSediVoterIssueDraft({
            fullName: '',
            voterId: 'SEDI-0001',
            precinctId: 'PCT-042',
            county: 'Demo County',
            jurisdiction: 'SEDI',
            electionId: 'SEDI-2026-DEMO',
            eligible: false,
            expires: 'not-a-date',
        });

        expect(errors).toMatchObject({
            fullName: 'Full name is required.',
            expires: 'Expires must be an ISO date time.',
        });
        expect(hasSediVoterIssueDraftErrors(errors)).toBe(true);
        expect(
            hasSediVoterIssueDraftErrors(
                validateSediVoterIssueDraft({
                    fullName: 'Ada Voter',
                    voterId: 'SEDI-0001',
                    precinctId: 'PCT-042',
                    county: 'Demo County',
                    jurisdiction: 'SEDI',
                    electionId: 'SEDI-2026-DEMO',
                    eligible: false,
                    expires: '2026-12-31T23:59:59Z',
                })
            )
        ).toBe(false);
    });

    it('returns the curated SEDI type with schema status and issued counts', () => {
        const schemaSaid = appConfig.schemas.sediVoterId.said;
        if (schemaSaid === null) {
            throw new Error('SEDI schema SAID is required for this test.');
        }

        const store = createAppStore();
        expect(selectIssueableCredentialTypeViews(store.getState())[0]).toMatchObject(
            {
                key: 'sediVoterId',
                label: 'SEDI Voter ID',
                schemaStatus: 'unknown',
                issuedCount: 0,
            }
        );

        store.dispatch(
            schemaRecorded({
                said: schemaSaid,
                oobi: appConfig.schemas.sediVoterId.oobiUrl,
                status: 'resolved',
                title: 'SEDI Voter ID Credential',
                description: 'Schema',
                version: '1.0.0',
                error: null,
                updatedAt: now,
            })
        );
        store.dispatch(
            credentialRecorded({
                said: 'Ecredential',
                schemaSaid,
                registryId: 'Eregistry',
                issuerAid: 'Eissuer',
                holderAid: 'Eholder',
                direction: 'issued',
                status: 'issued',
                grantSaid: null,
                admitSaid: null,
                notificationId: null,
                issuedAt: now,
                grantedAt: null,
                admittedAt: null,
                revokedAt: null,
                attributes: null,
                error: null,
                updatedAt: now,
            })
        );

        expect(selectIssueableCredentialTypeViews(store.getState())[0]).toMatchObject(
            {
                schemaStatus: 'resolved',
                schemaTitle: 'SEDI Voter ID Credential',
                issuedCount: 1,
                lastIssuedAt: now,
            }
        );
    });

    it('stores multiple registry inventory records keyed by registry id', () => {
        const store = createAppStore();
        store.dispatch(
            registryInventoryLoaded({
                registries: [
                    registry('Eregistry1', 'Eissuer'),
                    registry('Eregistry2', 'Eissuer'),
                ],
                loadedAt: now,
            })
        );

        expect(selectCredentialRegistries(store.getState())).toHaveLength(2);
        expect(store.getState().registry.byId.Eregistry1?.regk).toBe(
            'Eregistry1'
        );
        expect(store.getState().registry.byId.Eregistry2?.regk).toBe(
            'Eregistry2'
        );
    });

    it('filters holder contacts to resolved non-witness contacts with AIDs only', () => {
        const contacts: ContactRecord[] = [
            {
                id: 'contact-unresolved',
                alias: 'Pending',
                aid: null,
                oobi: null,
                endpoints: [],
                wellKnowns: [],
                componentTags: [],
                challengeCount: 0,
                authenticatedChallengeCount: 0,
                resolutionStatus: 'resolving',
                error: null,
                updatedAt: now,
            },
            {
                id: 'Ewitness',
                alias: 'Wan witness',
                aid: 'Ewitness',
                oobi: 'http://127.0.0.1:5642/oobi/Ewitness/controller?tag=witness',
                endpoints: [],
                wellKnowns: [],
                componentTags: [],
                challengeCount: 0,
                authenticatedChallengeCount: 0,
                resolutionStatus: 'resolved',
                error: null,
                updatedAt: now,
            },
            {
                id: 'Eholder',
                alias: 'Holder',
                aid: 'Eholder',
                oobi: null,
                endpoints: [],
                wellKnowns: [],
                componentTags: [],
                challengeCount: 0,
                authenticatedChallengeCount: 0,
                resolutionStatus: 'resolved',
                error: null,
                updatedAt: now,
            },
        ];

        expect(resolvedCredentialHolderContacts(contacts).map((contact) => contact.id))
            .toEqual(['Eholder']);
    });

    it('filters registry choices by selected issuer and ready status', () => {
        expect(
            readyCredentialRegistriesForIssuer(
                [
                    registry('Eregistry1', 'Eissuer'),
                    registry('Eregistry2', 'Eother'),
                    registry('pending', 'Eissuer', 'creating'),
                ],
                'Eissuer'
            ).map((record) => record.id)
        ).toEqual(['Eregistry1']);
    });

    it('returns selected-AID issuer and wallet stats', () => {
        const store = createAppStore();
        store.dispatch(
            schemaRecorded({
                said: appConfig.schemas.sediVoterId.said ?? 'Eschema',
                oobi: appConfig.schemas.sediVoterId.oobiUrl,
                status: 'resolved',
                title: 'SEDI Voter ID Credential',
                description: 'Schema',
                version: '1.0.0',
                error: null,
                updatedAt: now,
            })
        );
        const types = selectIssueableCredentialTypeViews(store.getState());
        const issued = [
            credential('Ecredential1', {
                issuerAid: 'Eissuer',
                grantSaid: 'Egrant',
            }),
            credential('Ecredential2', {
                issuerAid: 'Eother',
            }),
        ];
        const held = [
            credential('Eheld1', {
                direction: 'held',
                holderAid: 'Eholder',
                status: 'admitted',
            }),
            credential('Eheld2', {
                direction: 'held',
                holderAid: 'Eother',
                status: 'admitted',
            }),
        ];

        expect(
            issuerStatsForAid({
                aid: 'Eissuer',
                credentialTypes: types,
                issuedCredentials: issued,
            })
        ).toEqual({
            issueableTypes: 1,
            issued: 1,
            granted: 1,
        });
        expect(
            walletStatsForAid({
                aid: 'Eholder',
                heldCredentials: held,
                grants: [grant('1', 'Eholder'), grant('2', 'Eother')],
            })
        ).toEqual({
            admitted: 1,
            heldTypes: 1,
            presentationGrants: 0,
            pendingGrants: 1,
        });
        expect(grantsForAid([grant('1', 'Eholder')], 'Eother')).toEqual([]);
    });

    it('builds registry tiles with per-schema credential counts', () => {
        const types = selectIssueableCredentialTypeViews(createAppStore().getState());
        const tiles = registryTilesForIssuer({
            aid: 'Eissuer',
            registries: [
                registry('Eregistry1', 'Eissuer'),
                registry('Eregistry2', 'Eissuer'),
                registry('Eregistry3', 'Eother'),
            ],
            issuedCredentials: [
                credential('Ecredential1', {
                    registryId: 'Eregistry1',
                    issuerAid: 'Eissuer',
                }),
                credential('Ecredential2', {
                    registryId: 'Eregistry1',
                    issuerAid: 'Eissuer',
                }),
                credential('Ecredential3', {
                    registryId: 'Eregistry2',
                    issuerAid: 'Eissuer',
                }),
            ],
            credentialTypes: types,
            selectedSchemaSaid: appConfig.schemas.sediVoterId.said ?? 'Eschema',
        });

        expect(tiles).toHaveLength(2);
        expect(tiles[0]).toMatchObject({
            selectedTypeCount: 2,
            totalIssued: 2,
            schemaCounts: [expect.objectContaining({ count: 2 })],
        });
        expect(tiles[1]).toMatchObject({
            selectedTypeCount: 1,
            totalIssued: 1,
            schemaCounts: [expect.objectContaining({ count: 1 })],
        });
    });
});
