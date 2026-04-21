import { Serder } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import {
  createRole,
  env,
  requiredEnv,
  resolveOobi,
  uniqueAlias,
} from '../../support/keria';

const hasDelegationConfig =
  Boolean(env.VITE_DELEGATOR_PRE) && Boolean(env.VITE_DELEGATOR_OOBI);

describe.sequential('delegation fixture', () => {
  it.skipIf(!hasDelegationConfig)(
    'creates a delegated AID when a delegator fixture is configured',
    async () => {
      const delegatorPre = requiredEnv('VITE_DELEGATOR_PRE');
      const delegatorOobi = requiredEnv('VITE_DELEGATOR_OOBI');
      const role = await createRole('delegate');
      await resolveOobi(role, delegatorOobi, 'delegator');

      const alias = uniqueAlias('delegated');
      const result = await role.client
        .identifiers()
        .create(alias, { delpre: delegatorPre });
      const completed = await role.waitEvent(result, `creates ${alias}`);
      const serder = new Serder(completed.response as Record<string, unknown>);
      const aid = await role.client.identifiers().get(alias);

      expect(serder.pre).toBe(aid.prefix);
      expect(delegatorPre).toBeTruthy();
    },
    180_000
  );
});
