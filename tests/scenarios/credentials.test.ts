import { Serder, type SignifyClient } from 'signify-ts';
import { describe, expect, it } from 'vitest';
import { appConfig } from '../../src/config';
import {
    addAgentEndRole,
    createRole,
    createWitnessedIdentifier,
    resolveOobi,
    uniqueAlias,
} from '../support/keria';

interface ScenarioNotification {
    i: string;
    r: boolean;
    a: {
        r: string;
        d?: string;
    };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;

const notificationItems = (raw: unknown): ScenarioNotification[] => {
    const notes = isRecord(raw) && Array.isArray(raw.notes) ? raw.notes : [];
    return notes.flatMap((note) => {
        if (!isRecord(note) || !isRecord(note.a)) {
            return [];
        }

        const id = stringValue(note.i);
        const route = stringValue(note.a.r);
        if (id === null || route === null || typeof note.r !== 'boolean') {
            return [];
        }

        return [
            {
                i: id,
                r: note.r,
                a: {
                    r: route,
                    d: stringValue(note.a.d) ?? undefined,
                },
            },
        ];
    });
};

const requiredValue = <T>(value: T | null | undefined, message: string): T => {
    if (value === undefined || value === null) {
        throw new Error(message);
    }

    return value;
};

const waitForNotifications = async (
    client: SignifyClient,
    route: string
): Promise<ScenarioNotification[]> => {
    const timeoutAt = Date.now() + appConfig.operations.timeoutMs;
    while (Date.now() < timeoutAt) {
        const notes = notificationItems(await client.notifications().list());
        const matches = notes.filter((note) => note.a.r === route && !note.r);
        if (matches.length > 0) {
            return matches;
        }

        await new Promise((resolve) =>
            globalThis.setTimeout(resolve, appConfig.operations.minSleepMs)
        );
    }

    throw new Error(`Timed out waiting for ${route} notification.`);
};

const markAndRemoveNotification = async (
    client: SignifyClient,
    notification: ScenarioNotification
): Promise<void> => {
    try {
        await client.notifications().mark(notification.i);
    } finally {
        await client.notifications().delete(notification.i);
    }
};

describe.sequential('credential issuance and holder admit', () => {
    it('issues, grants, admits, and lists a SEDI voter credential', async () => {
        const schemaSaid = requiredValue(
            appConfig.schemas.sediVoterId.said,
            'SEDI voter schema SAID is required.'
        );
        const schemaOobiUrl = requiredValue(
            appConfig.schemas.sediVoterId.oobiUrl,
            'SEDI voter schema OOBI URL is required.'
        );
        const issuer = await createRole('issuer');
        const holder = await createRole('holder');
        const issuerAlias = uniqueAlias('issuer');
        const holderAlias = uniqueAlias('holder');
        const issuerAid = await createWitnessedIdentifier(issuer, issuerAlias);
        const holderAid = await createWitnessedIdentifier(holder, holderAlias);

        const issuerOobi = await addAgentEndRole(issuer, issuerAlias);
        const holderOobi = await addAgentEndRole(holder, holderAlias);
        await resolveOobi(issuer, holderOobi, holderAlias);
        await resolveOobi(holder, issuerOobi, issuerAlias);
        await resolveOobi(issuer, schemaOobiUrl, 'sedi-voter-schema');
        await resolveOobi(holder, schemaOobiUrl, 'sedi-voter-schema');

        const createRegistry = async (registryName: string): Promise<string> => {
            const registryResult = await issuer.client.registries().create({
                name: issuerAlias,
                registryName,
                nonce: uniqueAlias('nonce'),
            });
            await issuer.waitOperation(
                await registryResult.op(),
                `creates credential registry ${registryName}`
            );
            const registry = requiredValue(
                (await issuer.client.registries().list(issuerAlias)).find(
                    (candidate) => candidate.name === registryName
                ),
                `Registry list did not return ${registryName}.`
            );
            return requiredValue(
                registry.regk,
                'Registry list did not return registry key.'
            );
        };

        const unusedRegistryKey = await createRegistry(uniqueAlias('registry'));
        const registryKey = await createRegistry(uniqueAlias('registry'));
        await issuer.client.schemas().get(schemaSaid);

        const issued = await issuer.client.credentials().issue(issuerAlias, {
            ri: registryKey,
            s: schemaSaid,
            a: {
                i: holderAid.prefix,
                fullName: 'Ada Voter',
                voterId: 'SEDI-0001',
                precinctId: 'PCT-042',
                county: 'Demo County',
                jurisdiction: 'SEDI',
                electionId: 'SEDI-2026-DEMO',
                eligible: true,
                expires: '2026-12-31T23:59:59Z',
            },
        });
        await issuer.waitOperation(issued.op, 'issues SEDI credential');
        const credentialSaid = requiredValue(
            issued.acdc.sad.d,
            'Issued credential did not include a SAID.'
        );
        const credential = await issuer.client
            .credentials()
            .get(credentialSaid);
        expect(credential.sad.ri).toBe(registryKey);
        expect(credential.sad.ri).not.toBe(unusedRegistryKey);

        const [grant, signatures, attachment] = await issuer.client
            .ipex()
            .grant({
                senderName: issuerAlias,
                recipient: holderAid.prefix,
                acdc: new Serder(credential.sad),
                anc: new Serder(credential.anc),
                iss: new Serder(credential.iss),
                ancAttachment: credential.ancatc,
            });
        const grantOperation = await issuer.client
            .ipex()
            .submitGrant(issuerAlias, grant, signatures, attachment, [
                holderAid.prefix,
            ]);
        await issuer.waitOperation(grantOperation, 'submits credential grant');

        const holderNotifications = await waitForNotifications(
            holder.client,
            '/exn/ipex/grant'
        );
        const grantNotification = requiredValue(
            holderNotifications[0],
            'Holder did not receive credential grant notification.'
        );
        const grantSaid = requiredValue(
            grantNotification.a.d,
            'Grant notification did not include EXN SAID.'
        );
        const [admit, sigs, admitAttachment] = await holder.client
            .ipex()
            .admit({
                senderName: holderAlias,
                message: '',
                grantSaid,
                recipient: issuerAid.prefix,
                datetime: new Date().toISOString().replace('Z', '000+00:00'),
            });
        const admitOperation = await holder.client
            .ipex()
            .submitAdmit(holderAlias, admit, sigs, admitAttachment, [
                issuerAid.prefix,
            ]);
        await holder.waitOperation(admitOperation, 'admits credential grant');
        await markAndRemoveNotification(holder.client, grantNotification);

        const issuerNotifications = await waitForNotifications(
            issuer.client,
            '/exn/ipex/admit'
        );
        await markAndRemoveNotification(issuer.client, issuerNotifications[0]);

        const heldCredential = await holder.client
            .credentials()
            .get(credentialSaid);
        const heldCredentials = await holder.client.credentials().list({
            filter: {
                '-a-i': holderAid.prefix,
            },
        });
        const state = await holder.client
            .credentials()
            .state(registryKey, credentialSaid);

        expect(heldCredential.sad.s).toBe(schemaSaid);
        expect(heldCredential.sad.i).toBe(issuerAid.prefix);
        expect(heldCredential.sad.a.i).toBe(holderAid.prefix);
        expect(heldCredential.status.s).toBe('0');
        expect(heldCredentials.some((item) => item.sad.d === credentialSaid))
            .toBe(true);
        expect(state.i).toBe(credentialSaid);
        expect(state.ri).toBe(registryKey);
        expect(state.et).toBe('iss');
    }, 180_000);
});
