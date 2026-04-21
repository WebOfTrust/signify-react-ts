import { Serder } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import { testConfig } from '../../support/config';
import { createRole, resolveOobi, uniqueAlias } from '../../support/keria';

const delegationConfig = testConfig.fixtures.delegation;
const hasDelegationConfig =
    delegationConfig.delegatorPre !== null &&
    delegationConfig.delegatorOobi !== null;

const requireFixtureValue = (value: string | null, message: string): string => {
    if (value === null) {
        throw new Error(message);
    }

    return value;
};

describe.sequential('delegation fixture', () => {
    it.skipIf(!hasDelegationConfig)(
        'creates a delegated AID when a delegator fixture is configured',
        async () => {
            const delegatorPre = requireFixtureValue(
                delegationConfig.delegatorPre,
                'Set VITE_DELEGATOR_PRE to run this optional scenario.'
            );
            const delegatorOobi = requireFixtureValue(
                delegationConfig.delegatorOobi,
                'Set VITE_DELEGATOR_OOBI to run this optional scenario.'
            );
            const role = await createRole('delegate');
            await resolveOobi(role, delegatorOobi, 'delegator');

            const alias = uniqueAlias('delegated');
            const result = await role.client
                .identifiers()
                .create(alias, { delpre: delegatorPre });
            const completed = await role.waitEvent(result, `creates ${alias}`);
            const serder = new Serder(
                completed.response as Record<string, unknown>
            );
            const aid = await role.client.identifiers().get(alias);

            expect(serder.pre).toBe(aid.prefix);
            expect(delegatorPre).toBeTruthy();
        },
        180_000
    );
});
