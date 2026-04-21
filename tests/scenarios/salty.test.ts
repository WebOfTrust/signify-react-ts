import { describe, expect, it } from 'vitest';
import {
  createIdentifier,
  createRole,
  listIdentifiers,
  serderFromOperation,
  uniqueAlias,
} from '../support/keria';

describe.sequential('salty identifiers', () => {
  it(
    'creates salty identifiers, rotates one, and records an interaction',
    async () => {
      const role = await createRole('salty');
      const aliasOne = uniqueAlias('salty-aid');
      const aliasTwo = uniqueAlias('salty-multi');
      const aidOne = await createIdentifier(role, aliasOne);
      const aidTwo = await createIdentifier(role, aliasTwo, {
        count: 3,
        ncount: 3,
        isith: '2',
        nsith: '2',
      });

      const listed = await listIdentifiers(role.client);
      expect(
        listed.some((aid) => aid.name === aliasOne),
        'first salty identifier should be listed'
      ).toBe(true);
      expect(
        listed.some((aid) => aid.name === aliasTwo),
        'second salty identifier should be listed'
      ).toBe(true);

      const rotation = await role.client.identifiers().rotate(aliasOne);
      const completedRotation = await role.waitEvent(
        rotation,
        `rotates ${aliasOne}`
      );
      const rotationSerder = serderFromOperation(completedRotation.response);

      const interaction = await role.client
        .identifiers()
        .interact(aliasOne, [aidOne.prefix]);
      const completedInteraction = await role.waitEvent(
        interaction,
        `interacts ${aliasOne}`
      );
      const interactionSerder = serderFromOperation(
        completedInteraction.response
      );
      const currentAid = await role.client.identifiers().get(aliasOne);
      const log = await role.client.keyEvents().get(currentAid.prefix);

      expect(aidTwo.prefix, 'multisig salty AID should return a prefix').toBeTruthy();
      expect(log.length, 'salty event log should include inception, rotation, and interaction').toBeGreaterThanOrEqual(3);
      expect(rotationSerder.sad.s, 'rotation should be event sequence 1').toBe('1');
      expect(currentAid.state?.d).toBe(interactionSerder.sad.d);
    },
    180_000
  );
});
