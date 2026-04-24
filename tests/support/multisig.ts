import type { HabState } from 'signify-ts';
import { expect } from 'vitest';
import { appConfig } from '../../src/config';
import type {
    MultisigCreateDraft,
    MultisigRequestActionInput,
} from '../../src/features/multisig/multisigTypes';
import {
    thresholdSpecForMembers,
    type MultisigThresholdSith,
    type MultisigThresholdSpec,
} from '../../src/features/multisig/multisigThresholds';
import {
    MULTISIG_ICP_ROUTE,
    MULTISIG_IXN_ROUTE,
    MULTISIG_ROT_ROUTE,
    MULTISIG_RPY_ROUTE,
    acceptMultisigEndRoleService,
    acceptMultisigInceptionService,
    acceptMultisigInteractionService,
    acceptMultisigRotationService,
    authorizeMultisigAgentsService,
    startMultisigInceptionService,
    startMultisigInteractionService,
    startMultisigRotationService,
} from '../../src/services/multisig.service';
import {
    addAgentEndRole,
    createRole,
    createWitnessedIdentifier,
    markAndRemoveNotification,
    refreshKeyState,
    resolveOobi,
    runServiceOperation,
    uniqueAlias,
    waitForNotification,
    waitForNotifications,
    type Role,
    type ScenarioNotification,
} from './keria';

export { uniqueAlias };

export interface MultisigScenarioGroup {
    groupAlias: string;
    roles: Role[];
    aliases: string[];
    aids: HabState[];
    memberAids: string[];
}

export const requiredValue = <T>(
    value: T | null | undefined,
    message: string
): T => {
    if (value === undefined || value === null) {
        throw new Error(message);
    }

    return value;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

export const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;

export const stringArray = (value: unknown): string[] =>
    Array.isArray(value)
        ? value.flatMap((item) => {
              const text = stringValue(item);
              return text === null ? [] : [text];
          })
        : [];

export const notificationSaid = (
    notification: ScenarioNotification
): string =>
    requiredValue(
        notification.a.d ?? notification.a.m,
        `${notification.a.r} notification did not include an exchange SAID.`
    );

const memberAid = (member: unknown): string | null => {
    if (!isRecord(member)) {
        return null;
    }

    return (
        stringValue(member.aid) ??
        stringValue(member.prefix) ??
        stringValue((member.state as Record<string, unknown> | undefined)?.i)
    );
};

export const groupMemberAids = async (
    role: Role,
    groupAlias: string,
    kind: 'signing' | 'rotation'
): Promise<string[]> => {
    const members = await role.client.identifiers().members(groupAlias);
    const entries =
        isRecord(members) && Array.isArray(members[kind]) ? members[kind] : [];

    return entries.flatMap((entry) => {
        const aid = memberAid(entry);
        return aid === null ? [] : [aid];
    });
};

export const groupState = (hab: HabState): Record<string, unknown> =>
    isRecord(hab.state) ? (hab.state as Record<string, unknown>) : {};

export const groupCheckpoint = async (
    role: Role,
    groupAlias: string
): Promise<{ prefix: string; sequence: string; digest: string }> => {
    const group = await role.client.identifiers().get(groupAlias);
    const state = groupState(group);

    return {
        prefix: group.prefix,
        sequence: requiredValue(
            stringValue(state.s),
            `${role.name} ${groupAlias} state is missing sequence.`
        ),
        digest: requiredValue(
            stringValue(state.d),
            `${role.name} ${groupAlias} state is missing digest.`
        ),
    };
};

export const expectGroupConvergence = async (
    roles: readonly Role[],
    groupAlias: string
): Promise<{ prefix: string; sequence: string; digest: string }> => {
    const checkpoints = await Promise.all(
        roles.map((role) => groupCheckpoint(role, groupAlias))
    );
    const [first, ...rest] = checkpoints;
    const expected = requiredValue(first, 'No group checkpoints were loaded.');

    for (const checkpoint of rest) {
        expect(checkpoint).toEqual(expected);
    }

    return expected;
};

const createDraft = ({
    groupAlias,
    localAid,
    localAlias,
    memberAliases,
    memberAids,
    signingThreshold = thresholdSpecForMembers(memberAids),
    rotationThreshold = thresholdSpecForMembers(memberAids),
}: {
    groupAlias: string;
    localAid: HabState;
    localAlias: string;
    memberAliases: readonly string[];
    memberAids: readonly string[];
    signingThreshold?: MultisigThresholdSpec;
    rotationThreshold?: MultisigThresholdSpec;
}): MultisigCreateDraft => ({
    groupAlias,
    localMemberName: localAlias,
    localMemberAid: localAid.prefix,
    members: memberAids.map((aid, index) => ({
        aid,
        alias: memberAliases[index] ?? aid,
        source: aid === localAid.prefix ? 'local' : 'contact',
    })),
    signingMemberAids: [...memberAids],
    rotationMemberAids: [...memberAids],
    signingThreshold,
    rotationThreshold,
    witnessMode: 'demo',
});

export const createMembers = async (
    base: string,
    count: number
): Promise<{
    roles: Role[];
    aliases: string[];
    aids: HabState[];
    memberAids: string[];
}> => {
    const roles = await Promise.all(
        Array.from({ length: count }, (_, index) =>
            createRole(`${base}-${index + 1}`)
        )
    );
    const aliases = Array.from({ length: count }, (_, index) =>
        uniqueAlias(`${base}-member-${index + 1}`)
    );
    const aids = await Promise.all(
        roles.map((role, index) =>
            createWitnessedIdentifier(role, aliases[index])
        )
    );

    return {
        roles,
        aliases,
        aids,
        memberAids: aids.map((aid) => aid.prefix),
    };
};

export const exchangeAllAgentOobis = async (
    roles: readonly Role[],
    aliases: readonly string[]
): Promise<void> => {
    const oobis = await Promise.all(
        roles.map((role, index) => addAgentEndRole(role, aliases[index]))
    );

    await Promise.all(
        roles.flatMap((role, roleIndex) =>
            oobis.flatMap((oobi, oobiIndex) =>
                roleIndex === oobiIndex
                    ? []
                    : [
                          resolveOobi(
                              role,
                              oobi,
                              aliases[oobiIndex] ?? `member-${oobiIndex + 1}`
                          ),
                      ]
            )
        )
    );
};

export const requestInput = (
    notification: ScenarioNotification,
    groupAlias: string,
    localMemberName: string
): MultisigRequestActionInput => ({
    notificationId: notification.i,
    exnSaid: notificationSaid(notification),
    groupAlias,
    localMemberName,
});

const acceptNotes = async (
    role: Role,
    notes: readonly ScenarioNotification[],
    groupAlias: string,
    localMemberName: string,
    accept: (input: MultisigRequestActionInput) => Promise<unknown>
): Promise<void> => {
    await Promise.all(
        notes.map((notification) =>
            accept(requestInput(notification, groupAlias, localMemberName))
        )
    );
    await Promise.all(
        notes.map((notification) => markAndRemoveNotification(role, notification))
    );
};

export const acceptEndRoleNotes = (
    role: Role,
    notes: readonly ScenarioNotification[],
    groupAlias: string,
    localMemberName: string
): Promise<void> =>
    acceptNotes(role, notes, groupAlias, localMemberName, (input) =>
        runServiceOperation(() =>
            acceptMultisigEndRoleService({ client: role.client, input })
        )
    );

export const acceptInteractionNotes = (
    role: Role,
    notes: readonly ScenarioNotification[],
    groupAlias: string,
    localMemberName: string
): Promise<void> =>
    acceptNotes(role, notes, groupAlias, localMemberName, (input) =>
        runServiceOperation(() =>
            acceptMultisigInteractionService({ client: role.client, input })
        )
    );

export const acceptRotationNotes = (
    role: Role,
    notes: readonly ScenarioNotification[],
    groupAlias: string,
    localMemberName: string
): Promise<void> =>
    acceptNotes(role, notes, groupAlias, localMemberName, (input) =>
        runServiceOperation(() =>
            acceptMultisigRotationService({ client: role.client, input })
        )
    );

export const authorizeGroupAgents = async ({
    roles,
    aliases,
    groupAlias,
}: {
    roles: readonly Role[];
    aliases: readonly string[];
    groupAlias: string;
}): Promise<void> => {
    const [initiator, ...acceptors] = roles;
    const initiatorRole = requiredValue(initiator, 'Missing initiator role.');
    const authorizing = runServiceOperation(() =>
        authorizeMultisigAgentsService({
            client: initiatorRole.client,
            groupAlias,
            localMemberName: aliases[0],
        })
    );
    const noteSets = await Promise.all(
        acceptors.map((role) =>
            waitForNotifications(role, MULTISIG_RPY_ROUTE, roles.length)
        )
    );

    await Promise.all([
        authorizing,
        ...acceptors.map((role, index) =>
            acceptEndRoleNotes(
                role,
                noteSets[index],
                groupAlias,
                aliases[index + 1]
            )
        ),
    ]);
};

const groupAgentOobi = async (
    role: Role,
    groupAlias: string
): Promise<string> => {
    const response = await role.client.oobis().get(groupAlias, 'agent');
    const oobis =
        isRecord(response) && Array.isArray(response.oobis)
            ? response.oobis
            : [];

    return requiredValue(
        stringValue(oobis[0]),
        `${groupAlias} did not return a group agent OOBI.`
    );
};

export const resolveGroupOobiWithObserver = async (
    source: Role,
    groupAlias: string
): Promise<void> => {
    const observer = await createRole(`${groupAlias}-observer`);
    await resolveOobi(
        observer,
        await groupAgentOobi(source, groupAlias),
        groupAlias
    );
    const contacts = await observer.client.contacts().list();
    const group = await source.client.identifiers().get(groupAlias);

    expect(contacts.some((contact) => contact.id === group.prefix)).toBe(true);
};

const rotateMember = async (role: Role, alias: string): Promise<HabState> => {
    const result = await role.client.identifiers().rotate(alias);
    await role.waitEvent(result, `rotates member ${alias}`);
    return role.client.identifiers().get(alias);
};

const refreshRemoteMemberStates = async (
    roles: readonly Role[],
    memberAids: readonly string[],
    sequenceNumber: string
): Promise<void> => {
    await Promise.all(
        roles.flatMap((role, roleIndex) =>
            memberAids.flatMap((aid, aidIndex) =>
                roleIndex === aidIndex
                    ? []
                    : [refreshKeyState(role, aid, sequenceNumber)]
            )
        )
    );
};

export const rotateMembersAndGroup = async ({
    roles,
    aliases,
    groupAlias,
    memberAids,
    nextThreshold = thresholdSpecForMembers(memberAids),
}: {
    roles: readonly Role[];
    aliases: readonly string[];
    groupAlias: string;
    memberAids: readonly string[];
    nextThreshold?: MultisigThresholdSpec;
}): Promise<void> => {
    await Promise.all(
        roles.map((role, index) => rotateMember(role, aliases[index]))
    );
    await refreshRemoteMemberStates(roles, memberAids, '1');

    const [initiator, ...acceptors] = roles;
    const initiatorRole = requiredValue(initiator, 'Missing initiator role.');
    const rotating = runServiceOperation(() =>
        startMultisigRotationService({
            client: initiatorRole.client,
            draft: {
                groupAlias,
                localMemberName: aliases[0],
                signingMemberAids: [...memberAids],
                rotationMemberAids: [...memberAids],
                nextThreshold,
            },
        })
    );
    const noteSets = await Promise.all(
        acceptors.map((role) =>
            waitForNotifications(role, MULTISIG_ROT_ROUTE, 1)
        )
    );

    await Promise.all([
        rotating,
        ...acceptors.map((role, index) =>
            acceptRotationNotes(
                role,
                noteSets[index],
                groupAlias,
                aliases[index + 1]
            )
        ),
    ]);
};

export const startGroupInteraction = async ({
    roles,
    aliases,
    groupAlias,
    data,
}: {
    roles: readonly Role[];
    aliases: readonly string[];
    groupAlias: string;
    data: unknown;
}): Promise<void> => {
    const [initiator, ...acceptors] = roles;
    const initiatorRole = requiredValue(initiator, 'Missing initiator role.');
    const interacting = runServiceOperation(() =>
        startMultisigInteractionService({
            client: initiatorRole.client,
            draft: {
                groupAlias,
                localMemberName: aliases[0],
                data,
            },
        })
    );
    const noteSets = await Promise.all(
        acceptors.map((role) =>
            waitForNotifications(role, MULTISIG_IXN_ROUTE, 1)
        )
    );

    await Promise.all([
        interacting,
        ...acceptors.map((role, index) =>
            acceptInteractionNotes(
                role,
                noteSets[index],
                groupAlias,
                aliases[index + 1]
            )
        ),
    ]);
};

export const inceptGroup = async ({
    roles,
    aliases,
    aids,
    memberAids,
    groupAlias,
    signingThreshold,
    rotationThreshold,
}: {
    roles: readonly Role[];
    aliases: readonly string[];
    aids: readonly HabState[];
    memberAids: readonly string[];
    groupAlias: string;
    signingThreshold?: MultisigThresholdSpec;
    rotationThreshold?: MultisigThresholdSpec;
}): Promise<void> => {
    const initiator = requiredValue(roles[0], 'Missing initiator role.');
    const initiatorAid = requiredValue(aids[0], 'Missing initiator AID.');
    const draft = createDraft({
        groupAlias,
        localAid: initiatorAid,
        localAlias: aliases[0],
        memberAliases: aliases,
        memberAids,
        signingThreshold,
        rotationThreshold,
    });
    const creating = runServiceOperation(() =>
        startMultisigInceptionService({
            client: initiator.client,
            draft,
            config: appConfig,
        })
    );
    const acceptors = roles.slice(1);
    const notes = await Promise.all(
        acceptors.map((role) => waitForNotification(role, MULTISIG_ICP_ROUTE))
    );

    await Promise.all([
        creating,
        ...acceptors.map((role, index) => {
            const note = notes[index];
            const alias = aliases[index + 1];

            return runServiceOperation(() =>
                acceptMultisigInceptionService({
                    client: role.client,
                    input: requestInput(note, groupAlias, alias),
                })
            );
        }),
    ]);
    await Promise.all(
        acceptors.map((role, index) =>
            markAndRemoveNotification(role, notes[index])
        )
    );
};

export const setupActiveMultisigGroup = async (
    base: string,
    count: number
): Promise<MultisigScenarioGroup> => {
    const groupAlias = uniqueAlias(base);
    const members = await createMembers(base, count);

    await exchangeAllAgentOobis(members.roles, members.aliases);
    await inceptGroup({ ...members, groupAlias });
    await expectGroupConvergence(members.roles, groupAlias);
    await authorizeGroupAgents({
        roles: members.roles,
        aliases: members.aliases,
        groupAlias,
    });

    return { ...members, groupAlias };
};

export const assertMembershipAndThresholds = async (
    role: Role,
    groupAlias: string,
    memberAids: readonly string[],
    expectedThreshold: MultisigThresholdSith
): Promise<void> => {
    const group = await role.client.identifiers().get(groupAlias);
    const state = groupState(group);

    expect(await groupMemberAids(role, groupAlias, 'signing')).toEqual(memberAids);
    expect(await groupMemberAids(role, groupAlias, 'rotation')).toEqual(memberAids);
    expect(state.kt).toEqual(expectedThreshold);
    expect(state.nt).toEqual(expectedThreshold);
};
