import { Diger, MtrDex, Serder } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import {
  createRandyIdentifier,
  createRole,
  serderFromOperation,
  uniqueAlias,
} from '../support/keria';

/*
 * Randy identifier scenario.
 *
 * This verifies random-key inception, interaction, rotation, and the structural
 * next-key relationship exposed by Signify/KERI event material.
 */
describe.sequential('randy identifiers', () => {
  it(
    'creates a randy identifier, interacts, rotates, and changes key material',
    async () => {
      const role = await createRole('randy');
      const alias = uniqueAlias('randy-aid');
      const aid = await createRandyIdentifier(role, alias);
      const inceptionLog = await role.client.keyEvents().get(aid.prefix);
      const inception = new Serder(inceptionLog[0].ked);

      const interaction = await role.client
        .identifiers()
        .interact(alias, [aid.prefix]);
      const completedInteraction = await role.waitEvent(
        interaction,
        `interacts ${alias}`
      );
      const interactionSerder = serderFromOperation(
        completedInteraction.response
      );

      const rotation = await role.client.identifiers().rotate(alias);
      const completedRotation = await role.waitEvent(
        rotation,
        `rotates ${alias}`
      );
      const rotationSerder = serderFromOperation(completedRotation.response);
      const log = await role.client.keyEvents().get(aid.prefix);
      const previousDigest = new Diger(
        { code: MtrDex.Blake3_256 },
        rotationSerder.verfers[0].qb64b
      );

      expect(interactionSerder.sad.s).toBe('1');
      expect(log.length).toBeGreaterThanOrEqual(3);
      expect(rotationSerder.sad.s).toBe('2');
      expect(rotationSerder.verfers[0].qb64).not.toBe(inception.verfers[0].qb64);
      expect(previousDigest.qb64).toBe(inception.digers[0].qb64);
    },
    180_000
  );
});
