import { describe, expect, it } from 'vitest';
import {
  createRole,
  createWitnessedIdentifier,
  envList,
  resolveOobi,
  uniqueAlias,
} from '../../support/keria';

const memberOobis = envList('VITE_MULTISIG_MEMBER_OOBIS');

describe.sequential('multisig fixture', () => {
  it.skipIf(memberOobis.length < 2)(
    'resolves configured multisig member OOBIs and proves local state is reachable',
    async () => {
      const role = await createRole('multisig');
      const localAlias = uniqueAlias('multisig-local');
      const localAid = await createWitnessedIdentifier(role, localAlias);

      for (const [index, oobi] of memberOobis.entries()) {
        await resolveOobi(role, oobi, `multisig-member-${index + 1}`);
      }

      const states = await role.client.keyStates().get(localAid.prefix);
      expect(states.length).toBeGreaterThan(0);
      expect(memberOobis.length).toBeGreaterThanOrEqual(2);
    },
    180_000
  );
});
