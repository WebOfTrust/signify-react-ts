import { Serder } from 'signify-ts';
import { waitForOperation } from '../../src/signify/client';
import {
  addAgentEndRole,
  createScenarioClient,
  createWitnessedIdentifier,
  resolveOobi,
  skipScenario,
  uniqueAlias,
  waitForEventResult,
  waitForScenarioOperation,
} from './helpers';
import type { ScenarioDefinition } from './types';

/*
 * Optional scenarios are valuable coverage but not default CI gates yet. Each
 * one must skip with a useful message when its schema service or external
 * fixture data is missing.
 */

const requiredConfig = (
  value: string | undefined,
  message: string
): string => {
  if (!value) {
    skipScenario(message);
  }
  return value as string;
};

const requiredValue = <T,>(value: T | undefined, message: string): T => {
  if (value === undefined) {
    throw new Error(message);
  }
  return value;
};

export const credentialsScenario: ScenarioDefinition = {
  id: 'credential-issue-grant-revoke',
  title: 'Credential Issue/Grant/Revoke',
  description:
    'Runs the legacy issuer/recipient/verifier credential flow when schema OOBI config is present.',
  requirements: ['keria', 'witnesses', 'schema'],
  ci: false,
  run: async (context) => {
    const configuredSchemaSaid = requiredConfig(
      context.config.scenarios.schemaSaid,
      'Set VITE_CREDENTIAL_SCHEMA_SAID and VITE_CREDENTIAL_SCHEMA_OOBI_URL to run this scenario.'
    );
    const configuredSchemaOobiUrl = requiredConfig(
      context.config.scenarios.schemaOobiUrl,
      'Set VITE_CREDENTIAL_SCHEMA_SAID and VITE_CREDENTIAL_SCHEMA_OOBI_URL to run this scenario.'
    );

    const issuer = await createScenarioClient(context, 'issuer');
    const recipient = await createScenarioClient(context, 'recipient');
    const verifier = await createScenarioClient(context, 'verifier');
    const issuerAlias = uniqueAlias('issuer');
    const recipientAlias = uniqueAlias('recipient');
    const verifierAlias = uniqueAlias('verifier');
    await createWitnessedIdentifier(context, issuer, issuerAlias);
    const recipientAid = await createWitnessedIdentifier(
      context,
      recipient,
      recipientAlias
    );
    const verifierAid = await createWitnessedIdentifier(
      context,
      verifier,
      verifierAlias
    );

    const issuerOobi = await addAgentEndRole(context, issuer, issuerAlias);
    const recipientOobi = await addAgentEndRole(
      context,
      recipient,
      recipientAlias
    );
    const verifierOobi = await addAgentEndRole(context, verifier, verifierAlias);
    await resolveOobi(context, issuer, recipientOobi, recipientAlias);
    await resolveOobi(context, issuer, verifierOobi, verifierAlias);
    await resolveOobi(context, recipient, issuerOobi, issuerAlias);
    await resolveOobi(context, recipient, verifierOobi, verifierAlias);
    await resolveOobi(context, verifier, recipientOobi, recipientAlias);
    await resolveOobi(context, issuer, configuredSchemaOobiUrl, 'schema');
    await resolveOobi(context, recipient, configuredSchemaOobiUrl, 'schema');
    await resolveOobi(context, verifier, configuredSchemaOobiUrl, 'schema');

    const issuerClient = issuer.connected.client;
    const registryResult = await issuerClient.registries().create({
      name: issuerAlias,
      registryName: uniqueAlias('registry'),
      nonce: uniqueAlias('nonce'),
    });
    await waitForScenarioOperation(
      context,
      issuerClient,
      await registryResult.op(),
      'issuer creates credential registry'
    );
    const registries = await issuerClient.registries().list(issuerAlias);
    const registry = registries[0];
    const registryKey = requiredValue(
      registry?.regk,
      'Registry list did not return registry key'
    );
    await issuerClient.schemas().get(configuredSchemaSaid);

    const issued = await issuerClient.credentials().issue(issuerAlias, {
      ri: registryKey,
      s: configuredSchemaSaid,
      a: {
        i: recipientAid.prefix,
        LEI: '5493001KJTIIGC8Y1R17',
      },
    });
    await waitForScenarioOperation(
      context,
      issuerClient,
      issued.op,
      'issuer issues credential'
    );
    const credentials = await issuerClient.credentials().list();
    const issuedCredential = requiredValue(
      credentials[0],
      'Issued credential was not returned by credential list'
    );
    const credentialSaid = requiredValue(
      issuedCredential.sad?.d,
      'Issued credential did not include a SAID'
    );
    const credential = await issuerClient.credentials().get(credentialSaid);
    const [grant, signatures, attachment] = await issuerClient.ipex().grant({
      senderName: issuerAlias,
      recipient: verifierAid.prefix,
      acdc: new Serder(credential.sad),
      anc: new Serder(credential.anc),
      iss: new Serder(credential.iss),
      ancAttachment: credential.ancatc,
    });
    const grantOperation = await issuerClient
      .ipex()
      .submitGrant(issuerAlias, grant, signatures, attachment, [
        verifierAid.prefix,
      ]);
    await waitForOperation(issuerClient, grantOperation, {
      label: 'issuer submits credential grant',
      signal: context.signal,
      ...context.config.operations,
    });

    const revoked = await issuerClient
      .credentials()
      .revoke(issuerAlias, credentialSaid);
    await waitForScenarioOperation(
      context,
      issuerClient,
      revoked.op,
      'issuer revokes credential'
    );

    return {
      summary: 'Credential issued, granted, and revoked',
      details: {
        recipientPrefix: recipientAid.prefix,
        verifierPrefix: verifierAid.prefix,
        credentialSaid,
      },
    };
  },
};

export const delegationScenario: ScenarioDefinition = {
  id: 'delegation-fixture',
  title: 'Delegation Fixture',
  description:
    'Creates a delegated AID when a delegator OOBI fixture is configured.',
  requirements: ['keria', 'external-fixture'],
  ci: false,
  run: async (context) => {
    const configuredDelegatorPre = requiredConfig(
      context.config.scenarios.delegatorPre,
      'Set VITE_DELEGATOR_PRE and VITE_DELEGATOR_OOBI to run this scenario.'
    );
    const configuredDelegatorOobi = requiredConfig(
      context.config.scenarios.delegatorOobi,
      'Set VITE_DELEGATOR_PRE and VITE_DELEGATOR_OOBI to run this scenario.'
    );

    const role = await createScenarioClient(context, 'delegate');
    await resolveOobi(context, role, configuredDelegatorOobi, 'delegator');
    const alias = uniqueAlias('delegated');
    const result = await role.connected.client
      .identifiers()
      .create(alias, { delpre: configuredDelegatorPre });
    const completed = await waitForEventResult(
      context,
      role.connected.client,
      result,
      `delegate creates ${alias}`
    );
    const serder = new Serder(completed.response as Record<string, unknown>);
    const aid = await role.connected.client.identifiers().get(alias);
    if (serder.pre !== aid.prefix) {
      throw new Error('Delegated prefix mismatch');
    }

    return {
      summary: `Created delegated AID ${alias}`,
      details: {
        prefix: aid.prefix,
        delegatorPre: configuredDelegatorPre,
      },
    };
  },
};

export const multisigScenario: ScenarioDefinition = {
  id: 'multisig-fixture',
  title: 'Multisig Fixture',
  description:
    'Resolves configured multisig member OOBIs and proves the fixture state is reachable.',
  requirements: ['keria', 'external-fixture'],
  ci: false,
  run: async (context) => {
    const memberOobis = context.config.scenarios.multisigMemberOobis;
    if (memberOobis.length < 2) {
      skipScenario(
        'Set VITE_MULTISIG_MEMBER_OOBIS to at least two OOBIs to run this scenario.'
      );
    }

    const role = await createScenarioClient(context, 'multisig');
    const localAlias = uniqueAlias('multisig-local');
    const localAid = await createWitnessedIdentifier(context, role, localAlias);

    for (const [index, oobi] of memberOobis.entries()) {
      await resolveOobi(context, role, oobi, `multisig-member-${index + 1}`);
    }

    const states = await role.connected.client.keyStates().get(localAid.prefix);
    if (states.length === 0) {
      throw new Error('Local multisig participant state missing');
    }

    return {
      summary: 'Resolved multisig fixture OOBIs',
      details: {
        localPrefix: localAid.prefix,
        memberCount: memberOobis.length,
      },
    };
  },
};

export const optionalScenarios: ScenarioDefinition[] = [
  credentialsScenario,
  delegationScenario,
  multisigScenario,
];
