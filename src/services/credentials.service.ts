import { sleep, type Operation as EffectionOperation } from 'effection';
import {
    Serder,
    type CredentialResult,
    type CredentialState,
    type CredentialSubject,
    type Operation as KeriaOperation,
    type Registry,
    type Schema,
    type SignifyClient,
} from 'signify-ts';
import { callPromise, toErrorText } from '../effects/promise';
import type { OperationLogger } from '../signify/client';
import type {
    CredentialIpexActivityRecord,
    CredentialSummaryRecord,
    SediVoterCredentialAttributes,
} from '../state/credentials.slice';
import type {
    CredentialAdmitNotification,
    CredentialGrantNotification,
    NotificationRecord,
} from '../state/notifications.slice';
import type { IssueableCredentialTypeRecord } from '../state/issueableCredentialTypes';
import type { RegistryRecord } from '../state/registry.slice';
import type { SchemaRecord } from '../state/schema.slice';
import { waitOperationService } from './signify.service';

export const IPEX_GRANT_EXN_ROUTE = '/ipex/grant';
export const IPEX_ADMIT_EXN_ROUTE = '/ipex/admit';
export const IPEX_GRANT_NOTIFICATION_ROUTE = '/exn/ipex/grant';
export const IPEX_ADMIT_NOTIFICATION_ROUTE = '/exn/ipex/admit';

const DEFAULT_REGISTRY_NAME = 'sedi-voter-registry';
const CREDENTIAL_FETCH_RETRIES = 10;
const CREDENTIAL_FETCH_RETRY_MS = 1000;
const EXCHANGE_QUERY_LIMIT = 200;

type SerderSad = ConstructorParameters<typeof Serder>[0];

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const stringValue = (value: unknown): string | null =>
    typeof value === 'string' && value.trim().length > 0
        ? value.trim()
        : null;

const booleanValue = (value: unknown): boolean | null =>
    typeof value === 'boolean' ? value : null;

const requireNonEmpty = (value: string, label: string): string => {
    const normalized = value.trim();
    if (normalized.length === 0) {
        throw new Error(`${label} is required.`);
    }

    return normalized;
};

const requireRecord = (
    value: unknown,
    label: string
): Record<string, unknown> => {
    if (!isRecord(value)) {
        throw new Error(`${label} is missing or malformed.`);
    }

    return value;
};

const serderSad = (value: unknown, label: string): SerderSad =>
    requireRecord(value, label) as SerderSad;

const recordString = (
    record: Record<string, unknown>,
    key: string
): string | null => stringValue(record[key]);

const recordDate = (
    record: Record<string, unknown>,
    key: string
): string | null => stringValue(record[key]);

const exchangeItemsFromResponse = (raw: unknown): unknown[] => {
    if (Array.isArray(raw)) {
        return raw;
    }

    if (isRecord(raw)) {
        for (const key of ['exchanges', 'exns', 'items']) {
            const value = raw[key];
            if (Array.isArray(value)) {
                return value;
            }
        }
    }

    return [];
};

const exchangeExn = (exchange: unknown): Record<string, unknown> =>
    requireRecord(requireRecord(exchange, 'Exchange resource').exn, 'EXN');

const exchangeRoute = (exchange: unknown): string | null =>
    recordString(exchangeExn(exchange), 'r');

const schemaText = (schema: Schema, key: string): string | null =>
    stringValue((schema as Record<string, unknown>)[key]);

const schemaRules = (schema: Schema): Record<string, unknown> | null => {
    const rules = (schema as Record<string, unknown>).rules;
    return isRecord(rules) ? rules : null;
};

const registryString = (registry: Registry, key: string): string | null =>
    stringValue((registry as Record<string, unknown>)[key]);

const registryNameFromKeriaRegistry = (registry: Registry): string | null =>
    registryString(registry, 'name') ?? registryString(registry, 'registryName');

const registryRecordFromKeriaRegistry = ({
    registry,
    issuerAlias,
    issuerAid,
    updatedAt,
}: {
    registry: Registry;
    issuerAlias: string;
    issuerAid: string;
    updatedAt: string;
}): RegistryRecord => {
    const regk = registryString(registry, 'regk');
    if (regk === null) {
        throw new Error('Credential registry is missing its registry key.');
    }

    return {
        id: regk,
        name: issuerAlias,
        registryName: registryNameFromKeriaRegistry(registry) ?? regk,
        regk,
        issuerAlias,
        issuerAid,
        status: 'ready',
        error: null,
        updatedAt,
    };
};

const keriaTimestamp = (): string =>
    new Date().toISOString().replace('Z', '000+00:00');

const credentialSad = (credential: CredentialResult): Record<string, unknown> =>
    requireRecord(credential.sad, 'Credential SAD');

const credentialSubject = (
    credential: CredentialResult
): Record<string, unknown> | null => {
    const sad = credentialSad(credential);
    return isRecord(sad.a) ? sad.a : null;
};

const credentialSaid = (credential: CredentialResult): string => {
    const said = recordString(credentialSad(credential), 'd');
    if (said === null) {
        throw new Error('Credential is missing its SAID.');
    }

    return said;
};

const ipexActivityDirection = ({
    localAids,
    senderAid,
    recipientAid,
}: {
    localAids: ReadonlySet<string>;
    senderAid: string | null;
    recipientAid: string | null;
}): CredentialIpexActivityRecord['direction'] => {
    if (senderAid !== null && localAids.has(senderAid)) {
        return 'sent';
    }

    if (recipientAid !== null && localAids.has(recipientAid)) {
        return 'received';
    }

    return 'unknown';
};

const stateEventType = (state: CredentialState | null): string | null =>
    state === null ? null : stringValue((state as Record<string, unknown>).et);

const statusFromCredentialState = (
    state: CredentialState | null,
    admitted: boolean
): CredentialSummaryRecord['status'] => {
    const eventType = stateEventType(state);
    if (eventType === 'rev') {
        return 'revoked';
    }

    return admitted ? 'admitted' : 'issued';
};

const normalizeDateTime = (value: string, label: string): string => {
    const normalized = requireNonEmpty(value, label);
    const parsed = Date.parse(normalized);
    if (!Number.isFinite(parsed)) {
        throw new Error(`${label} must be an ISO date time.`);
    }

    return normalized;
};

export const normalizeSediVoterAttributes = (
    input: SediVoterCredentialAttributes
): SediVoterCredentialAttributes => ({
    i: requireNonEmpty(input.i, 'Holder AID'),
    fullName: requireNonEmpty(input.fullName, 'Full name'),
    voterId: requireNonEmpty(input.voterId, 'Voter id'),
    precinctId: requireNonEmpty(input.precinctId, 'Precinct id'),
    county: requireNonEmpty(input.county, 'County'),
    jurisdiction: requireNonEmpty(input.jurisdiction, 'Jurisdiction'),
    electionId: requireNonEmpty(input.electionId, 'Election id'),
    eligible: input.eligible,
    expires: normalizeDateTime(input.expires, 'Expires'),
});

const sediAttributesFromSubject = (
    subject: Record<string, unknown> | null
): SediVoterCredentialAttributes | null => {
    if (subject === null) {
        return null;
    }

    const holderAid = recordString(subject, 'i');
    const fullName = recordString(subject, 'fullName');
    const voterId = recordString(subject, 'voterId');
    const precinctId = recordString(subject, 'precinctId');
    const county = recordString(subject, 'county');
    const jurisdiction = recordString(subject, 'jurisdiction');
    const electionId = recordString(subject, 'electionId');
    const eligible = booleanValue(subject.eligible);
    const expires = recordString(subject, 'expires');

    if (
        holderAid === null ||
        fullName === null ||
        voterId === null ||
        precinctId === null ||
        county === null ||
        jurisdiction === null ||
        electionId === null ||
        eligible === null ||
        expires === null
    ) {
        return null;
    }

    return {
        i: holderAid,
        fullName,
        voterId,
        precinctId,
        county,
        jurisdiction,
        electionId,
        eligible,
        expires,
    };
};

const serializableAttributes = (
    subject: Record<string, unknown> | null
): Record<string, string | boolean> => {
    if (subject === null) {
        return {};
    }

    return Object.fromEntries(
        Object.entries(subject).flatMap(([key, value]) =>
            typeof value === 'string' || typeof value === 'boolean'
                ? [[key, value]]
                : []
        )
    );
};

export const credentialRecordFromKeriaCredential = ({
    credential,
    direction,
    status,
    grantSaid = null,
    admitSaid = null,
    notificationId = null,
    issuedAt = null,
    grantedAt = null,
    admittedAt = null,
    updatedAt = new Date().toISOString(),
    error = null,
}: {
    credential: CredentialResult;
    direction: CredentialSummaryRecord['direction'];
    status: CredentialSummaryRecord['status'];
    grantSaid?: string | null;
    admitSaid?: string | null;
    notificationId?: string | null;
    issuedAt?: string | null;
    grantedAt?: string | null;
    admittedAt?: string | null;
    updatedAt?: string;
    error?: string | null;
}): CredentialSummaryRecord => {
    const sad = credentialSad(credential);
    const subject = credentialSubject(credential);
    const said = credentialSaid(credential);

    return {
        said,
        schemaSaid: recordString(sad, 's'),
        registryId: recordString(sad, 'ri'),
        issuerAid: recordString(sad, 'i'),
        holderAid: subject === null ? null : recordString(subject, 'i'),
        direction,
        status,
        grantSaid,
        admitSaid,
        notificationId,
        issuedAt: issuedAt ?? (subject === null ? null : recordDate(subject, 'dt')),
        grantedAt,
        admittedAt,
        revokedAt: status === 'revoked' ? updatedAt : null,
        error,
        attributes: sediAttributesFromSubject(subject),
        updatedAt,
    };
};

export function* resolveCredentialSchemaService({
    client,
    schemaSaid,
    schemaOobiUrl,
    logger,
}: {
    client: SignifyClient;
    schemaSaid: string;
    schemaOobiUrl: string;
    logger?: OperationLogger;
}): EffectionOperation<SchemaRecord> {
    const said = requireNonEmpty(schemaSaid, 'Schema SAID');
    const oobi = requireNonEmpty(schemaOobiUrl, 'Schema OOBI URL');
    const operation = yield* callPromise(() =>
        client.oobis().resolve(oobi, 'sedi-voter-id-schema')
    );

    yield* waitOperationService({
        client,
        operation,
        label: 'resolving SEDI voter credential schema',
        logger,
    });

    const schema = yield* callPromise(() => client.schemas().get(said));
    const updatedAt = new Date().toISOString();
    return {
        said,
        oobi,
        status: 'resolved',
        title: schemaText(schema, 'title'),
        description: schemaText(schema, 'description'),
        version: schemaText(schema, 'version'),
        rules: schemaRules(schema),
        error: null,
        updatedAt,
    };
}

export function* listKnownCredentialSchemasService({
    client,
    credentialTypes,
}: {
    client: SignifyClient;
    credentialTypes: readonly IssueableCredentialTypeRecord[];
}): EffectionOperation<SchemaRecord[]> {
    const schemas: SchemaRecord[] = [];
    for (const credentialType of credentialTypes) {
        try {
            const schema = yield* callPromise(() =>
                client.schemas().get(credentialType.schemaSaid)
            );
            schemas.push({
                said: credentialType.schemaSaid,
                oobi: credentialType.schemaOobiUrl,
                status: 'resolved',
                title: schemaText(schema, 'title'),
                description: schemaText(schema, 'description'),
                version: schemaText(schema, 'version'),
                rules: schemaRules(schema),
                error: null,
                updatedAt: new Date().toISOString(),
            });
        } catch {
            // Unknown schemas are expected before the user adds a credential type.
        }
    }

    return schemas;
}

export function* createCredentialRegistryService({
    client,
    issuerAlias,
    issuerAid,
    registryName = DEFAULT_REGISTRY_NAME,
    nonce,
    logger,
}: {
    client: SignifyClient;
    issuerAlias: string;
    issuerAid: string;
    registryName?: string;
    nonce?: string;
    logger?: OperationLogger;
}): EffectionOperation<RegistryRecord> {
    const name = requireNonEmpty(issuerAlias, 'Issuer identifier');
    const aid = requireNonEmpty(issuerAid, 'Issuer AID');
    const normalizedRegistryName = requireNonEmpty(
        registryName,
        'Registry name'
    );

    const registries = yield* callPromise(() =>
        client.registries().list(name)
    );
    const existing =
        registries.find(
            (registry) =>
                registryString(registry, 'name') === normalizedRegistryName ||
                registryString(registry, 'registryName') ===
                    normalizedRegistryName
        ) ?? null;

    if (existing !== null) {
        return registryRecordFromKeriaRegistry({
            registry: existing,
            issuerAlias: name,
            issuerAid: aid,
            updatedAt: new Date().toISOString(),
        });
    }

    const result = yield* callPromise(() =>
        client.registries().create({
            name,
            registryName: normalizedRegistryName,
            nonce: nonce?.trim() || `${normalizedRegistryName}-${Date.now()}`,
        })
    );
    const operation = yield* callPromise(() => result.op());
    yield* waitOperationService({
        client,
        operation,
        label: `creating credential registry ${normalizedRegistryName}`,
        logger,
    });

    const refreshed = yield* callPromise(() => client.registries().list(name));
    const registry =
        refreshed.find(
            (candidate) =>
                registryString(candidate, 'name') === normalizedRegistryName ||
                registryString(candidate, 'registryName') ===
                    normalizedRegistryName
        ) ?? refreshed[refreshed.length - 1];
    if (registry === undefined) {
        throw new Error('KERIA did not return the created registry.');
    }

    return registryRecordFromKeriaRegistry({
        registry,
        issuerAlias: name,
        issuerAid: aid,
        updatedAt: new Date().toISOString(),
    });
}

export interface CredentialRegistryOwner {
    issuerAlias: string;
    issuerAid: string;
}

export interface CredentialRegistryInventorySnapshot {
    registries: RegistryRecord[];
    loadedAt: string;
}

export function* listCredentialRegistriesService({
    client,
    identifiers,
}: {
    client: SignifyClient;
    identifiers: readonly CredentialRegistryOwner[];
}): EffectionOperation<CredentialRegistryInventorySnapshot> {
    const loadedAt = new Date().toISOString();
    const records = new Map<string, RegistryRecord>();

    for (const identifier of identifiers) {
        const issuerAlias = identifier.issuerAlias.trim();
        const issuerAid = identifier.issuerAid.trim();
        if (issuerAlias.length === 0 || issuerAid.length === 0) {
            continue;
        }

        const registries = yield* callPromise(() =>
            client.registries().list(issuerAlias)
        );
        for (const registry of registries) {
            const record = registryRecordFromKeriaRegistry({
                registry,
                issuerAlias,
                issuerAid,
                updatedAt: loadedAt,
            });
            records.set(record.id, record);
        }
    }

    return {
        registries: [...records.values()],
        loadedAt,
    };
}

export function* issueSediCredentialService({
    client,
    issuerAlias,
    issuerAid,
    holderAid,
    registryId,
    schemaSaid,
    attributes,
    logger,
}: {
    client: SignifyClient;
    issuerAlias: string;
    issuerAid: string;
    holderAid: string;
    registryId: string;
    schemaSaid: string;
    attributes: SediVoterCredentialAttributes;
    logger?: OperationLogger;
}): EffectionOperation<CredentialSummaryRecord> {
    const name = requireNonEmpty(issuerAlias, 'Issuer identifier');
    const normalizedIssuerAid = requireNonEmpty(issuerAid, 'Issuer AID');
    const normalizedHolderAid = requireNonEmpty(holderAid, 'Holder AID');
    const ri = requireNonEmpty(registryId, 'Registry id');
    const schema = requireNonEmpty(schemaSaid, 'Schema SAID');
    const subject = normalizeSediVoterAttributes({
        ...attributes,
        i: normalizedHolderAid,
    });
    const issueSubject: CredentialSubject = { ...subject };

    const result = yield* callPromise(() =>
        client.credentials().issue(name, {
            i: normalizedIssuerAid,
            ri,
            s: schema,
            a: issueSubject,
        })
    );
    yield* waitOperationService({
        client,
        operation: result.op as KeriaOperation,
        label: `issuing credential to ${normalizedHolderAid}`,
        logger,
    });

    const acdcSad = requireRecord(result.acdc.sad, 'Issued credential ACDC');
    const said = recordString(acdcSad, 'd');
    if (said === null) {
        throw new Error('Issued credential response did not include a SAID.');
    }

    const credential = yield* callPromise(() =>
        client.credentials().get(said)
    );
    return credentialRecordFromKeriaCredential({
        credential,
        direction: 'issued',
        status: 'issued',
    });
}

export function* grantIssuedCredentialService({
    client,
    issuerAlias,
    issuerAid,
    holderAid,
    credentialSaid,
    logger,
}: {
    client: SignifyClient;
    issuerAlias: string;
    issuerAid: string;
    holderAid: string;
    credentialSaid: string;
    logger?: OperationLogger;
}): EffectionOperation<CredentialSummaryRecord> {
    const name = requireNonEmpty(issuerAlias, 'Issuer identifier');
    const normalizedIssuerAid = requireNonEmpty(issuerAid, 'Issuer AID');
    const recipient = requireNonEmpty(holderAid, 'Holder AID');
    const said = requireNonEmpty(credentialSaid, 'Credential SAID');
    const credential = yield* callPromise(() => client.credentials().get(said));
    const [grant, signatures, attachment] = yield* callPromise(() =>
        client.ipex().grant({
            senderName: name,
            recipient,
            acdc: new Serder(serderSad(credential.sad, 'Credential SAD')),
            anc: new Serder(serderSad(credential.anc, 'Credential anchor')),
            iss: new Serder(serderSad(credential.iss, 'Credential issue event')),
            ancAttachment: stringValue(credential.ancatc) ?? undefined,
            datetime: keriaTimestamp(),
        })
    );
    const operation = yield* callPromise(() =>
        client
            .ipex()
            .submitGrant(name, grant, signatures, attachment, [recipient])
    );
    yield* waitOperationService({
        client,
        operation,
        label: `granting credential ${said} to ${recipient}`,
        logger,
    });

    const grantSad = requireRecord(grant.sad, 'Grant EXN');
    const grantSaid = recordString(grantSad, 'd');
    if (grantSaid === null) {
        throw new Error('Grant EXN did not include a SAID.');
    }

    return {
        ...credentialRecordFromKeriaCredential({
            credential,
            direction: 'issued',
            status: 'grantSent',
            grantSaid,
            grantedAt: recordDate(grantSad, 'dt') ?? new Date().toISOString(),
        }),
        issuerAid: normalizedIssuerAid,
        holderAid: recipient,
    };
}

export const credentialGrantFromExchange = ({
    notification,
    exchange,
    localAids,
    loadedAt,
}: {
    notification: NotificationRecord;
    exchange: unknown;
    localAids: ReadonlySet<string>;
    loadedAt: string;
}): CredentialGrantNotification => {
    const exn = requireRecord(
        requireRecord(exchange, 'Credential grant exchange').exn,
        'Credential grant EXN'
    );
    const route = recordString(exn, 'r');
    if (route !== IPEX_GRANT_EXN_ROUTE) {
        throw new Error(
            `Expected ${IPEX_GRANT_EXN_ROUTE} EXN, received ${route ?? 'unknown route'}.`
        );
    }

    const embeds = requireRecord(exn.e, 'Credential grant embeds');
    const acdc = requireRecord(embeds.acdc, 'Credential grant ACDC');
    const subject = isRecord(acdc.a) ? acdc.a : null;
    const grantSaid = recordString(exn, 'd') ?? notification.anchorSaid;
    const issuerAid = recordString(exn, 'i');
    const holderAid = recordString(exn, 'rp');
    const credentialSaid = recordString(acdc, 'd');
    if (
        grantSaid === null ||
        issuerAid === null ||
        holderAid === null ||
        credentialSaid === null
    ) {
        throw new Error('Credential grant EXN is missing required AIDs or SAIDs.');
    }

    const inbound =
        localAids.size === 0 || localAids.has(holderAid)
            ? 'actionable'
            : 'notForThisWallet';

    return {
        notificationId: notification.id,
        grantSaid,
        issuerAid,
        holderAid,
        credentialSaid,
        schemaSaid: recordString(acdc, 's'),
        attributes: serializableAttributes(subject),
        createdAt: recordString(exn, 'dt') ?? notification.dt ?? loadedAt,
        status: notification.read && inbound === 'actionable' ? 'admitted' : inbound,
    };
};

export const credentialAdmitFromExchange = ({
    notification,
    exchange,
    localAids,
    loadedAt,
}: {
    notification: NotificationRecord;
    exchange: unknown;
    localAids: ReadonlySet<string>;
    loadedAt: string;
}): CredentialAdmitNotification => {
    const exn = requireRecord(
        requireRecord(exchange, 'Credential admit exchange').exn,
        'Credential admit EXN'
    );
    const route = recordString(exn, 'r');
    if (route !== IPEX_ADMIT_EXN_ROUTE) {
        throw new Error(
            `Expected ${IPEX_ADMIT_EXN_ROUTE} EXN, received ${route ?? 'unknown route'}.`
        );
    }

    const admitSaid = recordString(exn, 'd') ?? notification.anchorSaid;
    const holderAid = recordString(exn, 'i');
    const issuerAid = recordString(exn, 'rp');
    if (admitSaid === null || holderAid === null) {
        throw new Error('Credential admit EXN is missing required AIDs or SAIDs.');
    }

    return {
        notificationId: notification.id,
        admitSaid,
        grantSaid: recordString(exn, 'p'),
        issuerAid,
        holderAid,
        createdAt: recordString(exn, 'dt') ?? notification.dt ?? loadedAt,
        status:
            localAids.size === 0 || issuerAid === null || localAids.has(issuerAid)
                ? 'received'
                : 'notForThisWallet',
    };
};

function* queryExchangesByRoute({
    client,
    route,
}: {
    client: SignifyClient;
    route: string;
}): EffectionOperation<unknown[]> {
    const raw: unknown = yield* callPromise(() =>
        client
            .fetch('/exchanges/query', 'POST', {
                filter: {
                    '-r': route,
                },
                limit: EXCHANGE_QUERY_LIMIT,
            })
            .then((response) => response.json())
    );

    return exchangeItemsFromResponse(raw).filter((exchange) => {
        try {
            return exchangeRoute(exchange) === route;
        } catch {
            return false;
        }
    });
}

export function* listCredentialIpexActivityService({
    client,
    credentials,
    localAids,
}: {
    client: SignifyClient;
    credentials: readonly CredentialSummaryRecord[];
    localAids: readonly string[];
}): EffectionOperation<CredentialIpexActivityRecord[]> {
    const credentialSaids = new Set(
        credentials
            .map((credential) => credential.said.trim())
            .filter((said) => said.length > 0)
    );
    if (credentialSaids.size === 0) {
        return [];
    }

    const localAidSet = new Set(
        localAids.map((aid) => aid.trim()).filter((aid) => aid.length > 0)
    );
    const loadedAt = new Date().toISOString();
    const grantToCredentialSaid = new Map<string, string>();
    for (const credential of credentials) {
        if (credential.grantSaid !== null) {
            grantToCredentialSaid.set(credential.grantSaid, credential.said);
        }
    }

    const activities = new Map<string, CredentialIpexActivityRecord>();
    const grantExchanges = yield* queryExchangesByRoute({
        client,
        route: IPEX_GRANT_EXN_ROUTE,
    });

    for (const exchange of grantExchanges) {
        try {
            const exn = exchangeExn(exchange);
            const embeds = requireRecord(exn.e, 'Grant embeds');
            const acdc = requireRecord(embeds.acdc, 'Grant ACDC');
            const credentialSaid = recordString(acdc, 'd');
            const exchangeSaid = recordString(exn, 'd');
            if (
                credentialSaid === null ||
                exchangeSaid === null ||
                !credentialSaids.has(credentialSaid)
            ) {
                continue;
            }

            const senderAid = recordString(exn, 'i');
            const recipientAid = recordString(exn, 'rp');
            grantToCredentialSaid.set(exchangeSaid, credentialSaid);
            activities.set(`${credentialSaid}:${exchangeSaid}`, {
                id: `${credentialSaid}:${exchangeSaid}`,
                credentialSaid,
                exchangeSaid,
                route: IPEX_GRANT_EXN_ROUTE,
                kind: 'grant',
                direction: ipexActivityDirection({
                    localAids: localAidSet,
                    senderAid,
                    recipientAid,
                }),
                senderAid,
                recipientAid,
                linkedGrantSaid: exchangeSaid,
                createdAt: recordDate(exn, 'dt'),
                updatedAt: loadedAt,
            });
        } catch {
            // Ignore malformed or older exchange records that do not match the
            // current IPEX grant shape.
        }
    }

    const admitToCredentialSaid = new Map<string, string>();
    for (const credential of credentials) {
        if (credential.admitSaid !== null) {
            admitToCredentialSaid.set(credential.admitSaid, credential.said);
        }
    }

    const admitExchanges = yield* queryExchangesByRoute({
        client,
        route: IPEX_ADMIT_EXN_ROUTE,
    });

    for (const exchange of admitExchanges) {
        try {
            const exn = exchangeExn(exchange);
            const exchangeSaid = recordString(exn, 'd');
            if (exchangeSaid === null) {
                continue;
            }

            const linkedGrantSaid = recordString(exn, 'p');
            const credentialSaid =
                (linkedGrantSaid === null
                    ? null
                    : grantToCredentialSaid.get(linkedGrantSaid)) ??
                admitToCredentialSaid.get(exchangeSaid) ??
                null;
            if (
                credentialSaid === null ||
                !credentialSaids.has(credentialSaid)
            ) {
                continue;
            }

            const senderAid = recordString(exn, 'i');
            const recipientAid = recordString(exn, 'rp');
            activities.set(`${credentialSaid}:${exchangeSaid}`, {
                id: `${credentialSaid}:${exchangeSaid}`,
                credentialSaid,
                exchangeSaid,
                route: IPEX_ADMIT_EXN_ROUTE,
                kind: 'admit',
                direction: ipexActivityDirection({
                    localAids: localAidSet,
                    senderAid,
                    recipientAid,
                }),
                senderAid,
                recipientAid,
                linkedGrantSaid,
                createdAt: recordDate(exn, 'dt'),
                updatedAt: loadedAt,
            });
        } catch {
            // Ignore malformed or older exchange records that do not match the
            // current IPEX admit shape.
        }
    }

    return Array.from(activities.values()).sort((left, right) => {
        if (left.createdAt === null && right.createdAt === null) {
            return left.exchangeSaid.localeCompare(right.exchangeSaid);
        }

        if (left.createdAt === null) {
            return 1;
        }

        if (right.createdAt === null) {
            return -1;
        }

        return left.createdAt.localeCompare(right.createdAt);
    });
}

function* fetchCredentialWithRetry({
    client,
    credentialSaid,
}: {
    client: SignifyClient;
    credentialSaid: string;
}): EffectionOperation<CredentialResult> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < CREDENTIAL_FETCH_RETRIES; attempt += 1) {
        try {
            return yield* callPromise(() =>
                client.credentials().get(credentialSaid)
            );
        } catch (error) {
            lastError = error;
            yield* sleep(CREDENTIAL_FETCH_RETRY_MS);
        }
    }

    throw new Error(
        `Credential ${credentialSaid} was not available after admit: ${toErrorText(lastError)}`
    );
}

export function* admitCredentialGrantService({
    client,
    holderAlias,
    holderAid,
    notificationId,
    grantSaid,
    logger,
}: {
    client: SignifyClient;
    holderAlias: string;
    holderAid: string;
    notificationId: string;
    grantSaid: string;
    logger?: OperationLogger;
}): EffectionOperation<CredentialSummaryRecord> {
    const name = requireNonEmpty(holderAlias, 'Holder identifier');
    const localHolderAid = requireNonEmpty(holderAid, 'Holder AID');
    const noteId = requireNonEmpty(notificationId, 'Notification id');
    const grantId = requireNonEmpty(grantSaid, 'Grant SAID');
    const exchange = yield* callPromise(() => client.exchanges().get(grantId));
    const grant = credentialGrantFromExchange({
        notification: {
            id: noteId,
            dt: null,
            read: false,
            route: IPEX_GRANT_NOTIFICATION_ROUTE,
            anchorSaid: grantId,
            status: 'unread',
            message: null,
            updatedAt: new Date().toISOString(),
        },
        exchange,
        localAids: new Set([localHolderAid]),
        loadedAt: new Date().toISOString(),
    });

    if (grant.holderAid !== localHolderAid) {
        throw new Error(
            `Credential grant is addressed to ${grant.holderAid}, not local holder ${localHolderAid}.`
        );
    }

    const [admit, signatures, attachment] = yield* callPromise(() =>
        client.ipex().admit({
            senderName: name,
            message: '',
            grantSaid: grant.grantSaid,
            recipient: grant.issuerAid,
            datetime: keriaTimestamp(),
        })
    );
    const operation = yield* callPromise(() =>
        client
            .ipex()
            .submitAdmit(name, admit, signatures, attachment, [grant.issuerAid])
    );
    yield* waitOperationService({
        client,
        operation,
        label: `admitting credential ${grant.credentialSaid}`,
        logger,
    });

    try {
        yield* callPromise(() => client.notifications().mark(noteId));
    } finally {
        try {
            yield* callPromise(() => client.notifications().delete(noteId));
        } catch {
            // A completed admit is authoritative for wallet state; KERIA
            // notification deletion is cleanup and may already have happened.
        }
    }

    const admitted = yield* fetchCredentialWithRetry({
        client,
        credentialSaid: grant.credentialSaid,
    });
    const admitSad = requireRecord(admit.sad, 'Admit EXN');

    return credentialRecordFromKeriaCredential({
        credential: admitted,
        direction: 'held',
        status: 'admitted',
        grantSaid: grant.grantSaid,
        admitSaid: recordString(admitSad, 'd'),
        notificationId: noteId,
        admittedAt: recordDate(admitSad, 'dt') ?? new Date().toISOString(),
    });
}

export function* listCredentialInventoryService({
    client,
    localAids,
}: {
    client: SignifyClient;
    localAids: readonly string[];
}): EffectionOperation<CredentialSummaryRecord[]> {
    const localAidSet = new Set(
        localAids.map((aid) => aid.trim()).filter((aid) => aid.length > 0)
    );
    if (localAidSet.size === 0) {
        return [];
    }

    const records = new Map<string, CredentialSummaryRecord>();
    for (const localAid of localAidSet) {
        const issuedCredentials = yield* callPromise(() =>
            client.credentials().list({ filter: { '-i': localAid } })
        );
        for (const credential of issuedCredentials) {
            const said = credentialSaid(credential);
            const sad = credentialSad(credential);
            const ri = recordString(sad, 'ri');
            let state: CredentialState | null = null;
            if (ri !== null) {
                try {
                    state = yield* callPromise(() =>
                        client.credentials().state(ri, said)
                    );
                } catch {
                    state = null;
                }
            }

            records.set(
                `issued:${said}`,
                credentialRecordFromKeriaCredential({
                    credential,
                    direction: 'issued',
                    status: statusFromCredentialState(state, false),
                })
            );
        }

        const heldCredentials = yield* callPromise(() =>
            client.credentials().list({ filter: { '-a-i': localAid } })
        );
        for (const credential of heldCredentials) {
            const said = credentialSaid(credential);
            const sad = credentialSad(credential);
            const ri = recordString(sad, 'ri');
            let state: CredentialState | null = null;
            if (ri !== null) {
                try {
                    state = yield* callPromise(() =>
                        client.credentials().state(ri, said)
                    );
                } catch {
                    state = null;
                }
            }

            records.set(
                `held:${said}`,
                credentialRecordFromKeriaCredential({
                    credential,
                    direction: 'held',
                    status: statusFromCredentialState(state, true),
                })
            );
        }
    }

    return Array.from(records.values());
}
