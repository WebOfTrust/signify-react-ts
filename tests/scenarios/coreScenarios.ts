import { Algos, Diger, MtrDex, Serder } from 'signify-ts';
import { randomSignifyPasscode } from '../../src/signify/client';
import {
  addAgentEndRole,
  assertScenario,
  createIdentifier,
  createRandyIdentifier,
  createScenarioClient,
  createWitnessedIdentifier,
  listIdentifiers,
  resolveOobi,
  serderFromOperation,
  skipScenario,
  uniqueAlias,
  waitForChallenge,
  waitForEventResult,
} from './helpers';
import type { ScenarioDefinition } from './types';
import type { ScenarioContext, ScenarioOutcome } from './types';

/*
 * CI-safe scenarios. These may assume local KERIA and the demo witness set, but
 * must not require the schema server, Sally/verifier services, or pre-existing
 * fixture AIDs.
 */

export const saltyScenario: ScenarioDefinition = {
  id: 'salty-identifiers',
  title: 'Salty Identifiers',
  description:
    'Creates salty identifiers, rotates and interacts with one, then verifies event log growth.',
  requirements: ['keria'],
  ci: true,
  run: async (context) => {
    const role = await createScenarioClient(context, 'salty');
    const client = role.connected.client;
    const aliasOne = uniqueAlias('salty-aid');
    const aliasTwo = uniqueAlias('salty-multi');
    const aidOne = await createIdentifier(context, role, aliasOne);
    const aidTwo = await createIdentifier(context, role, aliasTwo, {
      count: 3,
      ncount: 3,
      isith: '2',
      nsith: '2',
    });

    const listed = await listIdentifiers(client);
    assertScenario(
      listed.some((aid) => aid.name === aliasOne) &&
        listed.some((aid) => aid.name === aliasTwo),
      'Created salty identifiers were not listed'
    );

    const rotation = await client.identifiers().rotate(aliasOne);
    const completedRotation = await waitForEventResult(
      context,
      client,
      rotation,
      `rotate ${aliasOne}`
    );
    const rotationSerder = serderFromOperation(completedRotation.response);

    const interaction = await client.identifiers().interact(aliasOne, [
      aidOne.prefix,
    ]);
    const completedInteraction = await waitForEventResult(
      context,
      client,
      interaction,
      `interact ${aliasOne}`
    );
    const interactionSerder = serderFromOperation(
      completedInteraction.response
    );
    const currentAid = await client.identifiers().get(aliasOne);
    const log = await client.keyEvents().get(currentAid.prefix);

    assertScenario(log.length >= 3, 'Salty event log did not include 3 events');
    assertScenario(
      currentAid.state?.d === interactionSerder.sad.d,
      'Salty identifier state did not advance to the interaction event'
    );

    return {
      summary: `Created ${aliasOne} and ${aliasTwo}`,
      details: {
        firstPrefix: aidOne.prefix,
        secondPrefix: aidTwo.prefix,
        rotation: rotationSerder.sad.d,
        interaction: interactionSerder.sad.d,
        eventCount: log.length,
      },
    };
  },
};

export const randyScenario: ScenarioDefinition = {
  id: 'randy-identifiers',
  title: 'Randy Identifiers',
  description:
    'Creates a randy identifier, interacts, rotates, and checks random key material changed.',
  requirements: ['keria'],
  ci: true,
  run: async (context) => {
    const role = await createScenarioClient(context, 'randy');
    const client = role.connected.client;
    const alias = uniqueAlias('randy-aid');
    const aid = await createRandyIdentifier(context, role, alias);
    const inceptionLog = await client.keyEvents().get(aid.prefix);
    const inception = new Serder(inceptionLog[0].ked);

    const interaction = await client.identifiers().interact(alias, [aid.prefix]);
    const completedInteraction = await waitForEventResult(
      context,
      client,
      interaction,
      `interact ${alias}`
    );
    const interactionSerder = serderFromOperation(
      completedInteraction.response
    );
    assertScenario(
      interactionSerder.sad.s === '1',
      'Randy interaction did not advance sequence number'
    );

    const rotation = await client.identifiers().rotate(alias);
    const completedRotation = await waitForEventResult(
      context,
      client,
      rotation,
      `rotate ${alias}`
    );
    const rotationSerder = serderFromOperation(completedRotation.response);
    const log = await client.keyEvents().get(aid.prefix);
    const previousDigest = new Diger(
      { code: MtrDex.Blake3_256 },
      rotationSerder.verfers[0].qb64b
    );

    assertScenario(log.length >= 3, 'Randy event log did not include 3 events');
    assertScenario(
      rotationSerder.sad.s === '2',
      'Randy rotation did not advance sequence number'
    );
    assertScenario(
      rotationSerder.verfers[0].qb64 !== inception.verfers[0].qb64,
      'Randy rotation did not change current signing key'
    );
    assertScenario(
      previousDigest.qb64 === inception.digers[0].qb64,
      'Randy rotation did not expose the prior next-key digest'
    );

    return {
      summary: `Created and rotated ${alias}`,
      details: {
        prefix: aid.prefix,
        eventCount: log.length,
      },
    };
  },
};

export const witnessesScenario: ScenarioDefinition = {
  id: 'witnessed-identifier',
  title: 'Witnessed Identifier',
  description: 'Creates a fresh witnessed identifier using configured witnesses.',
  requirements: ['keria', 'witnesses'],
  ci: true,
  run: async (context) => {
    const role = await createScenarioClient(context, 'witnessed');
    const alias = uniqueAlias('witnessed-aid');
    const aid = await createWitnessedIdentifier(context, role, alias);
    const log = await role.connected.client.keyEvents().get(aid.prefix);
    const inception = new Serder(log[0].ked);

    assertScenario(
      Array.isArray(inception.sad.b) &&
        inception.sad.b.length === context.config.witnesses.aids.length,
      'Witnessed inception did not include configured witnesses'
    );
    assertScenario(
      inception.sad.bt === String(context.config.witnesses.toad),
      'Witnessed inception did not use configured toad'
    );
    assertScenario(
      aid.windexes === undefined || aid.windexes.length > 0,
      'Witnessed identifier returned an empty witness index list'
    );

    return {
      summary: `Created witnessed identifier ${alias}`,
      details: {
        prefix: aid.prefix,
        witnessCount: context.config.witnesses.aids.length,
        toad: context.config.witnesses.toad,
      },
    };
  },
};

export const runControllerRotationScenario = async (
  context: ScenarioContext
): Promise<ScenarioOutcome> => {
  /*
   * Keep this implementation ready for the upstream Signify fix. The catalog
   * entry below intentionally skips before calling it because
   * SignifyClient.rotate currently returns server errors for this flow.
   */
  const role = await createScenarioClient(context, 'rotation');
  const client = role.connected.client;
  const randyAlias = uniqueAlias('rotation-randy');
  const saltyAlias = uniqueAlias('rotation-salty');
  const randyAid = await createIdentifier(context, role, randyAlias, {
    algo: Algos.randy,
  });
  const saltyAid = await createIdentifier(context, role, saltyAlias);
  const managedAids = [
    await client.identifiers().get(randyAlias),
    await client.identifiers().get(saltyAlias),
  ];
  const response = await client.rotate(
    await randomSignifyPasscode(),
    managedAids as unknown as string[]
  );

  assertScenario(response.ok, `Controller rotation failed: ${response.status}`);
  const rereadRandy = await client.identifiers().get(randyAlias);
  const rereadSalty = await client.identifiers().get(saltyAlias);
  assertScenario(rereadRandy.prefix === randyAid.prefix, 'Randy AID changed');
  assertScenario(rereadSalty.prefix === saltyAid.prefix, 'Salty AID changed');
  context.step('controller rotated', String(response.status));

  return {
    summary: 'Controller rotated and identifiers remained readable',
    details: {
      randyPrefix: randyAid.prefix,
      saltyPrefix: saltyAid.prefix,
      status: response.status,
    },
  };
};

export const rotationScenario: ScenarioDefinition = {
  id: 'controller-rotation',
  title: 'Controller Rotation',
  description:
    'Skipped until SignifyClient.rotate is fixed upstream.',
  requirements: ['keria'],
  ci: false,
  run: async (context) => {
    context.step('controller rotation skipped', 'SignifyClient.rotate returns 500');
    return skipScenario(
      'SignifyClient.rotate is broken; controller rotation is skipped.'
    );
    // Re-enable with: return runControllerRotationScenario(context);
  },
};

export const challengesScenario: ScenarioDefinition = {
  id: 'challenge-response',
  title: 'Challenge Response',
  description:
    'Creates two witnessed roles, exchanges OOBIs, sends a challenge response, and marks it accepted.',
  requirements: ['keria', 'witnesses'],
  ci: true,
  run: async (context) => {
    const challenger = await createScenarioClient(context, 'challenger');
    const responder = await createScenarioClient(context, 'responder');
    const challengerAlias = uniqueAlias('challenge-alex');
    const responderAlias = uniqueAlias('challenge-rodo');
    const challengerAid = await createWitnessedIdentifier(
      context,
      challenger,
      challengerAlias
    );
    const responderAid = await createWitnessedIdentifier(
      context,
      responder,
      responderAlias
    );
    const challenge = await challenger.connected.client
      .challenges()
      .generate(128);

    const challengerOobi = await addAgentEndRole(
      context,
      challenger,
      challengerAlias
    );
    const responderOobi = await addAgentEndRole(
      context,
      responder,
      responderAlias
    );
    await resolveOobi(context, challenger, responderOobi, responderAlias);
    await resolveOobi(context, responder, challengerOobi, challengerAlias);

    await responder.connected.client
      .challenges()
      .respond(responderAlias, challengerAid.prefix, challenge.words);
    context.step('responder sends challenge response', responderAid.prefix);

    const received = await waitForChallenge(
      context,
      challenger.connected.client,
      responderAid.prefix,
      challenge.words
    );
    const response = await challenger.connected.client
      .challenges()
      .responded(responderAid.prefix, received.said);

    assertScenario(
      response.ok,
      `Challenge response acceptance failed: ${response.status}`
    );
    context.step('challenger marks response accepted', received.said);

    return {
      summary: 'Challenge response completed',
      details: {
        challengerPrefix: challengerAid.prefix,
        responderPrefix: responderAid.prefix,
        challengeSaid: received.said,
      },
    };
  },
};

export const coreScenarios: ScenarioDefinition[] = [
  saltyScenario,
  randyScenario,
  witnessesScenario,
  rotationScenario,
  challengesScenario,
];
