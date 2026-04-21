import { Serder } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import { appConfig } from '../../../src/config';
import {
    addAgentEndRole,
    createRole,
    createWitnessedIdentifier,
    resolveOobi,
    uniqueAlias,
} from '../../support/keria';

/*
 * Optional credential scenario.
 *
 * This is excluded from default CI because it needs schema/OOBI configuration
 * beyond the local KERIA + witness stack.
 */
const schemaConfig = appConfig.schemas.sediVoterId;
const hasCredentialConfig =
    schemaConfig.said !== null && schemaConfig.oobiUrl !== null;

/**
 * Narrow nullable fixture values after `it.skipIf` has guarded the scenario.
 */
const requiredValue = <T>(value: T | null | undefined, message: string): T => {
    if (value === undefined || value === null) {
        throw new Error(message);
    }

    return value;
};

describe.sequential('credential issue/grant/revoke', () => {
    it.skipIf(!hasCredentialConfig)(
        'issues, grants, and revokes a credential when schema config is present',
        async () => {
            const schemaSaid = requiredValue(
                schemaConfig.said,
                'Set VITE_SEDI_VOTER_ID_SCHEMA_SAID to run this optional scenario.'
            );
            const schemaOobiUrl = requiredValue(
                schemaConfig.oobiUrl,
                'Set VITE_SEDI_VOTER_ID_SCHEMA_OOBI_URL to run this optional scenario.'
            );
            const issuer = await createRole('issuer');
            const recipient = await createRole('recipient');
            const verifier = await createRole('verifier');
            const issuerAlias = uniqueAlias('issuer');
            const recipientAlias = uniqueAlias('recipient');
            const verifierAlias = uniqueAlias('verifier');
            await createWitnessedIdentifier(issuer, issuerAlias);
            const recipientAid = await createWitnessedIdentifier(
                recipient,
                recipientAlias
            );
            const verifierAid = await createWitnessedIdentifier(
                verifier,
                verifierAlias
            );

            const issuerOobi = await addAgentEndRole(issuer, issuerAlias);
            const recipientOobi = await addAgentEndRole(
                recipient,
                recipientAlias
            );
            const verifierOobi = await addAgentEndRole(verifier, verifierAlias);
            await resolveOobi(issuer, recipientOobi, recipientAlias);
            await resolveOobi(issuer, verifierOobi, verifierAlias);
            await resolveOobi(recipient, issuerOobi, issuerAlias);
            await resolveOobi(recipient, verifierOobi, verifierAlias);
            await resolveOobi(verifier, recipientOobi, recipientAlias);
            await resolveOobi(issuer, schemaOobiUrl, 'schema');
            await resolveOobi(recipient, schemaOobiUrl, 'schema');
            await resolveOobi(verifier, schemaOobiUrl, 'schema');

            const registryResult = await issuer.client.registries().create({
                name: issuerAlias,
                registryName: uniqueAlias('registry'),
                nonce: uniqueAlias('nonce'),
            });
            await issuer.waitOperation(
                await registryResult.op(),
                'creates credential registry'
            );
            const registries = await issuer.client
                .registries()
                .list(issuerAlias);
            const registryKey = requiredValue(
                registries[0]?.regk,
                'Registry list did not return registry key'
            );
            await issuer.client.schemas().get(schemaSaid);

            const issued = await issuer.client
                .credentials()
                .issue(issuerAlias, {
                    ri: registryKey,
                    s: schemaSaid,
                    a: {
                        i: recipientAid.prefix,
                        LEI: '5493001KJTIIGC8Y1R17',
                    },
                });
            await issuer.waitOperation(issued.op, 'issues credential');
            const credentials = await issuer.client.credentials().list();
            const issuedCredential = requiredValue(
                credentials[0],
                'Issued credential was not returned by credential list'
            );
            const credentialSaid = requiredValue(
                issuedCredential.sad?.d,
                'Issued credential did not include a SAID'
            );
            const credential = await issuer.client
                .credentials()
                .get(credentialSaid);
            const [grant, signatures, attachment] = await issuer.client
                .ipex()
                .grant({
                    senderName: issuerAlias,
                    recipient: verifierAid.prefix,
                    acdc: new Serder(credential.sad),
                    anc: new Serder(credential.anc),
                    iss: new Serder(credential.iss),
                    ancAttachment: credential.ancatc,
                });
            const grantOperation = await issuer.client
                .ipex()
                .submitGrant(issuerAlias, grant, signatures, attachment, [
                    verifierAid.prefix,
                ]);
            await issuer.waitOperation(
                grantOperation,
                'submits credential grant'
            );

            const revoked = await issuer.client
                .credentials()
                .revoke(issuerAlias, credentialSaid);
            await issuer.waitOperation(revoked.op, 'revokes credential');

            expect(credentialSaid).toBeTruthy();
            expect(recipientAid.prefix).toBeTruthy();
            expect(verifierAid.prefix).toBeTruthy();
        },
        180_000
    );
});
