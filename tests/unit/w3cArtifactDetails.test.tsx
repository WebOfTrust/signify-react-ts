import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { W3CJwtArtifactDetails } from '../../src/app/W3CArtifactDetails';

const jwt = (payload: Record<string, unknown>): string => {
    const encode = (value: Record<string, unknown>) =>
        Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
    return `${encode({ alg: 'EdDSA', kid: 'kid-1', typ: 'JWT' })}.${encode(
        payload
    )}.signature`;
};

describe('W3C artifact details', () => {
    it('renders decoded VP-JWT sections and nested VC-JWT access', () => {
        const vcJwt = jwt({
            iss: 'did:webs:issuer',
            sub: 'did:webs:holder',
            jti: 'urn:said:Ecredential',
            vc: { type: ['VerifiableCredential', 'VRDCredential'] },
        });
        const vpJwt = jwt({
            iss: 'did:webs:holder',
            jti: 'urn:uuid:presentation',
            aud: 'https://verifier.example/verify/vp',
            nonce: 'nonce-1',
            vp: {
                type: ['VerifiablePresentation'],
                verifiableCredential: [vcJwt],
            },
        });

        const html = renderToStaticMarkup(
            <W3CJwtArtifactDetails label="VP-JWT" token={vpJwt} />
        );

        expect(html).toContain('VP-JWT');
        expect(html).toContain('JOSE header');
        expect(html).toContain('JWT payload');
        expect(html).toContain('Raw compact token');
        expect(html).toContain('Signature segment');
        expect(html).toContain('Nested VC-JWTs (1)');
        expect(html).toContain('aria-expanded="false"');
    });

    it('renders invalid JWT fallback with raw token access', () => {
        const html = renderToStaticMarkup(
            <W3CJwtArtifactDetails label="Bad JWT" token="not-a-jwt" />
        );

        expect(html).toContain('JWT must contain exactly three segments');
        expect(html).toContain('Raw compact token');
        expect(html).toContain('not-a-jwt');
    });
});
