import {
    Algos,
    MULTISIG_ICP_ROUTE,
    MULTISIG_IXN_ROUTE,
    MULTISIG_ROT_ROUTE,
    MULTISIG_RPY_ROUTE,
    Serder,
    Siger,
    Tholder,
    assertMultisigIcp,
    assertMultisigIxn,
    assertMultisigRot,
    assertMultisigRpy,
    b,
    d,
    messagize,
    type EventResult,
    type HabState,
    type KeyState,
    type Operation as KeriaOperation,
    type SignifyClient,
} from 'signify-ts';
import type { Operation as EffectionOperation } from 'effection';
import { callPromise } from '../effects/promise';
import type { AppConfig } from '../config';
import type { OperationLogger } from '../signify/client';
import type {
    MultisigCreateDraft,
    MultisigInteractionDraft,
    MultisigOperationResult,
    MultisigRequestActionInput,
    MultisigRotationDraft,
} from '../features/multisig/multisigTypes';
import {
    thresholdSpecMemberAids,
    thresholdSpecToSith,
    validateThresholdSpecForMembers,
    type MultisigThresholdSith,
} from '../features/multisig/multisigThresholds';
import {
    getIdentifierService,
    listIdentifiersService,
} from './identifiers.service';
import { waitOperationService } from './signify.service';

export {
    MULTISIG_ICP_ROUTE,
    MULTISIG_IXN_ROUTE,
    MULTISIG_ROT_ROUTE,
    MULTISIG_RPY_ROUTE,
};

export type MultisigOperationPhaseReporter = (
    phase: string,
    keriaOperationName?: string | null
) => void;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;

const aidValue = (entry: unknown): string | null => {
    if (!isRecord(entry)) {
        return null;
    }

    return (
        stringValue(entry.prefix) ??
        stringValue(entry.aid) ??
        stringValue((entry.state as Record<string, unknown> | undefined)?.i)
    );
};

const responseEntries = (value: unknown): unknown[] => {
    if (Array.isArray(value)) {
        return value;
    }

    if (isRecord(value) && Array.isArray(value.aids)) {
        return value.aids;
    }

    return [];
};

const contactAid = (contact: unknown): string | null => {
    if (!isRecord(contact)) {
        return null;
    }

    return stringValue(contact.id) ?? stringValue(contact.aid);
};

const hasAgentEndpoint = (contact: unknown): boolean => {
    if (!isRecord(contact)) {
        return false;
    }

    const ends = isRecord(contact.ends) ? contact.ends : {};
    const agent = isRecord(ends.agent) ? ends.agent : null;
    return agent !== null && Object.keys(agent).length > 0;
};

const operationName = (operation: KeriaOperation | unknown): string | null =>
    isRecord(operation) && typeof operation.name === 'string'
        ? operation.name
        : null;

const unique = (values: readonly string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const value of values) {
        const normalized = value.trim();
        if (normalized.length === 0 || seen.has(normalized)) {
            continue;
        }

        seen.add(normalized);
        result.push(normalized);
    }

    return result;
};

const keriaTimestamp = (): string =>
    new Date().toISOString().replace('Z', '000+00:00');

const eventResultOperation = function* (
    result: EventResult
): EffectionOperation<KeriaOperation> {
    return (yield* callPromise(() => result.op())) as KeriaOperation;
};

const eventEmbeds = (
    result: EventResult,
    key: 'icp' | 'ixn' | 'rot' | 'rpy',
    seal?: unknown
): Record<string, [Serder, string]> => {
    const sigers = result.sigs.map((sig) => new Siger({ qb64: sig }));
    const message =
        seal === undefined
            ? d(messagize(result.serder, sigers))
            : d(messagize(result.serder, sigers, seal, undefined, undefined, false));

    return {
        [key]: [result.serder, message.substring(result.serder.size)],
    } as Record<string, [Serder, string]>;
};

const establishmentSeal = (group: HabState): [string, Record<string, string>] => {
    const ee = (group.state as unknown as { ee?: { s?: string; d?: string } }).ee;
    if (ee?.s === undefined || ee.d === undefined) {
        throw new Error(`Group ${group.name} is missing establishment state.`);
    }

    return [
        'SealEvent',
        {
            i: group.prefix,
            s: ee.s,
            d: ee.d,
        },
    ];
};

const exchangeSaid = (exchange: unknown): string | null =>
    isRecord(exchange) ? stringValue(exchange.d) : null;

const firstKeyState = (aid: string, states: KeyState[]): KeyState => {
    const state = states[0];
    if (state === undefined) {
        throw new Error(`No key state is available for member ${aid}.`);
    }

    return state;
};

const getKeyStates = async (
    client: SignifyClient,
    memberAids: readonly string[]
): Promise<KeyState[]> => {
    const states = await Promise.all(
        memberAids.map(async (aid) =>
            firstKeyState(aid, await client.keyStates().get(aid))
        )
    );

    return states;
};

function* getKeyStatesService({
    client,
    memberAids,
}: {
    client: SignifyClient;
    memberAids: readonly string[];
}): EffectionOperation<KeyState[]> {
    return yield* callPromise(() => getKeyStates(client, memberAids));
}

function* requireDeliverableMultisigRecipients({
    client,
    memberAids,
    localMemberAid,
}: {
    client: SignifyClient;
    memberAids: readonly string[];
    localMemberAid: string;
}): EffectionOperation<void> {
    const localIdentifiers = responseEntries(
        yield* callPromise(() => client.identifiers().list())
    );
    const localAids = new Set(
        [localMemberAid, ...localIdentifiers.flatMap((identifier) => aidValue(identifier) ?? [])]
    );
    const remoteAids = unique(memberAids).filter((aid) => !localAids.has(aid));
    if (remoteAids.length === 0) {
        return;
    }

    const contacts = responseEntries(
        yield* callPromise(() => client.contacts().list())
    );
    const contactsByAid = new Map(
        contacts.flatMap((contact) => {
            const aid = contactAid(contact);
            return aid === null ? [] : [[aid, contact] as const];
        })
    );
    const missingContacts: string[] = [];
    const missingAgentEndpoints: string[] = [];

    for (const aid of remoteAids) {
        const contact = contactsByAid.get(aid);
        if (contact === undefined) {
            missingContacts.push(aid);
            continue;
        }

        if (!hasAgentEndpoint(contact)) {
            missingAgentEndpoints.push(aid);
        }
    }

    if (missingContacts.length > 0 || missingAgentEndpoints.length > 0) {
        const details = [
            missingContacts.length > 0
                ? `unresolved contacts: ${missingContacts.join(', ')}`
                : null,
            missingAgentEndpoints.length > 0
                ? `missing agent OOBIs: ${missingAgentEndpoints.join(', ')}`
                : null,
        ].flatMap((item) => (item === null ? [] : [item]));
        throw new Error(
            `Cannot send multisig inception request. Resolve member agent OOBIs before creating the group (${details.join('; ')}).`
        );
    }
}

function* refreshMemberKeyStatesService({
    client,
    memberAids,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    memberAids: readonly string[];
    logger?: OperationLogger;
    onPhase?: MultisigOperationPhaseReporter;
}): EffectionOperation<void> {
    for (const aid of unique(memberAids)) {
        onPhase?.(`refreshing member key state ${aid}`);
        const operation = yield* callPromise(() => client.keyStates().query(aid));
        onPhase?.('waiting for member key state', operationName(operation));
        yield* waitOperationService({
            client,
            operation,
            label: `refreshing key state for ${aid}`,
            logger,
        });
    }
}

const validateThreshold = (
    label: string,
    threshold: MultisigThresholdSith
): void => {
    if (Array.isArray(threshold) && threshold.length === 0) {
        throw new Error(`${label} threshold requires at least one member.`);
    }

    try {
        new Tholder({ sith: threshold });
    } catch (error) {
        throw new Error(
            `${label} threshold is invalid: ${
                error instanceof Error ? error.message : String(error)
            }`,
            { cause: error }
        );
    }
};

const requireMemberAids = (
    label: string,
    memberAids: readonly string[],
    groupAlias: string
): void => {
    if (memberAids.length === 0) {
        throw new Error(
            `Cannot rotate multisig group ${groupAlias}: ${label} members could not be loaded. Refresh the group, resolve member OOBIs, and try again.`
        );
    }
};

const localMemberFromGroup = async ({
    client,
    groupAlias,
    localMemberName,
}: {
    client: SignifyClient;
    groupAlias: string;
    localMemberName?: string | null;
}): Promise<HabState> => {
    if (localMemberName !== undefined && localMemberName !== null) {
        return client.identifiers().get(localMemberName);
    }

    const members = await client.identifiers().members(groupAlias);
    const signing = Array.isArray((members as { signing?: unknown }).signing)
        ? ((members as unknown as { signing: unknown[] }).signing ?? [])
        : [];
    const localIdentifiers = await client.identifiers().list();
    const localAids = Array.isArray(localIdentifiers)
        ? localIdentifiers
        : isRecord(localIdentifiers) && Array.isArray(localIdentifiers.aids)
          ? localIdentifiers.aids
          : [];

    const local = localAids.find((identifier) =>
        signing.some(
            (member) =>
                aidValue(member) === aidValue(identifier)
        )
    );

    if (local === undefined) {
        throw new Error(
            `No local signing member is available for group ${groupAlias}.`
        );
    }

    return local as HabState;
};

const groupMemberAids = async (
    client: SignifyClient,
    groupAlias: string,
    kind: 'signing' | 'rotation'
): Promise<string[]> => {
    const members = await client.identifiers().members(groupAlias);
    const entries = Array.isArray((members as Record<string, unknown>)[kind])
        ? ((members as Record<string, unknown>)[kind] as unknown[])
        : [];

    return unique(
        entries.flatMap((entry) =>
            [aidValue(entry)].flatMap((value) => value ?? [])
        )
    );
};

const groupAgentEids = async (
    client: SignifyClient,
    groupAlias: string
): Promise<string[]> => {
    const members = await client.identifiers().members(groupAlias);
    const signing = Array.isArray((members as Record<string, unknown>).signing)
        ? ((members as Record<string, unknown>).signing as unknown[])
        : [];
    const eids: string[] = [];

    for (const member of signing) {
        if (!isRecord(member) || !isRecord(member.ends)) {
            continue;
        }

        const agentEnds = member.ends.agent;
        if (!isRecord(agentEnds)) {
            continue;
        }

        eids.push(...Object.keys(agentEnds));
    }

    return unique(eids);
};

const eventSaid = (result: EventResult): string | null =>
    stringValue((result.serder as unknown as { said?: unknown }).said) ??
    stringValue((result.serder as unknown as { pre?: unknown }).pre) ??
    stringValue((result.serder.sad as Record<string, unknown>).d);

const completionResult = ({
    groupAlias,
    groupAid,
    localMemberAid,
    exchangeSaid: sentExchangeSaid,
    operations,
}: {
    groupAlias: string;
    groupAid: string | null;
    localMemberAid: string | null;
    exchangeSaid: string | null;
    operations: readonly unknown[];
}): MultisigOperationResult => ({
    groupAlias,
    groupAid,
    localMemberAid,
    exchangeSaid: sentExchangeSaid,
    operationNames: operations.flatMap((operation) => {
        const name = operationName(operation);
        return name === null ? [] : [name];
    }),
    completedAt: new Date().toISOString(),
});

/**
 * Start a group inception and send the `/multisig/icp` request to all members.
 */
export function* startMultisigInceptionService({
    client,
    draft,
    config,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    draft: MultisigCreateDraft;
    config?: AppConfig;
    logger?: OperationLogger;
    onPhase?: MultisigOperationPhaseReporter;
}): EffectionOperation<MultisigOperationResult> {
    const groupAlias = draft.groupAlias.trim();
    const signingMemberAids = unique(draft.signingMemberAids);
    const rotationMemberAids = unique(draft.rotationMemberAids);
    const isith = thresholdSpecToSith(draft.signingThreshold);
    const nsith = thresholdSpecToSith(draft.rotationThreshold);

    validateThreshold('Signing', isith);
    validateThreshold('Rotation', nsith);

    if (!signingMemberAids.includes(draft.localMemberAid)) {
        throw new Error('The local member must be in the signing set.');
    }

    onPhase?.('loading local member');
    const memberHab = yield* getIdentifierService({
        client,
        aid: draft.localMemberName,
    });
    onPhase?.('checking member delivery');
    yield* requireDeliverableMultisigRecipients({
        client,
        memberAids: [...signingMemberAids, ...rotationMemberAids],
        localMemberAid: memberHab.prefix,
    });
    onPhase?.('loading member key states');
    const states = yield* getKeyStatesService({
        client,
        memberAids: signingMemberAids,
    });
    const rstates = yield* getKeyStatesService({
        client,
        memberAids: rotationMemberAids,
    });

    onPhase?.('creating multisig inception event');
    const wits =
        draft.witnessMode === 'demo' ? (config?.witnesses.aids ?? []) : [];
    const toad =
        draft.witnessMode === 'demo' ? (config?.witnesses.toad ?? 0) : 0;
    const result = yield* callPromise(() =>
        client.identifiers().create(groupAlias, {
            algo: Algos.group,
            mhab: memberHab,
            isith,
            nsith,
            toad,
            wits,
            states,
            rstates,
        })
    );
    const operation = yield* eventResultOperation(result);
    onPhase?.('sending multisig inception request', operationName(operation));
    const sent = yield* callPromise(() =>
        client.exchanges().send(
            draft.localMemberName,
            groupAlias,
            memberHab,
            MULTISIG_ICP_ROUTE,
            {
                gid: result.serder.pre,
                smids: signingMemberAids,
                rmids: rotationMemberAids,
            },
            eventEmbeds(result, 'icp'),
            unique([...signingMemberAids, ...rotationMemberAids]).filter(
                (aid) => aid !== memberHab.prefix
            )
        )
    );

    onPhase?.('waiting for multisig inception', operationName(operation));
    yield* waitOperationService({
        client,
        operation,
        label: `creating multisig group ${groupAlias}`,
        logger,
    });

    return completionResult({
        groupAlias,
        groupAid: result.serder.pre,
        localMemberAid: memberHab.prefix,
        exchangeSaid: exchangeSaid(sent) ?? eventSaid(result),
        operations: [operation],
    });
}

/**
 * Accept an inbound `/multisig/icp` request by recreating the same group event.
 */
export function* acceptMultisigInceptionService({
    client,
    input,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    input: MultisigRequestActionInput;
    logger?: OperationLogger;
    onPhase?: MultisigOperationPhaseReporter;
}): EffectionOperation<MultisigOperationResult> {
    const groupAlias = input.groupAlias.trim();
    onPhase?.('loading multisig inception request');
    const response = yield* callPromise(() =>
        client.groups().getRequest(input.exnSaid)
    );
    const request = assertMultisigIcp(response[0]);
    const icp = request.exn.e.icp;
    const smids = unique(request.exn.a.smids);
    const rmids = unique(request.exn.a.rmids ?? smids);
    const delpre = stringValue((icp as Record<string, unknown>).di) ?? undefined;

    onPhase?.('loading local member');
    const memberHab = yield* getIdentifierService({
        client,
        aid: input.localMemberName,
    });
    if (!smids.includes(memberHab.prefix) && !rmids.includes(memberHab.prefix)) {
        throw new Error('The selected local member is not part of this group.');
    }

    onPhase?.('loading member key states');
    const states = yield* getKeyStatesService({ client, memberAids: smids });
    const rstates = yield* getKeyStatesService({ client, memberAids: rmids });
    onPhase?.('joining multisig inception');
    const result = yield* callPromise(() =>
        client.identifiers().create(groupAlias, {
            algo: Algos.group,
            mhab: memberHab,
            isith: icp.kt,
            nsith: icp.nt,
            toad: Number(icp.bt),
            wits: icp.b,
            states,
            rstates,
            delpre,
        })
    );
    const operation = yield* eventResultOperation(result);
    const sent = yield* callPromise(() =>
        client.exchanges().send(
            input.localMemberName,
            groupAlias,
            memberHab,
            MULTISIG_ICP_ROUTE,
            { gid: result.serder.pre, smids, rmids },
            eventEmbeds(result, 'icp'),
            unique([...smids, ...rmids]).filter((aid) => aid !== memberHab.prefix)
        )
    );

    onPhase?.('waiting for multisig inception', operationName(operation));
    yield* waitOperationService({
        client,
        operation,
        label: `accepting multisig group ${groupAlias}`,
        logger,
    });

    return completionResult({
        groupAlias,
        groupAid: result.serder.pre,
        localMemberAid: memberHab.prefix,
        exchangeSaid: exchangeSaid(sent) ?? input.exnSaid,
        operations: [operation],
    });
}

/**
 * Authorize known member agent endpoints for a group with `/multisig/rpy`.
 */
export function* authorizeMultisigAgentsService({
    client,
    groupAlias,
    localMemberName,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    groupAlias: string;
    localMemberName?: string | null;
    logger?: OperationLogger;
    onPhase?: MultisigOperationPhaseReporter;
}): EffectionOperation<MultisigOperationResult> {
    onPhase?.('loading group and member endpoints');
    const group = yield* getIdentifierService({ client, aid: groupAlias });
    const memberHab = yield* callPromise(() =>
        localMemberFromGroup({ client, groupAlias, localMemberName })
    );
    const signingMemberAids = yield* callPromise(() =>
        groupMemberAids(client, groupAlias, 'signing')
    );
    const eids = yield* callPromise(() => groupAgentEids(client, groupAlias));
    if (eids.length === 0) {
        throw new Error(
            `No member agent endpoints are available for group ${groupAlias}. Resolve member agent OOBIs before authorizing group agents.`
        );
    }

    const stamp = keriaTimestamp();
    const operations: KeriaOperation[] = [];
    let latestExchangeSaid: string | null = null;

    for (const eid of eids) {
        onPhase?.(`authorizing agent ${eid}`);
        const result = yield* callPromise(() =>
            client.identifiers().addEndRole(groupAlias, 'agent', eid, stamp)
        );
        const operation = yield* eventResultOperation(result);
        operations.push(operation);

        const seal = establishmentSeal(group);
        const sent = yield* callPromise(() =>
            client.exchanges().send(
                memberHab.name,
                groupAlias,
                memberHab,
                MULTISIG_RPY_ROUTE,
                { gid: group.prefix },
                eventEmbeds(result, 'rpy', seal),
                signingMemberAids.filter((aid) => aid !== memberHab.prefix)
            )
        );
        latestExchangeSaid = exchangeSaid(sent) ?? latestExchangeSaid;
    }

    for (const operation of operations) {
        onPhase?.('waiting for agent authorization', operationName(operation));
        yield* waitOperationService({
            client,
            operation,
            label: `authorizing agent endpoint for ${groupAlias}`,
            logger,
        });
    }

    onPhase?.('checking group agent OOBI');
    const oobiResponse = yield* callPromise(() =>
        client.oobis().get(groupAlias, 'agent')
    );
    const oobis =
        isRecord(oobiResponse) && Array.isArray(oobiResponse.oobis)
            ? oobiResponse.oobis.flatMap((value) => {
                  const oobi = stringValue(value);
                  return oobi === null ? [] : [oobi];
              })
            : [];
    if (oobis.length === 0) {
        throw new Error(
            `No group agent OOBI is available for ${groupAlias} after endpoint authorization.`
        );
    }

    return completionResult({
        groupAlias,
        groupAid: group.prefix,
        localMemberAid: memberHab.prefix,
        exchangeSaid: latestExchangeSaid,
        operations,
    });
}

/**
 * Accept one inbound `/multisig/rpy` endpoint authorization request.
 */
export function* acceptMultisigEndRoleService({
    client,
    input,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    input: MultisigRequestActionInput;
    logger?: OperationLogger;
    onPhase?: MultisigOperationPhaseReporter;
}): EffectionOperation<MultisigOperationResult> {
    onPhase?.('loading multisig role request');
    const response = yield* callPromise(() =>
        client.groups().getRequest(input.exnSaid)
    );
    const request = assertMultisigRpy(response[0]);
    const rpy = request.exn.e.rpy;
    const rpyAttrs = rpy.a as Record<string, unknown>;
    const role = stringValue(rpyAttrs.role);
    const eid = stringValue(rpyAttrs.eid);
    const stamp = stringValue((rpy as Record<string, unknown>).dt);

    if (role === null || eid === null || stamp === null) {
        throw new Error('Multisig role request is missing role metadata.');
    }

    const memberHab = yield* getIdentifierService({
        client,
        aid: input.localMemberName,
    });
    const result = yield* callPromise(() =>
        client.identifiers().addEndRole(input.groupAlias, role, eid, stamp)
    );
    const operation = yield* eventResultOperation(result);
    const group = yield* getIdentifierService({ client, aid: input.groupAlias });
    const signingMemberAids = yield* callPromise(() =>
        groupMemberAids(client, input.groupAlias, 'signing')
    );
    const seal = establishmentSeal(group);
    const sent = yield* callPromise(() =>
        client.exchanges().send(
            memberHab.name,
            input.groupAlias,
            memberHab,
            MULTISIG_RPY_ROUTE,
            { gid: group.prefix },
            eventEmbeds(result, 'rpy', seal),
            signingMemberAids.filter((aid) => aid !== memberHab.prefix)
        )
    );

    onPhase?.('waiting for agent authorization', operationName(operation));
    yield* waitOperationService({
        client,
        operation,
        label: `accepting agent endpoint for ${input.groupAlias}`,
        logger,
    });

    return completionResult({
        groupAlias: input.groupAlias,
        groupAid: group.prefix,
        localMemberAid: memberHab.prefix,
        exchangeSaid: exchangeSaid(sent) ?? input.exnSaid,
        operations: [operation],
    });
}

/**
 * Start and send a group interaction event.
 */
export function* startMultisigInteractionService({
    client,
    draft,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    draft: MultisigInteractionDraft;
    logger?: OperationLogger;
    onPhase?: MultisigOperationPhaseReporter;
}): EffectionOperation<MultisigOperationResult> {
    const groupAlias = draft.groupAlias.trim();
    const memberHab = yield* callPromise(() =>
        localMemberFromGroup({
            client,
            groupAlias,
            localMemberName: draft.localMemberName,
        })
    );
    const smids = yield* callPromise(() =>
        groupMemberAids(client, groupAlias, 'signing')
    );
    const rmids = yield* callPromise(() =>
        groupMemberAids(client, groupAlias, 'rotation')
    );
    if (!smids.includes(memberHab.prefix)) {
        throw new Error('The selected local member is not a signing member.');
    }

    onPhase?.('creating multisig interaction event');
    const result = yield* callPromise(() =>
        client.identifiers().interact(groupAlias, draft.data)
    );
    const operation = yield* eventResultOperation(result);
    const sent = yield* callPromise(() =>
        client.exchanges().send(
            memberHab.name,
            groupAlias,
            memberHab,
            MULTISIG_IXN_ROUTE,
            { gid: result.serder.pre, smids, rmids },
            eventEmbeds(result, 'ixn'),
            unique([...smids, ...rmids]).filter((aid) => aid !== memberHab.prefix)
        )
    );

    onPhase?.('waiting for multisig interaction', operationName(operation));
    yield* waitOperationService({
        client,
        operation,
        label: `interacting with multisig group ${groupAlias}`,
        logger,
    });

    return completionResult({
        groupAlias,
        groupAid: result.serder.pre,
        localMemberAid: memberHab.prefix,
        exchangeSaid: exchangeSaid(sent) ?? eventSaid(result),
        operations: [operation],
    });
}

/**
 * Accept an inbound `/multisig/ixn` interaction request.
 */
export function* acceptMultisigInteractionService({
    client,
    input,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    input: MultisigRequestActionInput;
    logger?: OperationLogger;
    onPhase?: MultisigOperationPhaseReporter;
}): EffectionOperation<MultisigOperationResult> {
    onPhase?.('loading multisig interaction request');
    const response = yield* callPromise(() =>
        client.groups().getRequest(input.exnSaid)
    );
    const request = assertMultisigIxn(response[0]);
    const ixn = request.exn.e.ixn;
    const memberHab = yield* getIdentifierService({
        client,
        aid: input.localMemberName,
    });
    const smids = [...request.exn.a.smids];
    const rmids = [...(request.exn.a.rmids ?? smids)];
    if (!smids.includes(memberHab.prefix)) {
        throw new Error('The selected local member is not a signing member.');
    }

    const result = yield* callPromise(() =>
        client.identifiers().interact(input.groupAlias, ixn.a)
    );
    const operation = yield* eventResultOperation(result);
    const sent = yield* callPromise(() =>
        client.exchanges().send(
            memberHab.name,
            input.groupAlias,
            memberHab,
            MULTISIG_IXN_ROUTE,
            { gid: result.serder.pre, smids, rmids },
            eventEmbeds(result, 'ixn'),
            unique([...smids, ...rmids]).filter((aid) => aid !== memberHab.prefix)
        )
    );

    onPhase?.('waiting for multisig interaction', operationName(operation));
    yield* waitOperationService({
        client,
        operation,
        label: `accepting multisig interaction for ${input.groupAlias}`,
        logger,
    });

    return completionResult({
        groupAlias: input.groupAlias,
        groupAid: result.serder.pre,
        localMemberAid: memberHab.prefix,
        exchangeSaid: exchangeSaid(sent) ?? input.exnSaid,
        operations: [operation],
    });
}

/**
 * Start and send a group rotation event. This covers same-member rotations and
 * staging new next-rotation members through `rstates`.
 */
export function* startMultisigRotationService({
    client,
    draft,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    draft: MultisigRotationDraft;
    logger?: OperationLogger;
    onPhase?: MultisigOperationPhaseReporter;
}): EffectionOperation<MultisigOperationResult> {
    const groupAlias = draft.groupAlias.trim();
    const memberHab = yield* callPromise(() =>
        localMemberFromGroup({
            client,
            groupAlias,
            localMemberName: draft.localMemberName,
        })
    );
    const currentSigningMemberAids =
        draft.signingMemberAids.length > 0
            ? draft.signingMemberAids
            : yield* callPromise(() =>
                  groupMemberAids(client, groupAlias, 'signing')
              );
    const smids = unique(currentSigningMemberAids);
    const thresholdMemberAids = thresholdSpecMemberAids(draft.nextThreshold);
    const rmids = unique(
        draft.rotationMemberAids.length > 0
            ? draft.rotationMemberAids
            : thresholdMemberAids
    );
    requireMemberAids('signing', smids, groupAlias);
    requireMemberAids('next rotation', rmids, groupAlias);
    const thresholdError = validateThresholdSpecForMembers({
        spec: draft.nextThreshold,
        memberAids: rmids,
    });
    if (thresholdError !== null) {
        throw new Error(`Next rotation threshold is invalid: ${thresholdError}`);
    }
    const nsith = thresholdSpecToSith(draft.nextThreshold);
    validateThreshold('Next rotation', nsith);

    onPhase?.('refreshing rotation key states');
    yield* refreshMemberKeyStatesService({
        client,
        memberAids: [...smids, ...rmids],
        logger,
        onPhase,
    });
    onPhase?.('loading rotation key states');
    const states = yield* getKeyStatesService({ client, memberAids: smids });
    const rstates = yield* getKeyStatesService({ client, memberAids: rmids });
    onPhase?.('creating multisig rotation event');
    const result = yield* callPromise(() =>
        client.identifiers().rotate(groupAlias, {
            states,
            rstates,
            nsith: nsith as string | number | string[],
        })
    );
    const operation = yield* eventResultOperation(result);
    const sent = yield* callPromise(() =>
        client.exchanges().send(
            memberHab.name,
            groupAlias,
            memberHab,
            MULTISIG_ROT_ROUTE,
            { gid: result.serder.pre, smids, rmids },
            eventEmbeds(result, 'rot'),
            unique([...smids, ...rmids]).filter((aid) => aid !== memberHab.prefix)
        )
    );

    onPhase?.('waiting for multisig rotation', operationName(operation));
    yield* waitOperationService({
        client,
        operation,
        label: `rotating multisig group ${groupAlias}`,
        logger,
    });

    return completionResult({
        groupAlias,
        groupAid: result.serder.pre,
        localMemberAid: memberHab.prefix,
        exchangeSaid: exchangeSaid(sent) ?? eventSaid(result),
        operations: [operation],
    });
}

/**
 * Accept an inbound `/multisig/rot` request as an existing group member.
 */
export function* acceptMultisigRotationService({
    client,
    input,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    input: MultisigRequestActionInput;
    logger?: OperationLogger;
    onPhase?: MultisigOperationPhaseReporter;
}): EffectionOperation<MultisigOperationResult> {
    onPhase?.('loading multisig rotation request');
    const response = yield* callPromise(() =>
        client.groups().getRequest(input.exnSaid)
    );
    const request = assertMultisigRot(response[0]);
    const rot = request.exn.e.rot;
    const smids = unique(request.exn.a.smids);
    const rmids = unique(request.exn.a.rmids ?? smids);
    requireMemberAids('signing', smids, input.groupAlias);
    requireMemberAids('next rotation', rmids, input.groupAlias);
    const memberHab = yield* getIdentifierService({
        client,
        aid: input.localMemberName,
    });
    onPhase?.('refreshing rotation key states');
    yield* refreshMemberKeyStatesService({
        client,
        memberAids: [...smids, ...rmids],
        logger,
        onPhase,
    });
    onPhase?.('loading rotation key states');
    const states = yield* getKeyStatesService({ client, memberAids: smids });
    const rstates = yield* getKeyStatesService({ client, memberAids: rmids });
    const result = yield* callPromise(() =>
        client.identifiers().rotate(input.groupAlias, {
            states,
            rstates,
            nsith: rot.nt as string | number | string[] | undefined,
        })
    );
    const operation = yield* eventResultOperation(result);
    const sent = yield* callPromise(() =>
        client.exchanges().send(
            memberHab.name,
            input.groupAlias,
            memberHab,
            MULTISIG_ROT_ROUTE,
            { gid: result.serder.pre, smids, rmids },
            eventEmbeds(result, 'rot'),
            unique([...smids, ...rmids]).filter((aid) => aid !== memberHab.prefix)
        )
    );

    onPhase?.('waiting for multisig rotation', operationName(operation));
    yield* waitOperationService({
        client,
        operation,
        label: `accepting multisig rotation for ${input.groupAlias}`,
        logger,
    });

    return completionResult({
        groupAlias: input.groupAlias,
        groupAid: result.serder.pre,
        localMemberAid: memberHab.prefix,
        exchangeSaid: exchangeSaid(sent) ?? input.exnSaid,
        operations: [operation],
    });
}

/**
 * Join an existing group when a rotation has made this member part of `smids`.
 */
export function* joinMultisigRotationService({
    client,
    input,
    logger,
    onPhase,
}: {
    client: SignifyClient;
    input: MultisigRequestActionInput;
    logger?: OperationLogger;
    onPhase?: MultisigOperationPhaseReporter;
}): EffectionOperation<MultisigOperationResult> {
    onPhase?.('loading multisig rotation join request');
    const response = yield* callPromise(() =>
        client.groups().getRequest(input.exnSaid)
    );
    const request = assertMultisigRot(response[0]);
    const exn = request.exn;
    const serder = new Serder(exn.e.rot);
    const memberHab = yield* getIdentifierService({
        client,
        aid: input.localMemberName,
    });
    if (client.manager === null) {
        throw new Error('Connected Signify client is missing a key manager.');
    }

    const keeper = client.manager.get(memberHab);
    const sigs = yield* callPromise(() => keeper.sign(b(serder.raw)));
    const smids = unique(exn.a.smids);
    const rmids = unique(exn.a.rmids ?? smids);
    const operation = yield* callPromise(() =>
        client
            .groups()
            .join(input.groupAlias, serder, sigs, exn.a.gid, smids, rmids)
    );

    onPhase?.('waiting for multisig rotation join', operationName(operation));
    yield* waitOperationService({
        client,
        operation,
        label: `joining multisig group ${input.groupAlias}`,
        logger,
    });

    const group = yield* getIdentifierService({ client, aid: input.groupAlias });
    return completionResult({
        groupAlias: input.groupAlias,
        groupAid: group.prefix,
        localMemberAid: memberHab.prefix,
        exchangeSaid: input.exnSaid,
        operations: [operation],
    });
}

/**
 * Derive a rotation draft for the current group if the UI only supplies next
 * members. Exposed for route tests and future UI helpers.
 */
export const multisigRotationDraftFromMembers = ({
    groupAlias,
    signingMemberAids,
    rotationMemberAids,
    nextThreshold,
    localMemberName = null,
}: {
    groupAlias: string;
    signingMemberAids: readonly string[];
    rotationMemberAids: readonly string[];
    nextThreshold: MultisigRotationDraft['nextThreshold'];
    localMemberName?: string | null;
}): MultisigRotationDraft => ({
    groupAlias,
    localMemberName,
    signingMemberAids: unique(signingMemberAids),
    rotationMemberAids: unique(
        rotationMemberAids.length > 0
            ? rotationMemberAids
            : thresholdSpecMemberAids(nextThreshold)
    ),
    nextThreshold,
});

export function* listMultisigGroupsService({
    client,
}: {
    client: SignifyClient;
}): EffectionOperation<HabState[]> {
    const identifiers = yield* listIdentifiersService({ client });
    return identifiers.filter((identifier) => 'group' in identifier);
}
