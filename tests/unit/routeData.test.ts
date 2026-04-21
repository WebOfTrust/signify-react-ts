import { describe, expect, it, vi } from 'vitest';
import type {
    DynamicIdentifierField,
    IdentifierSummary,
} from '../../src/features/identifiers/identifierTypes';
import {
    identifiersAction,
    loadClient,
    loadCredentials,
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
    createIdentifier: vi.fn(async () => []),
    rotateIdentifier: vi.fn(async () => []),
    ...overrides,
});

describe('route loaders', () => {
    it('blocks identifiers, credentials, and client routes while disconnected', async () => {
        const runtime = makeRuntime({
            getClient: vi.fn(() => null),
            getState: vi.fn(() => null),
            refreshState: vi.fn(async () => null),
        });

        await expect(loadIdentifiers(runtime)).resolves.toEqual({
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
});

describe('route actions', () => {
    it('connects through the root action and redirects to identifiers', async () => {
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
            '/identifiers'
        );
        expect(runtime.connect).toHaveBeenCalledWith(
            expect.objectContaining<Partial<SignifyClientConfig>>({
                adminUrl: 'http://admin.example',
                bootUrl: 'http://boot.example',
                passcode: '0123456789abcdefghijk',
            })
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
        expect(runtime.generatePasscode).toHaveBeenCalledOnce();
    });

    it('creates identifiers through the identifiers action', async () => {
        const runtime = makeRuntime();
        const fields: DynamicIdentifierField[] = [
            { field: 'count', value: '1' },
        ];

        await expect(
            identifiersAction(
                runtime,
                makeRequest('/identifiers', {
                    intent: 'create',
                    name: 'alice',
                    algo: 'salty',
                    fields: JSON.stringify(fields),
                })
            )
        ).resolves.toEqual({
            intent: 'create',
            ok: true,
            message: 'Created identifier alice',
        });
        expect(runtime.createIdentifier).toHaveBeenCalledWith(
            'alice',
            'salty',
            fields
        );
    });

    it('rotates identifiers through the identifiers action', async () => {
        const runtime = makeRuntime();

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
            ok: true,
            message: 'Rotated identifier alice',
        });
        expect(runtime.rotateIdentifier).toHaveBeenCalledWith('alice');
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
});
