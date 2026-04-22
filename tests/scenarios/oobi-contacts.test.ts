import type { Contact } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import {
    addAgentEndRole,
    createRole,
    createWitnessedIdentifier,
    resolveOobi,
    uniqueAlias,
    type IdentifierSummary,
    type Role,
} from '../support/keria';

interface ScenarioAgent {
    role: Role;
    alias: string;
    aid: IdentifierSummary;
    oobi: string;
}

const contactForAid = (
    contacts: Contact[],
    aid: IdentifierSummary
): Contact | null =>
    contacts.find((contact) => contact.id === aid.prefix) ?? null;

const agentEndpointCount = (contact: Contact): number =>
    Object.keys(contact.ends?.agent ?? {}).length;

describe.sequential('OOBI contact resolution', () => {
    it(
        'pairwise resolves witnessed identifier agent OOBIs across three agents',
        async () => {
            const agents: ScenarioAgent[] = [];

            for (const name of ['alpha', 'bravo', 'charlie']) {
                const role = await createRole(`oobi-${name}`);
                const alias = uniqueAlias(`oobi-${name}`);
                const aid = await createWitnessedIdentifier(role, alias);
                const oobi = await addAgentEndRole(role, alias);
                agents.push({ role, alias, aid, oobi });
            }

            for (const local of agents) {
                for (const remote of agents) {
                    if (local === remote) {
                        continue;
                    }

                    await resolveOobi(
                        local.role,
                        remote.oobi,
                        remote.alias
                    );
                }
            }

            for (const local of agents) {
                const contacts: Contact[] = await local.role.client
                    .contacts()
                    .list();
                const expectedRemotes = agents.filter(
                    (remote) => remote !== local
                );

                for (const remote of expectedRemotes) {
                    const contact = contactForAid(contacts, remote.aid);
                    if (contact === null) {
                        throw new Error(
                            `${local.alias} did not resolve ${remote.alias}`
                        );
                    }

                    expect(contact.alias).toBe(remote.alias);
                    expect(agentEndpointCount(contact)).toBeGreaterThan(0);
                }
            }
        },
        240_000
    );
});
