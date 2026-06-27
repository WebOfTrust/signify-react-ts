import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { HeldCredentialsPanel } from '../../src/features/credentials/CredentialWalletPanels';
import { CredentialW3CIssuanceControls } from '../../src/features/credentials/CredentialW3CIssuanceControls';
import { W3CPresentCtrls } from '../../src/features/credentials/W3CPresentCtrls';
import { IssuedCredentialsForTypePanel } from '../../src/features/credentials/CredentialIssuerTypePanels';
import { appConfig } from '../../src/config';
import {
    selectCredentialW3CIssuer,
    selectW3CPresenter,
    W3C_PRESENTABLE_VRD_SCHEMA_SAID,
} from '../../src/domain/credentials/credentialPresentation';
import type {
    CredentialSummaryRecord,
    SchemaRecord,
} from '../../src/domain/credentials/credentialTypes';

const credential = {
    said: 'Ecredential',
    schemaSaid: 'Eschema',
    registryId: 'Eregistry',
    issuerAid: 'Eissuer',
    holderAid: 'Eholder',
    direction: 'held',
    status: 'admitted',
    grantSaid: null,
    admitSaid: null,
    notificationId: null,
    issuedAt: '2026-04-22T00:00:00.000Z',
    grantedAt: null,
    admittedAt: null,
    revokedAt: null,
    error: null,
    attributes: null,
    updatedAt: '2026-04-22T00:00:00.000Z',
} satisfies CredentialSummaryRecord;

const schema = {
    said: 'Eschema',
    oobi: null,
    status: 'resolved',
    title: 'Verifiable Reference Data (VRD) Credential',
    description: null,
    credentialType: 'VRDCredential',
    version: null,
    error: null,
    updatedAt: null,
} satisfies SchemaRecord;

describe('wallet credential panels', () => {
    it('selects the correct local W3C issuer and presenter roles', () => {
        const identifiers = [
            { name: 'issuer', prefix: 'Eissuer' },
            { name: 'holder', prefix: 'Eholder' },
        ];

        expect(selectCredentialW3CIssuer(credential, identifiers)?.prefix).toBe(
            'Eissuer'
        );
        expect(
            selectW3CPresenter(credential, identifiers)?.prefix
        ).toBe('Eholder');
        expect(
            selectW3CPresenter(
                { ...credential, direction: 'issued' },
                identifiers
            )
        ).toBeNull();
    });

    it('renders held credential rows as inline workflow cards without detail navigation', () => {
        const markup = renderToStaticMarkup(
            <HeldCredentialsPanel
                credentials={[credential]}
                credentialTypesBySchema={new Map()}
                schemasBySaid={new Map([['Eschema', schema]])}
                identifiers={[{ name: 'issuer', prefix: 'Eissuer' }]}
                didWebsReadyByAid={new Map([['Eissuer', false]])}
                verifiers={[]}
                selectedVerifierId=""
                actionRunning={false}
                onVerifierChange={vi.fn()}
                onPresent={vi.fn()}
            />
        );

        expect(markup).not.toContain('role="button"');
        expect(markup).toContain('Verifiable Reference Data (VRD) Credential');
        expect(markup).toContain('Present');
        expect(markup).toContain('Ecredential');
        expect(markup).not.toContain('Schema SAID');
        expect(markup).not.toContain('Issuer');
        expect(markup).not.toContain('Holder');
    });

    it('renders the shared verifier selector and explicit W3C Present blockers', () => {
        const markup = renderToStaticMarkup(
            <W3CPresentCtrls
                credential={{
                    ...credential,
                    schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                }}
                identifiers={[]}
                didWebsReadyByAid={new Map()}
                verifiers={appConfig.w3cVerifiers}
                selectedVerifierId="isomer-python"
                actionRunning={false}
                onVerifierChange={vi.fn()}
                onPresent={vi.fn()}
            />
        );

        expect(markup).toContain('Verifier request');
        expect(markup).toContain('Isomer Python');
        expect(markup).toContain('http://127.0.0.1:8788/verify/vp');
        expect(markup).toContain('Present');
        expect(markup).toContain(
            'This wallet does not control the credential holder AID required for W3C Present.'
        );
    });

    it('uses a local holder as the presenter for held VRD credentials', () => {
        const markup = renderToStaticMarkup(
            <W3CPresentCtrls
                credential={{
                    ...credential,
                    schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                }}
                identifiers={[{ name: 'holder', prefix: 'Eholder' }]}
                didWebsReadyByAid={new Map([['Eholder', true]])}
                verifiers={appConfig.w3cVerifiers}
                selectedVerifierId="isomer-python"
                actionRunning={false}
                onVerifierChange={vi.fn()}
                onPresent={vi.fn()}
            />
        );

        expect(markup).toContain(
            'Ready to create a KERIA W3C presentation transaction from this verifier request.'
        );
    });

    it('allows W3C presentation while presenter did:webs setup is pending', () => {
        const markup = renderToStaticMarkup(
            <W3CPresentCtrls
                credential={{
                    ...credential,
                    schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                }}
                identifiers={[{ name: 'holder', prefix: 'Eholder' }]}
                didWebsReadyByAid={new Map([['Eholder', false]])}
                verifiers={appConfig.w3cVerifiers}
                selectedVerifierId="isomer-python"
                actionRunning={false}
                onVerifierChange={vi.fn()}
                onPresent={vi.fn()}
            />
        );

        expect(markup).toContain('Present');
        expect(markup).toContain(
            'DID/webs setup will run before W3C presentation.'
        );
    });

    it('does not present issued VRD credentials through the issuer role', () => {
        const markup = renderToStaticMarkup(
            <W3CPresentCtrls
                credential={{
                    ...credential,
                    direction: 'issued',
                    status: 'issued',
                    schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                }}
                identifiers={[{ name: 'issuer', prefix: 'Eissuer' }]}
                didWebsReadyByAid={new Map([['Eissuer', true]])}
                verifiers={appConfig.w3cVerifiers}
                selectedVerifierId="isomer-python"
                actionRunning={false}
                onVerifierChange={vi.fn()}
                onPresent={vi.fn()}
            />
        );

        expect(markup).toContain(
            'This wallet does not control the credential holder AID required for W3C Present.'
        );
    });

    it('renders a ready issuer-side W3C issuance fallback for issued VRD credentials', () => {
        const markup = renderToStaticMarkup(
            <CredentialW3CIssuanceControls
                credential={{
                    ...credential,
                    direction: 'issued',
                    status: 'issued',
                    schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                }}
                identifiers={[{ name: 'issuer', prefix: 'Eissuer' }]}
                didWebsReadyByAid={new Map([['Eissuer', true]])}
                actionRunning={false}
                onStartIssuance={vi.fn()}
            />
        );

        expect(markup).toContain('Start W3C issuance');
        expect(markup).toContain(
            'Ready to start QVI-side W3C VC-JWT issuance from this native VRD.'
        );
    });

    it('allows W3C issuance while issuer did:webs setup is pending', () => {
        const markup = renderToStaticMarkup(
            <CredentialW3CIssuanceControls
                credential={{
                    ...credential,
                    direction: 'issued',
                    status: 'issued',
                    schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                }}
                identifiers={[{ name: 'issuer', prefix: 'Eissuer' }]}
                didWebsReadyByAid={new Map([['Eissuer', false]])}
                actionRunning={false}
                onStartIssuance={vi.fn()}
            />
        );

        expect(markup).toContain('Start W3C issuance');
        expect(markup).toContain(
            'DID/webs setup will run before QVI-side W3C VC-JWT issuance.'
        );
    });

    it('blocks W3C issuance fallback outside the local issuer role', () => {
        const markup = renderToStaticMarkup(
            <CredentialW3CIssuanceControls
                credential={{
                    ...credential,
                    schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                }}
                identifiers={[{ name: 'holder', prefix: 'Eholder' }]}
                didWebsReadyByAid={new Map([['Eholder', true]])}
                actionRunning={false}
                onStartIssuance={vi.fn()}
            />
        );

        expect(markup).toContain('Start W3C issuance');
        expect(markup).toContain(
            'Only issuer-side VRD credentials can start W3C issuance.'
        );
    });

    it('renders W3C issuance alongside issuer IPEX Grant controls', () => {
        const markup = renderToStaticMarkup(
            <IssuedCredentialsForTypePanel
                credentials={[
                    {
                        ...credential,
                        direction: 'issued',
                        status: 'issued',
                        schemaSaid: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                    },
                ]}
                actionRunning={false}
                credentialTypesBySchema={new Map()}
                schemasBySaid={
                    new Map([
                        [
                            W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                            {
                                ...schema,
                                said: W3C_PRESENTABLE_VRD_SCHEMA_SAID,
                            },
                        ],
                    ])
                }
                identifiers={[{ name: 'issuer', prefix: 'Eissuer' }]}
                didWebsReadyByAid={new Map([['Eissuer', true]])}
                onGrant={vi.fn()}
                onStartW3CIssuance={vi.fn()}
            />
        );

        expect(markup).toContain('Grant');
        expect(markup).toContain('Start W3C issuance');
        expect(markup).not.toContain('Present');
        expect(markup).not.toContain('Verifier request');
    });
});
