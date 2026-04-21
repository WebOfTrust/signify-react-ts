import { Algos } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import { randomSignifyPasscode } from '../../src/signify/client';
import {
  createIdentifier,
  createRole,
  uniqueAlias,
} from '../support/keria';

describe.sequential('controller rotation', () => {
  it.skip(
    'rotates the controller once SignifyClient.rotate is fixed upstream',
    async () => {
      /*
       * Keep this body close to the skipped test. Re-enable by changing
       * `it.skip` to `it` after upstream SignifyClient.rotate /
       * SignifyController.rotate stops returning server errors.
       */
      const role = await createRole('rotation');
      const randyAlias = uniqueAlias('rotation-randy');
      const saltyAlias = uniqueAlias('rotation-salty');
      const randyAid = await createIdentifier(role, randyAlias, {
        algo: Algos.randy,
      });
      const saltyAid = await createIdentifier(role, saltyAlias);
      const managedAids = [
        await role.client.identifiers().get(randyAlias),
        await role.client.identifiers().get(saltyAlias),
      ];
      const response = await role.client.rotate(
        await randomSignifyPasscode(),
        managedAids as unknown as string[]
      );

      expect(response.ok).toBe(true);
      const rereadRandy = await role.client.identifiers().get(randyAlias);
      const rereadSalty = await role.client.identifiers().get(saltyAlias);
      expect(rereadRandy.prefix).toBe(randyAid.prefix);
      expect(rereadSalty.prefix).toBe(saltyAid.prefix);
    },
    180_000
  );
});
