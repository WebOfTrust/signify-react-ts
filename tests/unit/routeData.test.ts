import { describe, expect, it, vi } from 'vitest';
import type {
    IdentifierCreateDraft,
    IdentifierSummary,
} from '../../src/domain/identifiers/identifierTypes';
import { defaultIdentifierCreateDraft } from '../../src/domain/identifiers/identifierHelpers';
import {
    contactsAction,
    credentialsAction,
    identifiersAction,
    loadClient,
    loadContacts,
    loadCredentials,
    loadDashboard,
    loadIdentifiers,
    loadMultisig,
    notificationsAction,
    multisigAction,
    rootAction,
    type RouteDataRuntime,
} from '../../src/app/routeData';
import { appConfig } from '../../src/config';
import { ISSUEABLE_CREDENTIAL_TYPES } from '../../src/config/credentialCatalog';
import type {
    SignifyClientConfig,
    SignifyStateSummary,
} from '../../src/signify/client';
import { multisigGroupDetailsFromIdentifier } from '../../src/domain/multisig/multisigGroupDetails';

const summary: SignifyStateSummary = {
    controllerPre: 'Econtroller',
    agentPre: 'Eagent',
    ridx: 0,
    pidx: 0,
    state: {
        controller: { state: { i: 'Econtroller' } },
        agent: { i: 'Eagent' },
    } as SignifyStateSummary['state'],
};

const makeRequest = (
    path: string,
    entries: Record<string, string>
): Request => {
    const formData = new FormData();
    for (const [key, value] of Object.entries(entries)) {
        formData.set(key, value);
    }

    return new Request(`http://localhost${path}`, {
        method: 'POST',
        body: formData,
    });
};

type RuntimeOverrides = Partial<
    Omit<
        RouteDataRuntime,
        | 'identifiers'
        | 'contacts'
        | 'challenges'
        | 'notifications'
        | 'delegations'
        | 'credentials'
        | 'multisig'
    >
> & {
    identifiers?: Partial<RouteDataRuntime['identifiers']>;
    contacts?: Partial<RouteDataRuntime['contacts']>;
    challenges?: Partial<RouteDataRuntime['challenges']>;
    notifications?: Partial<RouteDataRuntime['notifications']>;
    delegations?: Partial<RouteDataRuntime['delegations']>;
    credentials?: Partial<RouteDataRuntime['credentials']>;
    multisig?: Partial<RouteDataRuntime['multisig']>;
    didwebs?: Partial<RouteDataRuntime['didwebs']>;
};

const makeRuntime = (overrides: RuntimeOverrides = {}): RouteDataRuntime => {
    const runtime: RouteDataRuntime = {
        getClient: vi.fn(() => ({ url: 'http://keria.example' })),
        getState: vi.fn(() => summary),
        connect: vi.fn(async () => ({ state: summary })),
        generatePasscode: vi.fn(async () => '0123456789abcdefghijk'),
        refreshState: vi.fn(async () => summary),
        identifiers: {
            list: vi.fn(async () => [
                { name: 'alice', prefix: 'Ealice' } as IdentifierSummary,
            ]),
            get: vi.fn(
                async () =>
                    ({ name: 'alice', prefix: 'Ealice' }) as IdentifierSummary
            ),
            getDelegationChain: vi.fn(async () => []),
            create: vi.fn(async () => []),
            rotate: vi.fn(async () => []),
            startCreate: vi.fn(() => ({
                status: 'accepted',
                requestId: 'create-request-1',
                operationRoute: '/operations/create-request-1',
            })),
            startRotate: vi.fn(() => ({
                status: 'accepted',
                requestId: 'rotate-request-1',
                operationRoute: '/operations/rotate-request-1',
            })),
        },
        contacts: {
            syncInventory: vi.fn(async () => ({})),
            getIdentifierOobi: vi.fn(async () => ({
                id: 'alice:agent',
                identifier: 'alice',
                role: 'agent',
                oobis: [],
                generatedAt: '2026-04-21T00:00:00.000Z',
            })),
            listIdentifierOobis: vi.fn(async () => []),
            startGenerateOobi: vi.fn(() => ({
                status: 'accepted',
                requestId: 'oobi-request-1',
                operationRoute: '/operations/oobi-request-1',
            })),
            startResolve: vi.fn(() => ({
                status: 'accepted',
                requestId: 'resolve-request-1',
                operationRoute: '/operations/resolve-request-1',
            })),
            startDelete: vi.fn(() => ({
                status: 'accepted',
                requestId: 'delete-contact-request-1',
                operationRoute: '/operations/delete-contact-request-1',
            })),
            startUpdateAlias: vi.fn(() => ({
                status: 'accepted',
                requestId: 'update-contact-request-1',
                operationRoute: '/operations/update-contact-request-1',
            })),
        },
        challenges: {
            generate: vi.fn(async () => ({
                challengeId: 'challenge-1',
                counterpartyAid: 'Econtact',
                counterpartyAlias: 'Wan',
                localIdentifier: 'alice',
                localAid: 'Ealice',
                words: Array.from({ length: 12 }, (_, index) => 'word' + index),
                wordsHash: 'hash-one',
                strength: 128,
                generatedAt: '2026-04-21T00:00:00.000Z',
            })),
            startRespond: vi.fn(() => ({
                status: 'accepted',
                requestId: 'respond-challenge-request-1',
                operationRoute: '/operations/respond-challenge-request-1',
            })),
            startSendRequest: vi.fn(() => ({
                status: 'accepted',
                requestId: 'send-challenge-request-1',
                operationRoute: '/operations/send-challenge-request-1',
            })),
            startVerify: vi.fn(() => ({
                status: 'accepted',
                requestId: 'verify-challenge-request-1',
                operationRoute: '/operations/verify-challenge-request-1',
            })),
        },
        notifications: {
            dismissExchange: vi.fn(async () => undefined),
        },
        delegations: {
            startApprove: vi.fn(() => ({
                status: 'accepted',
                requestId: 'approve-delegation-request-1',
                operationRoute: '/operations/approve-delegation-request-1',
            })),
        },
        credentials: {
            syncInventory: vi.fn(async () => ({})),
            syncRegistries: vi.fn(async () => ({})),
            syncIpexActivity: vi.fn(async () => ({})),
            syncKnownSchemas: vi.fn(async () => ({})),
            listW3CVerifiers: vi.fn(async () => []),
            startResolveSchema: vi.fn(() => ({
                status: 'accepted',
                requestId: 'resolve-schema-request-1',
                operationRoute: '/operations/resolve-schema-request-1',
            })),
            startCreateRegistry: vi.fn(() => ({
                status: 'accepted',
                requestId: 'create-registry-request-1',
                operationRoute: '/operations/create-registry-request-1',
            })),
            startIssue: vi.fn(() => ({
                status: 'accepted',
                requestId: 'issue-credential-request-1',
                operationRoute: '/operations/issue-credential-request-1',
            })),
            startGrant: vi.fn(() => ({
                status: 'accepted',
                requestId: 'grant-credential-request-1',
                operationRoute: '/operations/grant-credential-request-1',
            })),
            startW3CIssuance: vi.fn(() => ({
                status: 'accepted',
                requestId: 'w3c-issuance-request-1',
                operationRoute: '/operations/w3c-issuance-request-1',
            })),
            startAdmit: vi.fn(() => ({
                status: 'accepted',
                requestId: 'admit-credential-request-1',
                operationRoute: '/operations/admit-credential-request-1',
            })),
            startPresent: vi.fn(() => ({
                status: 'accepted',
                requestId: 'present-credential-request-1',
                operationRoute: '/operations/present-credential-request-1',
            })),
        },
        multisig: {
            getGroupDetails: vi.fn(async (identifier: IdentifierSummary) =>
                multisigGroupDetailsFromIdentifier({
                    identifier,
                    membersResponse: null,
                })
            ),
            startCreateGroup: vi.fn(() => ({
                status: 'accepted',
                requestId: 'create-multisig-request-1',
                operationRoute: '/operations/create-multisig-request-1',
            })),
            startAcceptInception: vi.fn(() => ({
                status: 'accepted',
                requestId: 'accept-multisig-request-1',
                operationRoute: '/operations/accept-multisig-request-1',
            })),
            startAuthorizeAgents: vi.fn(() => ({
                status: 'accepted',
                requestId: 'authorize-multisig-request-1',
                operationRoute: '/operations/authorize-multisig-request-1',
            })),
            startAcceptEndRole: vi.fn(() => ({
                status: 'accepted',
                requestId: 'accept-role-multisig-request-1',
                operationRoute: '/operations/accept-role-multisig-request-1',
            })),
            startInteractGroup: vi.fn(() => ({
                status: 'accepted',
                requestId: 'interact-multisig-request-1',
                operationRoute: '/operations/interact-multisig-request-1',
            })),
            startAcceptInteraction: vi.fn(() => ({
                status: 'accepted',
                requestId: 'accept-interaction-multisig-request-1',
                operationRoute:
                    '/operations/accept-interaction-multisig-request-1',
            })),
            startRotateGroup: vi.fn(() => ({
                status: 'accepted',
                requestId: 'rotate-multisig-request-1',
                operationRoute: '/operations/rotate-multisig-request-1',
            })),
            startAcceptRotation: vi.fn(() => ({
                status: 'accepted',
                requestId: 'accept-rotation-multisig-request-1',
                operationRoute:
                    '/operations/accept-rotation-multisig-request-1',
            })),
            startJoinRotation: vi.fn(() => ({
                status: 'accepted',
                requestId: 'join-rotation-multisig-request-1',
                operationRoute: '/operations/join-rotation-multisig-request-1',
            })),
        },
        didwebs: {
            refreshIdentifierDid: vi.fn(async () => null),
        },
    };

    return {
        ...runtime,
        ...overrides,
        identifiers: {
            ...runtime.identifiers,
            ...overrides.identifiers,
        },
        contacts: {
            ...runtime.contacts,
            ...overrides.contacts,
        },
        challenges: {
            ...runtime.challenges,
            ...overrides.challenges,
        },
        notifications: {
            ...runtime.notifications,
            ...overrides.notifications,
        },
        delegations: {
            ...runtime.delegations,
            ...overrides.delegations,
        },
        credentials: {
            ...runtime.credentials,
            ...overrides.credentials,
        },
        multisig: {
            ...runtime.multisig,
            ...overrides.multisig,
        },
        didwebs: {
            ...runtime.didwebs,
            ...overrides.didwebs,
        },
    };
};

describe('route loaders', () => {
    it('blocks connected routes while disconnected', async () => {
        const runtime = makeRuntime({
            getClient: vi.fn(() => null),
            getState: vi.fn(() => null),
            refreshState: vi.fn(async () => null),
        });

        await expect(loadIdentifiers(runtime)).resolves.toEqual({
            status: 'blocked',
        });
        await expect(loadDashboard(runtime)).resolves.toEqual({
            status: 'blocked',
        });
        await expect(loadContacts(runtime)).resolves.toEqual({
            status: 'blocked',
        });
        await expect(loadCredentials(runtime)).resolves.toEqual({
            status: 'blocked',
        });
        await expect(loadMultisig(runtime)).resolves.toEqual({
            status: 'blocked',
        });
        await expect(loadClient(runtime)).resolves.toEqual({
            status: 'blocked',
        });
    });

    it('loads identifiers through the runtime boundary', async () => {
        const identifiers = [
            { name: 'alice', prefix: 'Ealice' } as IdentifierSummary,
        ];
        const runtime = makeRuntime({
            identifiers: {
                list: vi.fn(async () => identifiers),
            },
        });

        await expect(loadIdentifiers(runtime)).resolves.toEqual({
            status: 'ready',
            identifiers,
        });
    });

    it('returns actionable identifier load errors without throwing', async () => {
        const runtime = makeRuntime({
            identifiers: {
                list: vi.fn(async () => {
                    throw new Error('CORS rejected request');
                }),
            },
        });

        await expect(loadIdentifiers(runtime)).resolves.toMatchObject({
            status: 'error',
            identifiers: [],
            message: expect.stringContaining('Unable to load identifiers'),
        });
    });

    it('refreshes client state through the runtime boundary', async () => {
        const runtime = makeRuntime();

        await expect(loadClient(runtime)).resolves.toEqual({
            status: 'ready',
            summary,
        });
        expect(runtime.refreshState).toHaveBeenCalledOnce();
        expect(runtime.didwebs.refreshIdentifierDid).not.toHaveBeenCalled();
    });

    it('loads dashboard, session, and credential inventory through the runtime boundary', async () => {
        const runtime = makeRuntime();

        await expect(loadDashboard(runtime)).resolves.toEqual({
            status: 'ready',
            verifiers: appConfig.w3cVerifiers,
        });
        expect(runtime.refreshState).toHaveBeenCalledOnce();
        expect(runtime.identifiers.list).toHaveBeenCalledOnce();
        expect(runtime.didwebs.refreshIdentifierDid).not.toHaveBeenCalled();
        expect(runtime.contacts.syncInventory).toHaveBeenCalledOnce();
        expect(runtime.credentials.syncKnownSchemas).toHaveBeenCalledOnce();
        expect(runtime.credentials.syncRegistries).toHaveBeenCalledOnce();
        expect(runtime.credentials.syncInventory).toHaveBeenCalledOnce();
        expect(runtime.credentials.syncIpexActivity).toHaveBeenCalledOnce();
    });

    it('keeps dashboard ready when state refresh fails', async () => {
        const runtime = makeRuntime({
            refreshState: vi.fn(async () => {
                throw new Error('agent state unavailable');
            }),
        });

        await expect(loadDashboard(runtime)).resolves.toEqual({
            status: 'ready',
            verifiers: appConfig.w3cVerifiers,
        });
    });

    it('loads contact inventory through the runtime boundary', async () => {
        const runtime = makeRuntime();

        await expect(loadContacts(runtime)).resolves.toEqual({
            status: 'ready',
        });
        expect(runtime.identifiers.list).toHaveBeenCalledOnce();
        expect(runtime.contacts.syncInventory).toHaveBeenCalledOnce();
    });

    it('loads multisig inventory through identifiers and session sync', async () => {
        const identifiers = [
            {
                name: 'group',
                prefix: 'Egroup',
                group: {},
                state: {
                    kt: ['1/2', '1/2'],
                    nt: ['1/2', '1/2'],
                    s: '0',
                    d: 'Eevent',
                },
            } as IdentifierSummary,
        ];
        const runtime = makeRuntime({
            identifiers: {
                list: vi.fn(async () => identifiers),
            },
            multisig: {
                getGroupDetails: vi.fn(async (identifier) =>
                    multisigGroupDetailsFromIdentifier({
                        identifier,
                        membersResponse: {
                            signing: [{ prefix: 'Ealice' }, { prefix: 'Ebob' }],
                            rotation: [
                                { prefix: 'Ealice' },
                                { prefix: 'Ebob' },
                            ],
                        },
                    })
                ),
            },
        });

        await expect(loadMultisig(runtime)).resolves.toEqual({
            status: 'ready',
            identifiers,
            groupDetails: [
                {
                    groupAlias: 'group',
                    groupAid: 'Egroup',
                    signingMemberAids: ['Ealice', 'Ebob'],
                    rotationMemberAids: ['Ealice', 'Ebob'],
                    signingThreshold: ['1/2', '1/2'],
                    rotationThreshold: ['1/2', '1/2'],
                    sequence: '0',
                    digest: 'Eevent',
                },
            ],
        });
        expect(runtime.identifiers.list).toHaveBeenCalledOnce();
        expect(runtime.multisig.getGroupDetails).toHaveBeenCalledWith(
            identifiers[0],
            { signal: undefined }
        );
        expect(runtime.contacts.syncInventory).toHaveBeenCalledOnce();
    });

    it('loads credential registries and inventory after identifiers', async () => {
        const calls: string[] = [];
        const runtime = makeRuntime({
            identifiers: {
                list: vi.fn(async () => {
                    calls.push('identifiers');
                    return [];
                }),
            },
            contacts: {
                syncInventory: vi.fn(async () => {
                    calls.push('session');
                    return {};
                }),
            },
            credentials: {
                syncKnownSchemas: vi.fn(async () => {
                    calls.push('schemas');
                    return {};
                }),
                syncRegistries: vi.fn(async () => {
                    calls.push('registries');
                    return {};
                }),
                syncInventory: vi.fn(async () => {
                    calls.push('credentials');
                    return {};
                }),
                syncIpexActivity: vi.fn(async () => {
                    calls.push('ipexActivity');
                    return {};
                }),
            },
        });

        await expect(loadCredentials(runtime)).resolves.toEqual({
            status: 'ready',
            verifiers: appConfig.w3cVerifiers,
        });
        expect(calls[0]).toBe('identifiers');
        expect(calls).toEqual(
            expect.arrayContaining([
                'session',
                'schemas',
                'registries',
                'credentials',
                'ipexActivity',
            ])
        );
    });
});

describe('route actions', () => {
    it('connects through the root action and redirects to dashboard', async () => {
        const runtime = makeRuntime();
        const response = await rootAction(
            runtime,
            makeRequest('/', {
                intent: 'connect',
                adminUrl: 'http://admin.example',
                bootUrl: 'http://boot.example',
                passcode: '0123456789abcdefghijk',
            })
        );

        expect(response).toBeInstanceOf(Response);
        expect((response as Response).status).toBe(302);
        expect((response as Response).headers.get('Location')).toBe(
            '/dashboard'
        );
        expect(runtime.connect).toHaveBeenCalledWith(
            expect.objectContaining<Partial<SignifyClientConfig>>({
                adminUrl: 'http://admin.example',
                bootUrl: 'http://boot.example',
                passcode: '0123456789abcdefghijk',
            }),
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
    });

    it('returns typed root action errors for failed connections', async () => {
        const runtime = makeRuntime({
            connect: vi.fn(async () => null),
        });

        await expect(
            rootAction(
                runtime,
                makeRequest('/', {
                    intent: 'connect',
                    adminUrl: 'http://admin.example',
                    bootUrl: 'http://boot.example',
                    passcode: '0123456789abcdefghijk',
                })
            )
        ).resolves.toEqual({
            intent: 'connect',
            ok: false,
            message: 'Unable to connect to KERIA with the supplied passcode.',
        });
    });

    it('generates passcodes through the root action', async () => {
        const runtime = makeRuntime({
            generatePasscode: vi.fn(async () => 'abcdefghijklmnopqrstu'),
        });

        await expect(
            rootAction(
                runtime,
                makeRequest('/', {
                    intent: 'generatePasscode',
                })
            )
        ).resolves.toEqual({
            intent: 'generatePasscode',
            ok: true,
            passcode: 'abcdefghijklmnopqrstu',
        });
        expect(runtime.generatePasscode).toHaveBeenCalledWith(
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
    });

    it('creates identifiers through the identifiers action', async () => {
        const runtime = makeRuntime();
        const draft: IdentifierCreateDraft = {
            ...defaultIdentifierCreateDraft(),
            name: 'alice',
        };

        await expect(
            identifiersAction(
                runtime,
                makeRequest('/identifiers', {
                    intent: 'create',
                    requestId: 'create-request-1',
                    draft: JSON.stringify(draft),
                })
            )
        ).resolves.toEqual({
            intent: 'create',
            ok: true,
            message: 'Creating identifier alice',
            requestId: 'create-request-1',
            operationRoute: '/operations/create-request-1',
        });
        expect(runtime.identifiers.startCreate).toHaveBeenCalledWith(
            draft,
            expect.objectContaining({
                requestId: 'create-request-1',
            })
        );
    });

    it('returns typed create action errors for malformed drafts', async () => {
        const runtime = makeRuntime();

        await expect(
            identifiersAction(
                runtime,
                makeRequest('/identifiers', {
                    intent: 'create',
                    requestId: 'create-request-2',
                    draft: JSON.stringify({ name: 'missing-required-fields' }),
                })
            )
        ).resolves.toEqual({
            intent: 'create',
            ok: false,
            message: 'Invalid identifier create draft.',
            requestId: 'create-request-2',
        });
    });

    it('rotates identifiers through the identifiers action', async () => {
        const runtime = makeRuntime();

        await expect(
            identifiersAction(
                runtime,
                makeRequest('/identifiers', {
                    intent: 'rotate',
                    aid: 'alice',
                    requestId: 'rotate-request-1',
                })
            )
        ).resolves.toEqual({
            intent: 'rotate',
            ok: true,
            message: 'Rotating identifier alice',
            requestId: 'rotate-request-1',
            operationRoute: '/operations/rotate-request-1',
        });
        expect(runtime.identifiers.startRotate).toHaveBeenCalledWith(
            'alice',
            expect.objectContaining({ requestId: 'rotate-request-1' })
        );
    });

    it('creates multisig groups through the multisig action', async () => {
        const runtime = makeRuntime();
        const draft = {
            groupAlias: 'team',
            localMemberName: 'alice',
            localMemberAid: 'Ealice',
            members: [
                { aid: 'Ealice', alias: 'alice', source: 'local' },
                { aid: 'Ebob', alias: 'bob', source: 'contact' },
            ],
            signingMemberAids: ['Ealice', 'Ebob'],
            rotationMemberAids: ['Ealice', 'Ebob'],
            signingThreshold: {
                mode: 'autoEqual',
                memberAids: ['Ealice', 'Ebob'],
            },
            rotationThreshold: {
                mode: 'autoEqual',
                memberAids: ['Ealice', 'Ebob'],
            },
            witnessMode: 'none',
        };

        await expect(
            multisigAction(
                runtime,
                makeRequest('/multisig', {
                    intent: 'create',
                    requestId: 'create-multisig-request-1',
                    draft: JSON.stringify(draft),
                })
            )
        ).resolves.toEqual({
            intent: 'create',
            ok: true,
            message: 'Creating multisig group team',
            requestId: 'create-multisig-request-1',
            operationRoute: '/operations/create-multisig-request-1',
        });
        expect(runtime.multisig.startCreateGroup).toHaveBeenCalledWith(
            draft,
            expect.objectContaining({
                requestId: 'create-multisig-request-1',
            })
        );
    });

    it('accepts multisig requests through the multisig action', async () => {
        const runtime = makeRuntime();

        await expect(
            multisigAction(
                runtime,
                makeRequest('/multisig', {
                    intent: 'acceptInception',
                    requestId: 'accept-multisig-request-1',
                    notificationId: 'note-1',
                    exnSaid: 'Eexn',
                    groupAlias: 'team',
                    localMemberName: 'alice',
                })
            )
        ).resolves.toEqual({
            intent: 'acceptInception',
            ok: true,
            message: 'Handling multisig request for team',
            requestId: 'accept-multisig-request-1',
            operationRoute: '/operations/accept-multisig-request-1',
        });
        expect(runtime.multisig.startAcceptInception).toHaveBeenCalledWith(
            {
                notificationId: 'note-1',
                exnSaid: 'Eexn',
                groupAlias: 'team',
                localMemberName: 'alice',
            },
            expect.objectContaining({
                requestId: 'accept-multisig-request-1',
            })
        );
    });

    it('joins multisig inception requests through the multisig action alias', async () => {
        const runtime = makeRuntime();

        await expect(
            multisigAction(
                runtime,
                makeRequest('/multisig', {
                    intent: 'joinInception',
                    requestId: 'accept-multisig-request-1',
                    notificationId: 'note-1',
                    exnSaid: 'Eexn',
                    groupAlias: 'team',
                    localMemberName: 'alice',
                })
            )
        ).resolves.toEqual({
            intent: 'joinInception',
            ok: true,
            message: 'Joining multisig group team',
            requestId: 'accept-multisig-request-1',
            operationRoute: '/operations/accept-multisig-request-1',
        });
        expect(runtime.multisig.startAcceptInception).toHaveBeenCalledWith(
            {
                notificationId: 'note-1',
                exnSaid: 'Eexn',
                groupAlias: 'team',
                localMemberName: 'alice',
            },
            expect.objectContaining({
                requestId: 'accept-multisig-request-1',
            })
        );
    });

    it('rejects multisig inception joins without a follower-local group label', async () => {
        const runtime = makeRuntime();

        await expect(
            multisigAction(
                runtime,
                makeRequest('/multisig', {
                    intent: 'joinInception',
                    requestId: 'accept-multisig-request-1',
                    notificationId: 'note-1',
                    exnSaid: 'Eexn',
                    groupAlias: '',
                    localMemberName: 'alice',
                })
            )
        ).resolves.toEqual({
            intent: 'joinInception',
            ok: false,
            message: 'Enter a label for this new group identifier.',
            requestId: 'accept-multisig-request-1',
        });
        expect(runtime.multisig.startAcceptInception).not.toHaveBeenCalled();
    });

    it('starts multisig interactions with parsed JSON and plain-string payloads', async () => {
        const runtime = makeRuntime();

        await expect(
            multisigAction(
                runtime,
                makeRequest('/multisig', {
                    intent: 'interact',
                    requestId: 'interact-multisig-request-1',
                    groupAlias: 'team',
                    localMemberName: 'alice',
                    data: JSON.stringify({ anchor: 'Eevent', sequence: 1 }),
                })
            )
        ).resolves.toEqual({
            intent: 'interact',
            ok: true,
            message: 'Interacting with team',
            requestId: 'interact-multisig-request-1',
            operationRoute: '/operations/interact-multisig-request-1',
        });
        expect(runtime.multisig.startInteractGroup).toHaveBeenCalledWith(
            {
                groupAlias: 'team',
                localMemberName: 'alice',
                data: { anchor: 'Eevent', sequence: 1 },
            },
            expect.objectContaining({
                requestId: 'interact-multisig-request-1',
            })
        );

        const stringRuntime = makeRuntime();
        await expect(
            multisigAction(
                stringRuntime,
                makeRequest('/multisig', {
                    intent: 'interact',
                    requestId: 'interact-multisig-request-2',
                    groupAlias: 'team',
                    localMemberName: '',
                    data: 'plain interaction data',
                })
            )
        ).resolves.toEqual({
            intent: 'interact',
            ok: true,
            message: 'Interacting with team',
            requestId: 'interact-multisig-request-1',
            operationRoute: '/operations/interact-multisig-request-1',
        });
        expect(stringRuntime.multisig.startInteractGroup).toHaveBeenCalledWith(
            {
                groupAlias: 'team',
                localMemberName: null,
                data: 'plain interaction data',
            },
            expect.objectContaining({
                requestId: 'interact-multisig-request-2',
            })
        );
    });

    it('accepts multisig interaction requests through the multisig action', async () => {
        const runtime = makeRuntime();

        await expect(
            multisigAction(
                runtime,
                makeRequest('/multisig', {
                    intent: 'acceptInteraction',
                    requestId: 'accept-interaction-multisig-request-1',
                    notificationId: 'note-ixn',
                    exnSaid: 'Eixn-exn',
                    groupAlias: 'team',
                    localMemberName: 'alice',
                })
            )
        ).resolves.toEqual({
            intent: 'acceptInteraction',
            ok: true,
            message: 'Handling multisig request for team',
            requestId: 'accept-interaction-multisig-request-1',
            operationRoute: '/operations/accept-interaction-multisig-request-1',
        });
        expect(runtime.multisig.startAcceptInteraction).toHaveBeenCalledWith(
            {
                notificationId: 'note-ixn',
                exnSaid: 'Eixn-exn',
                groupAlias: 'team',
                localMemberName: 'alice',
            },
            expect.objectContaining({
                requestId: 'accept-interaction-multisig-request-1',
            })
        );
    });

    it('returns typed identifier action errors while disconnected', async () => {
        const runtime = makeRuntime({
            getClient: vi.fn(() => null),
        });

        await expect(
            identifiersAction(
                runtime,
                makeRequest('/identifiers', {
                    intent: 'rotate',
                    aid: 'alice',
                })
            )
        ).resolves.toEqual({
            intent: 'rotate',
            ok: false,
            message: 'Connect to KERIA before changing identifiers.',
        });
    });

    it('starts contact OOBI resolution through the contacts action', async () => {
        const runtime = makeRuntime();

        await expect(
            contactsAction(
                runtime,
                makeRequest('/contacts', {
                    intent: 'resolve',
                    requestId: 'resolve-request-1',
                    oobi: 'http://127.0.0.1:3902/oobi/Ealice/agent?name=alice',
                    alias: '',
                })
            )
        ).resolves.toEqual({
            intent: 'resolve',
            ok: true,
            message: 'Resolving contact OOBI',
            requestId: 'resolve-request-1',
            operationRoute: '/operations/resolve-request-1',
        });
        expect(runtime.contacts.startResolve).toHaveBeenCalledWith(
            {
                oobi: 'http://127.0.0.1:3902/oobi/Ealice/agent?name=alice',
                alias: null,
            },
            expect.objectContaining({ requestId: 'resolve-request-1' })
        );
    });

    it('starts local OOBI generation through the contacts action', async () => {
        const runtime = makeRuntime();

        await expect(
            contactsAction(
                runtime,
                makeRequest('/contacts', {
                    intent: 'generateOobi',
                    requestId: 'oobi-request-1',
                    identifier: 'alice',
                    role: 'agent',
                })
            )
        ).resolves.toEqual({
            intent: 'generateOobi',
            ok: true,
            message: 'Generating agent OOBI for alice',
            requestId: 'oobi-request-1',
            operationRoute: '/operations/oobi-request-1',
        });
        expect(runtime.contacts.startGenerateOobi).toHaveBeenCalledWith(
            { identifier: 'alice', role: 'agent' },
            expect.objectContaining({ requestId: 'oobi-request-1' })
        );
    });

    it('generates contact challenges and starts verification', async () => {
        const runtime = makeRuntime();

        await expect(
            contactsAction(
                runtime,
                makeRequest('/contacts/Econtact', {
                    intent: 'generateChallenge',
                    requestId: 'verify-challenge-request-1',
                    contactId: 'Econtact',
                    contactAlias: 'Wan',
                    localIdentifier: 'alice',
                    localAid: 'Ealice',
                })
            )
        ).resolves.toEqual({
            intent: 'generateChallenge',
            ok: true,
            message:
                'Generated challenge, sent request, and started verification',
            requestId: 'verify-challenge-request-1',
            operationRoute: '/operations/verify-challenge-request-1',
            challenge: expect.objectContaining({
                challengeId: 'challenge-1',
                words: expect.arrayContaining(['word0']),
            }),
        });
        expect(runtime.challenges.generate).toHaveBeenCalledWith(
            {
                counterpartyAid: 'Econtact',
                counterpartyAlias: 'Wan',
                localIdentifier: 'alice',
                localAid: 'Ealice',
            },
            expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
        expect(runtime.challenges.startSendRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                challengeId: 'challenge-1',
                counterpartyAid: 'Econtact',
                localIdentifier: 'alice',
                wordsHash: 'hash-one',
                strength: 128,
            }),
            expect.objectContaining({
                requestId: 'verify-challenge-request-1:challenge-request',
            })
        );
        expect(runtime.challenges.startVerify).toHaveBeenCalledWith(
            expect.objectContaining({
                challengeId: 'challenge-1',
                counterpartyAid: 'Econtact',
                words: expect.arrayContaining(['word0']),
            }),
            expect.objectContaining({ requestId: 'verify-challenge-request-1' })
        );
    });

    it('starts challenge responses through the contacts action', async () => {
        const runtime = makeRuntime();
        const words = Array.from({ length: 12 }, (_, index) => `word${index}`);

        await expect(
            contactsAction(
                runtime,
                makeRequest('/contacts/Econtact', {
                    intent: 'respondChallenge',
                    requestId: 'respond-challenge-request-1',
                    contactId: 'Econtact',
                    contactAlias: 'Wan',
                    localIdentifier: 'alice',
                    localAid: 'Ealice',
                    words: words.join(' '),
                })
            )
        ).resolves.toEqual({
            intent: 'respondChallenge',
            ok: true,
            message: 'Sending challenge response to Econtact',
            requestId: 'respond-challenge-request-1',
            operationRoute: '/operations/respond-challenge-request-1',
        });
        expect(runtime.challenges.startRespond).toHaveBeenCalledWith(
            {
                challengeId: 'respond-challenge-request-1',
                notificationId: undefined,
                wordsHash: null,
                counterpartyAid: 'Econtact',
                counterpartyAlias: 'Wan',
                localIdentifier: 'alice',
                localAid: 'Ealice',
                words,
            },
            expect.objectContaining({
                requestId: 'respond-challenge-request-1',
            })
        );
    });

    it('starts delegation approval through the notifications action', async () => {
        const runtime = makeRuntime();

        await expect(
            notificationsAction(
                runtime,
                makeRequest('/notifications/delegate-note-1', {
                    intent: 'approveDelegationRequest',
                    requestId: 'approve-delegation-request-1',
                    notificationId: 'delegate-note-1',
                    delegatorName: 'delegator',
                    delegatorAid: 'Edelegator',
                    delegateAid: 'Edelegate',
                    delegateEventSaid: 'Edelegate-event',
                    sequence: '0',
                    sourceAid: 'Edelegate',
                    createdAt: '2026-04-22T00:00:00.000Z',
                })
            )
        ).resolves.toEqual({
            intent: 'approveDelegationRequest',
            ok: true,
            message: 'Approving delegation for Edelegate',
            requestId: 'approve-delegation-request-1',
            operationRoute: '/operations/approve-delegation-request-1',
        });
        expect(runtime.delegations.startApprove).toHaveBeenCalledWith(
            {
                notificationId: 'delegate-note-1',
                delegatorName: 'delegator',
                request: expect.objectContaining({
                    delegatorAid: 'Edelegator',
                    delegateAid: 'Edelegate',
                    delegateEventSaid: 'Edelegate-event',
                    sequence: '0',
                    anchor: {
                        i: 'Edelegate',
                        s: '0',
                        d: 'Edelegate-event',
                    },
                }),
            },
            expect.objectContaining({
                requestId: 'approve-delegation-request-1',
            })
        );
    });

    it('passes challenge notification metadata through responses', async () => {
        const runtime = makeRuntime();
        const words = Array.from({ length: 12 }, (_, index) => `word${index}`);

        await expect(
            contactsAction(
                runtime,
                makeRequest('/notifications/note-1', {
                    intent: 'respondChallenge',
                    requestId: 'respond-challenge-request-3',
                    notificationId: 'note-1',
                    challengeId: 'challenge-1',
                    wordsHash: 'hash-one',
                    contactId: 'Econtact',
                    contactAlias: 'Wan',
                    localIdentifier: 'alice',
                    localAid: 'Ealice',
                    words: words.join(' '),
                })
            )
        ).resolves.toMatchObject({
            intent: 'respondChallenge',
            ok: true,
        });
        expect(runtime.challenges.startRespond).toHaveBeenCalledWith(
            {
                challengeId: 'challenge-1',
                notificationId: 'note-1',
                wordsHash: 'hash-one',
                counterpartyAid: 'Econtact',
                counterpartyAlias: 'Wan',
                localIdentifier: 'alice',
                localAid: 'Ealice',
                words,
            },
            expect.objectContaining({
                requestId: 'respond-challenge-request-3',
            })
        );
    });

    it('dismisses exchange notifications through the notifications action', async () => {
        const runtime = makeRuntime();

        await expect(
            notificationsAction(
                runtime,
                makeRequest('/notifications', {
                    intent: 'dismissExchangeNotification',
                    requestId: 'dismiss-request-1',
                    notificationId: 'challenge-request:Eexn',
                    exnSaid: 'Eexn',
                    route: '/challenge/request',
                })
            )
        ).resolves.toEqual({
            intent: 'dismissExchangeNotification',
            ok: true,
            message: 'Exchange notification dismissed.',
            requestId: 'dismiss-request-1',
            operationRoute: '/notifications',
        });
        expect(runtime.notifications.dismissExchange).toHaveBeenCalledWith(
            {
                notificationId: 'challenge-request:Eexn',
                exnSaid: 'Eexn',
                route: '/challenge/request',
            },
            expect.objectContaining({
                requestId: 'dismiss-request-1',
                signal: expect.any(AbortSignal),
            })
        );
    });

    it('starts credential schema resolution through the credentials action', async () => {
        const runtime = makeRuntime();

        await expect(
            credentialsAction(
                runtime,
                makeRequest('/credentials', {
                    intent: 'resolveSchema',
                    requestId: 'resolve-schema-request-1',
                    schemaSaid: 'Eschema',
                    schemaOobiUrl: 'http://schema.example/oobi/Eschema',
                })
            )
        ).resolves.toEqual({
            intent: 'resolveSchema',
            ok: true,
            message: 'Adding SEDI credential type',
            requestId: 'resolve-schema-request-1',
            operationRoute: '/operations/resolve-schema-request-1',
        });
        expect(runtime.credentials.startResolveSchema).toHaveBeenCalledWith(
            {
                schemaSaid: 'Eschema',
                schemaOobiUrl: 'http://schema.example/oobi/Eschema',
            },
            expect.objectContaining({ requestId: 'resolve-schema-request-1' })
        );
    });

    it('defaults credential schema resolution from the issueable catalog', async () => {
        const runtime = makeRuntime();
        const credentialType = ISSUEABLE_CREDENTIAL_TYPES[0];
        expect(credentialType).toBeDefined();

        await expect(
            credentialsAction(
                runtime,
                makeRequest('/credentials', {
                    intent: 'resolveSchema',
                    requestId: 'resolve-schema-request-1',
                })
            )
        ).resolves.toMatchObject({
            intent: 'resolveSchema',
            ok: true,
            requestId: 'resolve-schema-request-1',
        });
        expect(runtime.credentials.startResolveSchema).toHaveBeenCalledWith(
            {
                schemaSaid: credentialType?.schemaSaid,
                schemaOobiUrl: credentialType?.schemaOobiUrl,
            },
            expect.objectContaining({ requestId: 'resolve-schema-request-1' })
        );
    });

    it('starts credential issuance through the credentials action', async () => {
        const runtime = makeRuntime();

        await expect(
            credentialsAction(
                runtime,
                makeRequest('/credentials', {
                    intent: 'issueCredential',
                    requestId: 'issue-credential-request-1',
                    issuerAlias: 'issuer',
                    issuerAid: 'Eissuer',
                    holderAid: 'Eholder',
                    registryId: 'Eregistry',
                    schemaSaid: 'Eschema',
                    fullName: 'Ada Voter',
                    voterId: 'SEDI-0001',
                    precinctId: 'PCT-042',
                    county: 'Demo County',
                    jurisdiction: 'SEDI',
                    electionId: 'SEDI-2026-DEMO',
                    eligible: 'true',
                    expires: '2026-12-31T23:59:59Z',
                })
            )
        ).resolves.toEqual({
            intent: 'issueCredential',
            ok: true,
            message: 'Issuing credential to Eholder',
            requestId: 'issue-credential-request-1',
            operationRoute: '/operations/issue-credential-request-1',
        });
        expect(runtime.credentials.startIssue).toHaveBeenCalledWith(
            expect.objectContaining({
                issuerAlias: 'issuer',
                holderAid: 'Eholder',
                attributes: expect.objectContaining({
                    fullName: 'Ada Voter',
                    eligible: true,
                }),
            }),
            expect.objectContaining({ requestId: 'issue-credential-request-1' })
        );
    });

    it('starts holder admit through the credentials action', async () => {
        const runtime = makeRuntime();

        await expect(
            credentialsAction(
                runtime,
                makeRequest('/credentials', {
                    intent: 'admitCredentialGrant',
                    requestId: 'admit-credential-request-1',
                    holderAlias: 'holder',
                    holderAid: 'Eholder',
                    notificationId: 'note-1',
                    grantSaid: 'Egrant',
                })
            )
        ).resolves.toEqual({
            intent: 'admitCredentialGrant',
            ok: true,
            message: 'Admitting credential grant Egrant',
            requestId: 'admit-credential-request-1',
            operationRoute: '/operations/admit-credential-request-1',
        });
        expect(runtime.credentials.startAdmit).toHaveBeenCalledWith(
            {
                holderAlias: 'holder',
                holderAid: 'Eholder',
                notificationId: 'note-1',
                grantSaid: 'Egrant',
            },
            expect.objectContaining({ requestId: 'admit-credential-request-1' })
        );
    });

    it('starts W3C issuance through the credentials action', async () => {
        const runtime = makeRuntime();

        await expect(
            credentialsAction(
                runtime,
                makeRequest('/credentials', {
                    intent: 'startW3CIssuance',
                    requestId: 'w3c-issuance-request-1',
                    issuerAlias: 'issuer',
                    issuerAid: 'Eissuer',
                    credentialSaid: 'Ecredential',
                })
            )
        ).resolves.toEqual({
            intent: 'startW3CIssuance',
            ok: true,
            message: 'Starting W3C issuance for Ecredential',
            requestId: 'w3c-issuance-request-1',
            operationRoute: '/operations/w3c-issuance-request-1',
        });
        expect(runtime.credentials.startW3CIssuance).toHaveBeenCalledWith(
            {
                issuerAlias: 'issuer',
                issuerAid: 'Eissuer',
                credentialSaid: 'Ecredential',
            },
            expect.objectContaining({ requestId: 'w3c-issuance-request-1' })
        );
    });

    it('starts W3C credential presentation through the credentials action', async () => {
        const runtime = makeRuntime();

        await expect(
            credentialsAction(
                runtime,
                makeRequest('/credentials', {
                    intent: 'presentCredential',
                    requestId: 'present-credential-request-1',
                    presenterAlias: 'issuer',
                    presenterAid: 'Eissuer',
                    credentialSaid: 'Ecredential',
                    verifierRequest: JSON.stringify({
                        aud: 'https://verifier.example',
                        nonce: 'nonce-1',
                    }),
                })
            )
        ).resolves.toEqual({
            intent: 'presentCredential',
            ok: true,
            message: 'Presenting credential Ecredential',
            requestId: 'present-credential-request-1',
            operationRoute: '/operations/present-credential-request-1',
        });
        expect(runtime.credentials.startPresent).toHaveBeenCalledWith(
            {
                presenterAlias: 'issuer',
                presenterAid: 'Eissuer',
                credentialSaid: 'Ecredential',
                verifierRequest: {
                    aud: 'https://verifier.example',
                    nonce: 'nonce-1',
                },
            },
            expect.objectContaining({
                requestId: 'present-credential-request-1',
            })
        );
    });

    it('rejects W3C credential presentation without a local presenter', async () => {
        const runtime = makeRuntime();

        await expect(
            credentialsAction(
                runtime,
                makeRequest('/credentials', {
                    intent: 'presentCredential',
                    credentialSaid: 'Ecredential',
                    verifierRequest: JSON.stringify({
                        aud: 'https://verifier.example',
                        nonce: 'nonce-1',
                    }),
                })
            )
        ).resolves.toMatchObject({
            intent: 'presentCredential',
            ok: false,
            message:
                'Presenter identifier, credential, and verifier request JSON are required.',
        });
        expect(runtime.credentials.startPresent).not.toHaveBeenCalled();
    });

    it('rejects malformed challenge word submissions', async () => {
        const runtime = makeRuntime();

        await expect(
            contactsAction(
                runtime,
                makeRequest('/contacts/Econtact', {
                    intent: 'respondChallenge',
                    requestId: 'respond-challenge-request-2',
                    contactId: 'Econtact',
                    localIdentifier: 'alice',
                    words: 'one two',
                })
            )
        ).resolves.toEqual({
            intent: 'respondChallenge',
            ok: false,
            message: 'Challenge must contain 12 or 24 words.',
            requestId: 'respond-challenge-request-2',
        });
        expect(runtime.challenges.startRespond).not.toHaveBeenCalled();
    });
});
