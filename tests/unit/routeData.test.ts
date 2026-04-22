import { describe, expect, it, vi } from 'vitest';
import type {
    IdentifierCreateDraft,
    IdentifierSummary,
} from '../../src/features/identifiers/identifierTypes';
import { defaultIdentifierCreateDraft } from '../../src/features/identifiers/identifierHelpers';
import {
    contactsAction,
    identifiersAction,
    loadClient,
    loadContacts,
    loadCredentials,
    loadDashboard,
    loadIdentifiers,
    rootAction,
    type RouteDataRuntime,
} from '../../src/app/routeData';
import type {
    ConnectedSignifyClient,
    SignifyClientConfig,
    SignifyStateSummary,
} from '../../src/signify/client';

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

const makeRuntime = (
    overrides: Partial<RouteDataRuntime> = {}
): RouteDataRuntime => ({
    getClient: vi.fn(() => ({ url: 'http://keria.example' })),
    getState: vi.fn(() => summary),
    connect: vi.fn(async () => ({ state: summary } as ConnectedSignifyClient)),
    generatePasscode: vi.fn(async () => '0123456789abcdefghijk'),
    refreshState: vi.fn(async () => summary),
    listIdentifiers: vi.fn(async () => [
        { name: 'alice', prefix: 'Ealice' } as IdentifierSummary,
    ]),
    syncSessionInventory: vi.fn(async () => ({})),
    createIdentifier: vi.fn(async () => []),
    rotateIdentifier: vi.fn(async () => []),
    startCreateIdentifier: vi.fn(() => ({
        status: 'accepted',
        requestId: 'create-request-1',
        operationRoute: '/operations/create-request-1',
    })),
    startRotateIdentifier: vi.fn(() => ({
        status: 'accepted',
        requestId: 'rotate-request-1',
        operationRoute: '/operations/rotate-request-1',
    })),
    startGenerateOobi: vi.fn(() => ({
        status: 'accepted',
        requestId: 'oobi-request-1',
        operationRoute: '/operations/oobi-request-1',
    })),
    startResolveContact: vi.fn(() => ({
        status: 'accepted',
        requestId: 'resolve-request-1',
        operationRoute: '/operations/resolve-request-1',
    })),
    startDeleteContact: vi.fn(() => ({
        status: 'accepted',
        requestId: 'delete-contact-request-1',
        operationRoute: '/operations/delete-contact-request-1',
    })),
    startUpdateContactAlias: vi.fn(() => ({
        status: 'accepted',
        requestId: 'update-contact-request-1',
        operationRoute: '/operations/update-contact-request-1',
    })),
    ...overrides,
});

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
        expect(loadCredentials(runtime)).toEqual({ status: 'blocked' });
        await expect(loadClient(runtime)).resolves.toEqual({
            status: 'blocked',
        });
    });

    it('loads identifiers through the runtime boundary', async () => {
        const identifiers = [
            { name: 'alice', prefix: 'Ealice' } as IdentifierSummary,
        ];
        const runtime = makeRuntime({
            listIdentifiers: vi.fn(async () => identifiers),
        });

        await expect(loadIdentifiers(runtime)).resolves.toEqual({
            status: 'ready',
            identifiers,
        });
    });

    it('returns actionable identifier load errors without throwing', async () => {
        const runtime = makeRuntime({
            listIdentifiers: vi.fn(async () => {
                throw new Error('CORS rejected request');
            }),
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
    });

    it('loads dashboard and contact inventory through the runtime boundary', async () => {
        const runtime = makeRuntime();

        await expect(loadDashboard(runtime)).resolves.toEqual({
            status: 'ready',
        });
        await expect(loadContacts(runtime)).resolves.toEqual({
            status: 'ready',
        });
        expect(runtime.listIdentifiers).toHaveBeenCalledTimes(2);
        expect(runtime.syncSessionInventory).toHaveBeenCalledTimes(2);
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
        expect(runtime.startCreateIdentifier).toHaveBeenCalledWith(
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
        expect(runtime.startRotateIdentifier).toHaveBeenCalledWith(
            'alice',
            expect.objectContaining({ requestId: 'rotate-request-1' })
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
        expect(runtime.startResolveContact).toHaveBeenCalledWith(
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
        expect(runtime.startGenerateOobi).toHaveBeenCalledWith(
            { identifier: 'alice', role: 'agent' },
            expect.objectContaining({ requestId: 'oobi-request-1' })
        );
    });
});
