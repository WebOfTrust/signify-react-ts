import type { Operation as EffectionOperation } from 'effection';
import { describe, expect, it } from 'vitest';
import {
    createChallengeRuntimeCommands,
    createContactRuntimeCommands,
    createCredentialRuntimeCommands,
    createDelegationRuntimeCommands,
    createIdentifierRuntimeCommands,
    createMultisigRuntimeCommands,
    createNotificationRuntimeCommands,
    type BackgroundWorkflowRunOptions,
    type RuntimeCommandContext,
    type WorkflowRunOptions,
} from '../../src/app/runtimeCommands';
import { defaultIdentifierCreateDraft } from '../../src/domain/identifiers/identifierHelpers';
import type { IdentifierSummary } from '../../src/domain/identifiers/identifierTypes';
import { identifierListLoaded } from '../../src/state/identifiers.slice';
import type { DelegationRequestNotification } from '../../src/state/notifications.slice';
import { createAppStore } from '../../src/state/store';

const makeContext = () => {
    const store = createAppStore();
    const startedOptions: BackgroundWorkflowRunOptions<unknown>[] = [];
    const workflowOptions: WorkflowRunOptions[] = [];
    const context: RuntimeCommandContext = {
        runWorkflow: (<T>(
            _operation: () => EffectionOperation<T>,
            options: WorkflowRunOptions = {}
        ) => {
            workflowOptions.push(options);
            return Promise.resolve(undefined as T);
        }) as RuntimeCommandContext['runWorkflow'],
        startBackgroundWorkflow: (<T>(
            _operation: () => EffectionOperation<T>,
            options: BackgroundWorkflowRunOptions<T>
        ) => {
            startedOptions.push(
                options as BackgroundWorkflowRunOptions<unknown>
            );
            const requestId = options.requestId ?? 'generated-request';
            return {
                status: 'accepted',
                requestId,
                operationRoute: `/operations/${requestId}`,
            };
        }) as RuntimeCommandContext['startBackgroundWorkflow'],
        createRequestId: () => 'generated-request',
        getState: () => store.getState(),
    };

    return { context, startedOptions, store, workflowOptions };
};

describe('runtime command adapters', () => {
    it('launches representative foreground workflows with expected tracking defaults', async () => {
        const { context, workflowOptions } = makeContext();

        await createIdentifierRuntimeCommands(context).list();
        await createContactRuntimeCommands(context).syncInventory();
        await createCredentialRuntimeCommands(context).syncKnownSchemas();
        await createChallengeRuntimeCommands(context).generate({
            counterpartyAid: 'Econtact',
            localIdentifier: 'alice',
        });
        await createNotificationRuntimeCommands(context).dismissExchange({
            notificationId: 'note-1',
            exnSaid: 'Eexn',
            route: '/challenge/request',
        });

        expect(workflowOptions).toMatchObject([
            {
                label: 'Loading identifiers...',
                kind: 'listIdentifiers',
            },
            {
                label: undefined,
                kind: 'syncInventory',
                track: false,
            },
            {
                label: undefined,
                kind: 'syncInventory',
                track: false,
            },
            {
                kind: 'generateChallenge',
                track: false,
            },
            {
                kind: 'workflow',
                track: false,
            },
        ]);
    });

    it('builds identifier create background metadata without runtime domain ownership', () => {
        const { context, startedOptions } = makeContext();
        const commands = createIdentifierRuntimeCommands(context);
        const draft = {
            ...defaultIdentifierCreateDraft(),
            name: 'alice',
            delegation: {
                mode: 'delegated',
                delegatorAid: 'Edelegator',
            },
        };

        const started = commands.startCreate(draft, {
            requestId: 'identifier-request',
        });

        expect(started).toEqual({
            status: 'accepted',
            requestId: 'identifier-request',
            operationRoute: '/operations/identifier-request',
        });
        expect(startedOptions[0]).toMatchObject({
            label: 'Creating identifier alice',
            title: 'Create delegated identifier alice',
            kind: 'createDelegatedIdentifier',
            resourceKeys: [
                'identifier:name:alice',
                'delegation:delegator:Edelegator:name:alice',
            ],
            resultRoute: { label: 'View identifiers', path: '/identifiers' },
        });
        expect(startedOptions[0]?.payloadDetails).toBeDefined();
    });

    it('builds delegated identifier rotation metadata from current state', () => {
        const { context, startedOptions, store } = makeContext();
        store.dispatch(
            identifierListLoaded({
                identifiers: [
                    {
                        name: 'delegate',
                        prefix: 'Edelegate',
                        state: { di: 'Edelegator' },
                    },
                ] as IdentifierSummary[],
                loadedAt: '2026-04-21T00:00:00.000Z',
            })
        );

        createIdentifierRuntimeCommands(context).startRotate('Edelegate', {
            requestId: 'rotate-request',
        });

        expect(startedOptions[0]).toMatchObject({
            requestId: 'rotate-request',
            label: 'Rotating identifier Edelegate',
            title: 'Rotate delegated identifier Edelegate',
            kind: 'rotateDelegatedIdentifier',
            resourceKeys: [
                'identifier:aid:Edelegate',
                'delegation:delegate:Edelegate',
            ],
            resultRoute: { label: 'View identifiers', path: '/identifiers' },
            successNotification: {
                title: 'Delegated rotation complete',
                message: 'The delegator approved the rotation for Edelegate.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Delegated rotation failed',
                message: 'The rotation for Edelegate failed.',
                severity: 'error',
            },
        });
        expect(startedOptions[0]?.payloadDetails).toBeDefined();
    });

    it('builds contact resolve and OOBI metadata with copyable payload extractors', () => {
        const { context, startedOptions } = makeContext();
        const commands = createContactRuntimeCommands(context);

        commands.startResolve({
            oobi: ' http://127.0.0.1:3902/oobi/Ealice/agent ',
            alias: 'Alice',
        });
        commands.startGenerateOobi({
            identifier: ' alice ',
            role: 'agent',
        });

        expect(startedOptions[0]).toMatchObject({
            label: 'Resolving contact Alice',
            title: 'Resolve contact OOBI',
            kind: 'resolveContact',
            resourceKeys: [
                'contact:oobi:http://127.0.0.1:3902/oobi/Ealice/agent',
                'contact:alias:Alice',
            ],
            resultRoute: { label: 'View contacts', path: '/contacts' },
        });
        expect(startedOptions[0]?.payloadDetails).toBeDefined();
        expect(startedOptions[1]).toMatchObject({
            label: 'Generating agent OOBI for alice',
            title: 'Generate agent OOBI',
            kind: 'generateOobi',
            resourceKeys: ['oobi:alice:agent'],
        });
        expect(startedOptions[1]?.payloadDetails).toBeDefined();
    });

    it('builds contact delete and update metadata', () => {
        const { context, startedOptions } = makeContext();
        const commands = createContactRuntimeCommands(context);

        commands.startDelete('contact-1', { requestId: 'delete-request' });
        commands.startUpdateAlias(
            { contactId: 'contact-1', alias: 'Alice' },
            { requestId: 'update-request' }
        );

        expect(startedOptions[0]).toMatchObject({
            requestId: 'delete-request',
            label: 'Deleting contact contact-1',
            title: 'Delete contact',
            kind: 'deleteContact',
            resourceKeys: ['contact:contact-1'],
            resultRoute: { label: 'View contacts', path: '/contacts' },
            successNotification: {
                title: 'Contact deleted',
                message: 'contact-1 was deleted.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Contact deletion failed',
                message: 'contact-1 could not be deleted.',
                severity: 'error',
            },
        });
        expect(startedOptions[1]).toMatchObject({
            requestId: 'update-request',
            label: 'Updating contact contact-1',
            title: 'Update contact alias',
            kind: 'updateContact',
            resourceKeys: ['contact:contact-1'],
            resultRoute: { label: 'View contacts', path: '/contacts' },
            successNotification: {
                title: 'Contact updated',
                message: 'contact-1 was updated.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Contact update failed',
                message: 'contact-1 could not be updated.',
                severity: 'error',
            },
        });
    });

    it('builds delegation approval metadata with delegation payload extraction', () => {
        const { context, startedOptions } = makeContext();
        const commands = createDelegationRuntimeCommands(context);
        const request: DelegationRequestNotification = {
            notificationId: 'note-1',
            delegatorAid: 'Edelegator',
            delegateAid: 'Edelegate',
            delegateEventSaid: 'Eevent',
            sequence: '0',
            anchor: { i: 'Edelegate', s: '0', d: 'Eevent' },
            sourceAid: 'Edelegate',
            createdAt: '2026-04-21T00:00:00.000Z',
            status: 'pending',
        };

        commands.startApprove({
            notificationId: 'note-1',
            delegatorName: 'root',
            request,
        });

        expect(startedOptions[0]).toMatchObject({
            label: 'Approving delegation for Edelegate',
            title: 'Approve delegation',
            kind: 'approveDelegation',
            resourceKeys: [
                'delegation:approval:note-1',
                'delegation:delegate:Edelegate',
            ],
            resultRoute: {
                label: 'View notifications',
                path: '/notifications',
            },
        });
        expect(startedOptions[0]?.payloadDetails).toBeDefined();
    });

    it('builds credential issue, grant, and admit metadata', () => {
        const { context, startedOptions } = makeContext();
        const commands = createCredentialRuntimeCommands(context);

        commands.startResolveSchema({
            schemaSaid: 'Eschema',
            schemaOobiUrl: 'http://schema.example/oobi',
        });
        commands.startCreateRegistry({
            issuerAlias: 'issuer',
            issuerAid: 'Eissuer',
            registryName: 'registry',
        });
        commands.startIssue({
            issuerAlias: 'issuer',
            issuerAid: 'Eissuer',
            holderAid: 'Eholder',
            registryId: 'registry-1',
            schemaSaid: 'Eschema',
            attributes: {
                i: 'Eholder',
                fullName: 'Ada Holder',
                voterId: 'VOTER-1',
                precinctId: 'P-1',
                county: 'Demo',
                jurisdiction: 'Demo City',
                electionId: '2026-demo',
                eligible: true,
                expires: '2026-12-31',
            },
        });
        commands.startGrant({
            issuerAlias: 'issuer',
            issuerAid: 'Eissuer',
            holderAid: 'Eholder',
            credentialSaid: 'Ecredential',
        });
        commands.startW3CIssuance({
            issuerAlias: 'issuer',
            issuerAid: 'Eissuer',
            credentialSaid: 'Ecredential',
        });
        commands.startAdmit({
            holderAlias: 'holder',
            holderAid: 'Eholder',
            notificationId: 'note-1',
            grantSaid: 'Egrant',
        });
        commands.startPresent({
            presenterAlias: 'issuer',
            presenterAid: 'Eissuer',
            credentialSaid: 'Ecredential',
            verifierRequest: {
                aud: 'https://verifier.example',
                nonce: 'nonce-1',
            },
        });

        expect(startedOptions[0]).toMatchObject({
            label: 'Adding SEDI credential type',
            title: 'Add credential type',
            kind: 'resolveSchema',
            resourceKeys: ['schema:Eschema'],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential type added',
                message:
                    'The SEDI credential type is available to this wallet.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential type add failed',
                message: 'The SEDI credential type could not be added.',
                severity: 'error',
            },
        });
        expect(startedOptions[1]).toMatchObject({
            label: 'Creating registry for issuer',
            title: 'Create credential registry',
            kind: 'createRegistry',
            resourceKeys: ['registry:Eissuer'],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential registry ready',
                message: 'The issuer credential registry is ready.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential registry failed',
                message:
                    'The issuer credential registry could not be prepared.',
                severity: 'error',
            },
        });
        expect(startedOptions[2]).toMatchObject({
            label: 'Issuing credential to Eholder',
            title: 'Issue SEDI voter credential',
            kind: 'issueCredential',
            resourceKeys: ['credential:issue:Eissuer:Eholder:VOTER-1'],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential issued',
                message: 'The SEDI voter credential was issued.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential issuance failed',
                message: 'The SEDI voter credential could not be issued.',
                severity: 'error',
            },
        });
        expect(startedOptions[3]).toMatchObject({
            label: 'Granting credential Ecredential',
            title: 'Grant credential',
            kind: 'grantCredential',
            resourceKeys: ['credential:Ecredential:grant'],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential grant sent',
                message: 'The credential grant was sent to the holder.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential grant failed',
                message: 'The credential grant could not be sent.',
                severity: 'error',
            },
        });
        expect(startedOptions[4]).toMatchObject({
            label: 'Starting W3C issuance for Ecredential',
            title: 'Start W3C issuance',
            kind: 'w3cIssuance',
            resourceKeys: ['credential:Ecredential:w3c-issue'],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'W3C VRD issued',
                message:
                    'The W3C VC-JWT was issued from the native VRD credential.',
                severity: 'success',
            },
            failureNotification: {
                title: 'W3C issuance failed',
                message: 'The W3C VRD could not be issued.',
                severity: 'error',
            },
        });
        expect(startedOptions[5]).toMatchObject({
            label: 'Admitting credential grant Egrant',
            title: 'Admit credential grant',
            kind: 'admitCredential',
            resourceKeys: ['grant:Egrant:admit'],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential admitted',
                message: 'The credential is now available in this wallet.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential admit failed',
                message: 'The credential grant could not be admitted.',
                severity: 'error',
            },
        });
        expect(startedOptions[6]).toMatchObject({
            label: 'Presenting credential Ecredential',
            title: 'Present credential',
            kind: 'presentCredential',
            resourceKeys: ['credential:Ecredential:w3c-present'],
            resultRoute: { label: 'View credentials', path: '/credentials' },
            successNotification: {
                title: 'Credential presented',
                message:
                    'KERIA recorded the W3C presentation transaction result.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Credential presentation failed',
                message:
                    'The credential could not be presented through the verifier request.',
                severity: 'error',
            },
        });
    });

    it('builds challenge response, request, and verify metadata', () => {
        const { context, startedOptions } = makeContext();
        const commands = createChallengeRuntimeCommands(context);

        commands.startRespond({
            challengeId: 'challenge-1',
            counterpartyAid: 'Econtact',
            localIdentifier: 'alice',
            words: ['one', 'two'],
        });
        commands.startSendRequest({
            challengeId: 'challenge-1',
            counterpartyAid: 'Econtact',
            localIdentifier: 'alice',
            wordsHash: 'hash-one',
            strength: 128,
        });
        commands.startVerify({
            challengeId: 'challenge-1',
            counterpartyAid: 'Econtact',
            localIdentifier: 'alice',
            words: ['one', 'two'],
        });

        expect(startedOptions[0]).toMatchObject({
            label: 'Sending challenge response to Econtact',
            title: 'Send challenge response',
            kind: 'respondChallenge',
            resourceKeys: ['challenge:respond:Econtact:alice:challenge-1'],
            resultRoute: { label: 'View contact', path: '/contacts/Econtact' },
            successNotification: {
                title: 'Challenge response sent',
                message: 'The signed challenge response was sent.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Challenge response failed',
                message: 'The challenge response could not be sent.',
                severity: 'error',
            },
        });
        expect(startedOptions[1]).toMatchObject({
            label: 'Sending challenge request to Econtact',
            title: 'Send challenge request',
            kind: 'sendChallengeRequest',
            resourceKeys: ['challenge:request:Econtact:alice:challenge-1'],
            resultRoute: { label: 'View contact', path: '/contacts/Econtact' },
            successNotification: {
                title: 'Challenge request sent',
                message:
                    'The contact was notified that a challenge response is requested.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Challenge request failed',
                message:
                    'The challenge words remain available, but the notification could not be sent.',
                severity: 'error',
            },
        });
        expect(startedOptions[2]).toMatchObject({
            label: 'Waiting for challenge response from Econtact',
            title: 'Verify challenge response',
            kind: 'verifyChallenge',
            resourceKeys: ['challenge:verify:Econtact:challenge-1'],
            resultRoute: { label: 'View contact', path: '/contacts/Econtact' },
            successNotification: {
                title: 'Challenge verified',
                message: 'The contact challenge response was accepted.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Challenge verification failed',
                message: 'The challenge response was not verified.',
                severity: 'error',
            },
        });
    });

    it('builds multisig metadata for group and proposal commands', () => {
        const { context, startedOptions } = makeContext();
        const commands = createMultisigRuntimeCommands(context);

        commands.startCreateGroup({
            groupAlias: 'team',
            localMemberAid: 'Ealice',
            localMemberName: 'alice',
            members: [],
            signingMemberAids: ['Ealice', 'Ebob'],
            rotationMemberAids: ['Ealice', 'Ebob'],
            signingThreshold: { mode: 'numeric', value: '1' },
            rotationThreshold: { mode: 'numeric', value: '1' },
            witnessMode: 'none',
        });
        commands.startAuthorizeAgents({
            groupAlias: ' team ',
            localMemberName: 'alice',
        });
        commands.startInteractGroup({
            groupAlias: ' team ',
            localMemberName: 'alice',
            data: 'hello',
        });
        commands.startRotateGroup({
            groupAlias: ' team ',
            localMemberName: 'alice',
            signingMemberAids: ['Ealice', 'Ebob'],
            rotationMemberAids: ['Ealice', 'Ebob'],
            nextThreshold: { mode: 'numeric', value: '1' },
        });
        commands.startAcceptInception({
            notificationId: 'note-1',
            exnSaid: 'Eexn-inception',
            groupAlias: 'team',
            localMemberName: 'alice',
        });
        commands.startAcceptEndRole({
            notificationId: 'note-2',
            exnSaid: 'Eexn-role',
            groupAlias: 'team',
            localMemberName: 'alice',
        });
        commands.startAcceptInteraction({
            notificationId: 'note-3',
            exnSaid: 'Eexn',
            groupAlias: 'team',
            localMemberName: 'alice',
        });
        commands.startAcceptRotation({
            notificationId: 'note-4',
            exnSaid: 'Eexn-rotation',
            groupAlias: 'team',
            localMemberName: 'alice',
        });
        commands.startJoinRotation({
            notificationId: 'note-5',
            exnSaid: 'Eexn-join',
            groupAlias: 'team',
            localMemberName: 'alice',
        });

        expect(startedOptions[0]).toMatchObject({
            label: 'Creating multisig group team',
            title: 'Create multisig group team',
            kind: 'createMultisigGroup',
            resourceKeys: ['multisig:group:team', 'identifier:aid:Ealice'],
            resultRoute: { label: 'View multisig', path: '/multisig' },
            successNotification: {
                title: 'Multisig inception complete',
                message:
                    'team exists. Authorize group agents before using agent OOBIs.',
                severity: 'success',
            },
            failureNotification: {
                title: 'Multisig inception failed',
                message: 'team could not be created.',
                severity: 'error',
            },
        });
        expect(startedOptions[1]).toMatchObject({
            label: 'Authorizing agents for team',
            title: 'Authorize multisig agents',
            kind: 'authorizeMultisigAgent',
            resourceKeys: ['multisig:group:team:agents'],
        });
        expect(startedOptions[2]).toMatchObject({
            label: 'Interacting with multisig group team',
            title: 'Create multisig interaction',
            kind: 'interactMultisigGroup',
            resourceKeys: ['multisig:group:team:event'],
        });
        expect(startedOptions[3]).toMatchObject({
            label: 'Rotating multisig group team',
            title: 'Rotate multisig group',
            kind: 'rotateMultisigGroup',
            resourceKeys: ['multisig:group:team:event'],
        });
        expect(startedOptions[4]).toMatchObject({
            label: 'Joining multisig group team',
            title: 'Join multisig group',
            kind: 'acceptMultisigInception',
            resourceKeys: [
                'multisig:proposal:Eexn-inception',
                'multisig:group:team',
            ],
        });
        expect(startedOptions[5]).toMatchObject({
            label: 'Approving multisig role for team',
            title: 'Approve multisig endpoint role',
            kind: 'approveMultisigEndRole',
            resourceKeys: [
                'multisig:proposal:Eexn-role',
                'multisig:group:team:agents',
            ],
        });
        expect(startedOptions[6]).toMatchObject({
            label: 'Accepting multisig interaction team',
            title: 'Accept multisig interaction',
            kind: 'acceptMultisigInteraction',
            resourceKeys: [
                'multisig:proposal:Eexn',
                'multisig:group:team:event',
            ],
            resultRoute: { label: 'View multisig', path: '/multisig' },
        });
        expect(startedOptions[7]).toMatchObject({
            label: 'Accepting multisig rotation team',
            title: 'Accept multisig rotation',
            kind: 'acceptMultisigRotation',
            resourceKeys: [
                'multisig:proposal:Eexn-rotation',
                'multisig:group:team:event',
            ],
        });
        expect(startedOptions[8]).toMatchObject({
            label: 'Joining multisig group team',
            title: 'Join multisig rotation',
            kind: 'joinMultisigRotation',
            resourceKeys: [
                'multisig:proposal:Eexn-join',
                'multisig:group:team:join',
            ],
        });
    });
});
