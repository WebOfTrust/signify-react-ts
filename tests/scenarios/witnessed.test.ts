import { Serder } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import { appConfig } from '../../src/config';
import {
  createRole,
  createWitnessedIdentifier,
  uniqueAlias,
} from '../support/keria';

describe.sequential('witnessed identifier', () => {
  it(
    'creates a witnessed AID using the configured demo witnesses',
    async () => {
      const role = await createRole('witnessed');
      const alias = uniqueAlias('witnessed-aid');

      const aid = await createWitnessedIdentifier(role, alias);
      const log = await role.client.keyEvents().get(aid.prefix);
      const inception = new Serder(log[0].ked);

      expect(inception.sad.b).toHaveLength(appConfig.witnesses.aids.length);
      expect(inception.sad.bt).toBe(String(appConfig.witnesses.toad));
      expect(aid.windexes === undefined || aid.windexes.length > 0).toBe(true);
    },
    180_000
  );
});
