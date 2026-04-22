import { describe, expect, it, vi } from 'vitest';
import type {
    CredentialResult,
    Operation as KeriaOperation,
    SignifyClient,
} from 'signify-ts';
import { createAppRuntime } from '../../src/app/runtime';
import {
    admitCredentialGrantService,
    credentialGrantFromExchange,
    IPEX_GRANT_NOTIFICATION_ROUTE,
    listCredentialIpexActivityService,
    listCredentialInventoryService,
    listCredentialRegistriesService,
    listKnownCredentialSchemasService,
    normalizeSediVoterAttributes,
} from '../../src/services/credentials.service';
import { ISSUEABLE_CREDENTIAL_TYPES } from '../../src/state/issueableCredentialTypes';
import type { NotificationRecord } from '../../src/state/notifications.slice';

const loadedAt = '2026-04-22T00:00:00.000Z';

const grantNotification = {
    id: 'note-1',
    dt: loadedAt,
    read: false,
    route: IPEX_GRANT_NOTIFICATION_ROUTE,
    anchorSaid: 'Egrant',
    status: 'unread',
    message: null,
    updatedAt: loadedAt,
} satisfies NotificationRecord;

const grantExchange = {
    exn: {
        d: 'Egrant',
        i: 'Eissuer',
        rp: 'Eholder',
        dt: loadedAt,
        r: '/ipex/grant',
        e: {
            acdc: {
                d: 'Ecredential',
                s: 'Eschema',
                i: 'Eissuer',
                ri: 'Eregistry',
                a: {
                    i: 'Eholder',
                    fullName: 'Ada Voter',
                    voterId: 'SEDI-0001',
                    precinctId: 'PCT-042',
                    county: 'Demo County',
                    jurisdiction: 'SEDI',
                    electionId: 'SEDI-2026-DEMO',
                    eligible: true,
                    expires: '2026-12-31T23:59:59Z',
                },
            },
        },
    },
};

const admittedCredential = {
    sad: {
        d: 'Ecredential',
        s: 'Eschema',
        i: 'Eissuer',
        ri: 'Eregistry',
        a: {
            i: 'Eholder',
            dt: loadedAt,
            fullName: 'Ada Voter',
            voterId: 'SEDI-0001',
            precinctId: 'PCT-042',
            county: 'Demo County',
            jurisdiction: 'SEDI',
            electionId: 'SEDI-2026-DEMO',
            eligible: true,
            expires: '2026-12-31T23:59:59Z',
        },
    },
    status: { s: '0' },
} as unknown as CredentialResult;

const makeAdmitClient = () => {
    const notifications = {
        mark: vi.fn(async () => ''),
        delete: vi.fn(async () => undefined),
    };
    const exchanges = {
        get: vi.fn(async () => grantExchange),
    };
    const ipex = {
        admit: vi.fn(async () => [
            { sad: { d: 'Eadmit', dt: loadedAt } },
            ['signature'],
            'attachment',
        ]),
        submitAdmit: vi.fn(async () => ({ name: 'admit-op' })),
    };
    const credentials = {
        get: vi
            .fn()
            .mockRejectedValueOnce(new Error('not stored yet'))
            .mockResolvedValue(admittedCredential),
    };
    const operations = {
        wait: vi.fn(async () => ({ name: 'admit-op', response: {} })),
    };
    const client = {
        exchanges: () => exchanges,
        ipex: () => ipex,
        notifications: () => notifications,
        credentials: () => credentials,
        operations: () => operations,
    } as unknown as SignifyClient;

    return {
        client,
        credentials,
        exchanges,
        ipex,
        notifications,
        operations,
    };
};

describe('credential service helpers', () => {
    it('normalizes SEDI voter credential attributes', () => {
        expect(
            normalizeSediVoterAttributes({
                i: ' Eholder ',
                fullName: ' Ada Voter ',
                voterId: ' SEDI-0001 ',
                precinctId: ' PCT-042 ',
                county: ' Demo County ',
                jurisdiction: ' SEDI ',
                electionId: ' SEDI-2026-DEMO ',
                eligible: true,
                expires: '2026-12-31T23:59:59Z',
            })
        ).toEqual({
            i: 'Eholder',
            fullName: 'Ada Voter',
            voterId: 'SEDI-0001',
            precinctId: 'PCT-042',
            county: 'Demo County',
            jurisdiction: 'SEDI',
            electionId: 'SEDI-2026-DEMO',
            eligible: true,
            expires: '2026-12-31T23:59:59Z',
        });
        expect(() =>
            normalizeSediVoterAttributes({
                i: 'Eholder',
                fullName: 'Ada Voter',
                voterId: 'SEDI-0001',
                precinctId: 'PCT-042',
                county: 'Demo County',
                jurisdiction: 'SEDI',
                electionId: 'SEDI-2026-DEMO',
                eligible: true,
                expires: 'not-a-date',
            })
        ).toThrow('Expires must be an ISO date time.');
    });

    it('hydrates credential grants as actionable only for the local holder', () => {
        expect(
            credentialGrantFromExchange({
                notification: grantNotification,
                exchange: grantExchange,
                localAids: new Set(['Eholder']),
                loadedAt,
            })
        ).toMatchObject({
            notificationId: 'note-1',
            grantSaid: 'Egrant',
            issuerAid: 'Eissuer',
            holderAid: 'Eholder',
            credentialSaid: 'Ecredential',
            schemaSaid: 'Eschema',
            status: 'actionable',
            attributes: expect.objectContaining({
                fullName: 'Ada Voter',
                eligible: true,
            }),
        });

        expect(
            credentialGrantFromExchange({
                notification: grantNotification,
                exchange: grantExchange,
                localAids: new Set(['Eother']),
                loadedAt,
            }).status
        ).toBe('notForThisWallet');
    });

    it('submits admit, removes the grant notification, and retries held credential fetch', async () => {
        const runtime = createAppRuntime({ storage: null });
        const { client, credentials, ipex, notifications, operations } =
            makeAdmitClient();

        try {
            const record = await runtime.runWorkflow(
                () =>
                    admitCredentialGrantService({
                        client,
                        holderAlias: 'holder',
                        holderAid: 'Eholder',
                        notificationId: 'note-1',
                        grantSaid: 'Egrant',
                    }),
                {
                    scope: 'app',
                    track: false,
                    kind: 'admitCredential',
                }
            );

            expect(ipex.admit).toHaveBeenCalledWith(
                expect.objectContaining({
                    senderName: 'holder',
                    grantSaid: 'Egrant',
                    recipient: 'Eissuer',
                })
            );
            expect(ipex.submitAdmit).toHaveBeenCalledWith(
                'holder',
                expect.objectContaining({
                    sad: expect.objectContaining({ d: 'Eadmit' }),
                }),
                ['signature'],
                'attachment',
                ['Eissuer']
            );
            expect(operations.wait).toHaveBeenCalledWith(
                { name: 'admit-op' } as KeriaOperation,
                expect.objectContaining({
                    signal: expect.any(AbortSignal),
                })
            );
            expect(notifications.mark).toHaveBeenCalledWith('note-1');
            expect(notifications.delete).toHaveBeenCalledWith('note-1');
            expect(credentials.get).toHaveBeenCalledTimes(2);
            expect(record).toMatchObject({
                said: 'Ecredential',
                status: 'admitted',
                direction: 'held',
                grantSaid: 'Egrant',
                admitSaid: 'Eadmit',
            });
        } finally {
            await runtime.destroy();
        }
    });

    it('lists credential registries for each local issuer identifier', async () => {
        const runtime = createAppRuntime({ storage: null });
        const registries = {
            list: vi.fn(async (name: string) =>
                name === 'issuer-one'
                    ? [{ name: 'registry-one', regk: 'Eregistry1' }]
                    : [{ name: 'registry-two', regk: 'Eregistry2' }]
            ),
        };
        const client = {
            registries: () => registries,
        } as unknown as SignifyClient;

        try {
            const inventory = await runtime.runWorkflow(
                () =>
                    listCredentialRegistriesService({
                        client,
                        identifiers: [
                            {
                                issuerAlias: 'issuer-one',
                                issuerAid: 'Eissuer1',
                            },
                            {
                                issuerAlias: 'issuer-two',
                                issuerAid: 'Eissuer2',
                            },
                        ],
                    }),
                {
                    scope: 'app',
                    track: false,
                    kind: 'syncInventory',
                }
            );

            expect(registries.list).toHaveBeenCalledWith('issuer-one');
            expect(registries.list).toHaveBeenCalledWith('issuer-two');
            expect(inventory.registries).toEqual([
                expect.objectContaining({
                    id: 'Eregistry1',
                    registryName: 'registry-one',
                    issuerAlias: 'issuer-one',
                    issuerAid: 'Eissuer1',
                }),
                expect.objectContaining({
                    id: 'Eregistry2',
                    registryName: 'registry-two',
                    issuerAlias: 'issuer-two',
                    issuerAid: 'Eissuer2',
                }),
            ]);
        } finally {
            await runtime.destroy();
        }
    });

    it('lists credentials issued by local AIDs and held by local AIDs', async () => {
        const runtime = createAppRuntime({ storage: null });
        const credentials = {
            list: vi.fn(
                async ({
                    filter,
                }: {
                    filter: Record<string, string>;
                }) => {
                    if (filter['-i'] === 'Eissuer') {
                        return [
                            {
                                sad: {
                                    d: 'EissuedCredential',
                                    s: 'Eschema',
                                    i: 'Eissuer',
                                    ri: 'Eregistry',
                                    a: {
                                        i: 'EremoteHolder',
                                        dt: loadedAt,
                                        fullName: 'Ada Voter',
                                        voterId: 'SEDI-0001',
                                        precinctId: 'PCT-042',
                                        county: 'Demo County',
                                        jurisdiction: 'SEDI',
                                        electionId: 'SEDI-2026-DEMO',
                                        eligible: true,
                                        expires: '2026-12-31T23:59:59Z',
                                    },
                                },
                            },
                        ];
                    }

                    if (filter['-a-i'] === 'Eholder') {
                        return [admittedCredential];
                    }

                    return [];
                }
            ),
            state: vi.fn(async () => ({ et: 'iss' })),
        };
        const client = {
            credentials: () => credentials,
        } as unknown as SignifyClient;

        try {
            const inventory = await runtime.runWorkflow(
                () =>
                    listCredentialInventoryService({
                        client,
                        localAids: ['Eissuer', 'Eholder'],
                    }),
                {
                    scope: 'app',
                    track: false,
                    kind: 'syncInventory',
                }
            );

            expect(credentials.list).toHaveBeenCalledWith({
                filter: { '-i': 'Eissuer' },
            });
            expect(credentials.list).toHaveBeenCalledWith({
                filter: { '-a-i': 'Eholder' },
            });
            expect(inventory).toEqual([
                expect.objectContaining({
                    said: 'EissuedCredential',
                    issuerAid: 'Eissuer',
                    holderAid: 'EremoteHolder',
                    direction: 'issued',
                    status: 'issued',
                }),
                expect.objectContaining({
                    said: 'Ecredential',
                    issuerAid: 'Eissuer',
                    holderAid: 'Eholder',
                    direction: 'held',
                    status: 'admitted',
                }),
            ]);
        } finally {
            await runtime.destroy();
        }
    });

    it('queries IPEX exchanges and links grants and admits to credentials', async () => {
        const runtime = createAppRuntime({ storage: null });
        const fetch = vi.fn(
            async (_path: string, _method: string, body: unknown) => {
                const route =
                    typeof body === 'object' &&
                    body !== null &&
                    'filter' in body &&
                    typeof body.filter === 'object' &&
                    body.filter !== null &&
                    '-r' in body.filter
                        ? String(body.filter['-r'])
                        : '';
                return {
                    json: async () =>
                        route === '/ipex/grant'
                            ? [
                                  grantExchange,
                                  {
                                      exn: {
                                          d: 'EotherGrant',
                                          i: 'Eissuer',
                                          rp: 'Eholder',
                                          dt: loadedAt,
                                          r: '/ipex/grant',
                                          e: {
                                              acdc: {
                                                  d: 'EotherCredential',
                                              },
                                          },
                                      },
                                  },
                              ]
                            : [
                                  {
                                      exn: {
                                          d: 'Eadmit',
                                          i: 'Eholder',
                                          rp: 'Eissuer',
                                          p: 'Egrant',
                                          dt: '2026-04-22T00:01:00.000Z',
                                          r: '/ipex/admit',
                                      },
                                  },
                              ],
                };
            }
        );
        const client = { fetch } as unknown as SignifyClient;

        try {
            const activities = await runtime.runWorkflow(
                () =>
                    listCredentialIpexActivityService({
                        client,
                        credentials: [
                            {
                                said: 'Ecredential',
                                schemaSaid: 'Eschema',
                                registryId: 'Eregistry',
                                issuerAid: 'Eissuer',
                                holderAid: 'Eholder',
                                direction: 'held',
                                status: 'admitted',
                                grantSaid: 'Egrant',
                                admitSaid: 'Eadmit',
                                notificationId: 'note-1',
                                issuedAt: loadedAt,
                                grantedAt: loadedAt,
                                admittedAt: '2026-04-22T00:01:00.000Z',
                                revokedAt: null,
                                error: null,
                                attributes: null,
                                updatedAt: loadedAt,
                            },
                        ],
                        localAids: ['Eholder'],
                    }),
                {
                    scope: 'app',
                    track: false,
                    kind: 'syncInventory',
                }
            );

            expect(fetch).toHaveBeenCalledWith('/exchanges/query', 'POST', {
                filter: { '-r': '/ipex/grant' },
                limit: 200,
            });
            expect(fetch).toHaveBeenCalledWith('/exchanges/query', 'POST', {
                filter: { '-r': '/ipex/admit' },
                limit: 200,
            });
            expect(activities).toEqual([
                expect.objectContaining({
                    credentialSaid: 'Ecredential',
                    exchangeSaid: 'Egrant',
                    kind: 'grant',
                    direction: 'received',
                    senderAid: 'Eissuer',
                    recipientAid: 'Eholder',
                    linkedGrantSaid: 'Egrant',
                }),
                expect.objectContaining({
                    credentialSaid: 'Ecredential',
                    exchangeSaid: 'Eadmit',
                    kind: 'admit',
                    direction: 'sent',
                    senderAid: 'Eholder',
                    recipientAid: 'Eissuer',
                    linkedGrantSaid: 'Egrant',
                }),
            ]);
        } finally {
            await runtime.destroy();
        }
    });

    it('detects credential schemas the agent already knows without OOBI resolution', async () => {
        const credentialType = ISSUEABLE_CREDENTIAL_TYPES[0];
        if (credentialType === undefined) {
            throw new Error('Expected at least one issueable credential type.');
        }

        const runtime = createAppRuntime({ storage: null });
        const schemas = {
            get: vi.fn(async (said: string) => ({
                title: `Schema ${said}`,
                description: 'Known schema',
                version: '1.0.0',
                rules: {
                    usageDisclaimer: {
                        l: 'Usage disclaimer',
                    },
                },
            })),
        };
        const client = {
            schemas: () => schemas,
        } as unknown as SignifyClient;

        try {
            const known = await runtime.runWorkflow(
                () =>
                    listKnownCredentialSchemasService({
                        client,
                        credentialTypes: ISSUEABLE_CREDENTIAL_TYPES,
                    }),
                {
                    scope: 'app',
                    track: false,
                    kind: 'syncInventory',
                }
            );

            expect(schemas.get).toHaveBeenCalledWith(credentialType.schemaSaid);
            expect(known[0]).toMatchObject({
                said: credentialType.schemaSaid,
                status: 'resolved',
                title: `Schema ${credentialType.schemaSaid}`,
                rules: {
                    usageDisclaimer: {
                        l: 'Usage disclaimer',
                    },
                },
            });
        } finally {
            await runtime.destroy();
        }
    });
});
