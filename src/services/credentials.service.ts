import { sleep, type Operation as EffectionOperation } from 'effection';
import {
    Serder,
    type CredentialResult,
    type CredentialState,
    type CredentialSubject,
    type Operation as KeriaOperation,
    type SignifyClient,
} from 'signify-ts';
import {
    issueW3CCredential,
    presentW3CCredential,
    W3CKeriaClient,
    type W3CHeldCredential,
    type W3CIssuanceContext,
    type W3CPresentationResult,
} from '../integrations/signifyW3c';
import { ensureDidWebsSetup } from 'signify-did-webs';
import { callPromise, toErrorText } from '../effects/promise';
import type { OperationLogger } from '../signify/client';
import type {
    CredentialInventorySnapshot,
    CredentialRegistryInventorySnapshot,
    CredentialRegistryOwner,
    CredentialAcdcRecord,
    CredentialChainGraphRecord,
    CredentialIpexActivityRecord,
    CredentialSummaryRecord,
    RegistryRecord,
    SchemaRecord,
} from '../domain/credentials/credentialTypes';
import type { IssueableCredentialTypeRecord } from '../domain/credentials/credentialCatalog';
import type { SediVoterCredentialAttributes } from '../domain/credentials/sediVoterId';
import {
    credentialGrantFromExchange,
    credentialAcdcRecordFromKeriaCredential,
    credentialChainGraphFromKeriaCredential,
    credentialChains,
    credentialRecordFromKeriaCredential,
    credentialSad,
    credentialSchema,
    credentialSaid,
    exchangeExn,
    exchangeItemsFromResponse,
    exchangeRoute,
    ipexActivityDirection,
    IPEX_ADMIT_EXN_ROUTE,
    IPEX_GRANT_EXN_ROUTE,
    recordDate,
    recordString,
    registryRecordFromKeriaRegistry,
    registryString,
    requireNonEmpty,
    requireRecord,
    schemaRecordFromKeriaSchema,
    serderSad,
    statusFromCredentialState,
    stringValue,
} from '../domain/credentials/credentialMappings';
import {
    normalizeSediVoterAttributes,
    SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME,
    SEDI_VOTER_ID_SCHEMA_OOBI_ALIAS,
} from '../domain/credentials/sediVoterId';
import { ISSUEABLE_CREDENTIAL_TYPES } from '../config/credentialCatalog';
import { waitOperationService } from './signify.service';

const DEFAULT_REGISTRY_NAME = SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME;
const CREDENTIAL_FETCH_RETRIES = 10;
const CREDENTIAL_FETCH_RETRY_MS = 1000;
const EXCHANGE_QUERY_LIMIT = 200;

export type W3CIssuanceView = W3CIssuanceContext;

export interface W3CPresentTxView extends W3CPresentationResult {
    presentTxId: string;
    vcJwt: string | null;
    verifierRequest: Record<string, unknown>;
    submissionEndpoint: string | null;
    sourceCredentialSaid: string;
}

const keriaTimestamp = (): string =>
    new Date().toISOString().replace('Z', '000+00:00');

/**
 * Resolve a configured credential schema OOBI through KERIA and project the
 * resulting schema into app state shape.
 */
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
        client.oobis().resolve(oobi, SEDI_VOTER_ID_SCHEMA_OOBI_ALIAS)
    );

    yield* waitOperationService({
        client,
        operation,
        label: 'resolving SEDI voter credential schema',
        logger,
    });

    const schema = yield* callPromise(() => client.schemas().get(said));
    const updatedAt = new Date().toISOString();
    return schemaRecordFromKeriaSchema({
        schema,
        said,
        oobi,
        updatedAt,
    });
}

/**
 * Read all configured issueable credential schemas already known by KERIA.
 *
 * Missing schemas are normal before a user resolves a schema OOBI, so this
 * inventory service skips unknown catalog entries instead of failing refresh.
 */
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
            schemas.push(
                schemaRecordFromKeriaSchema({
                    schema,
                    said: credentialType.schemaSaid,
                    oobi: credentialType.schemaOobiUrl,
                    updatedAt: new Date().toISOString(),
                })
            );
        } catch {
            // Unknown schemas are expected before the user adds a credential type.
        }
    }

    return schemas;
}

/**
 * Create or rediscover the issuer's credential registry in KERIA.
 */
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

    const registries = yield* callPromise(() => client.registries().list(name));
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

/**
 * Load registries for local issuer identifiers and project them into Redux
 * facts without storing raw KERIA registry objects.
 */
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

/**
 * Issue the currently implemented SEDI Voter ID ACDC credential.
 *
 * This service stays schema-specific until another credential type has a real
 * issue flow; generic dispatch should happen above this boundary later.
 */
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

    const credential = yield* callPromise(() => client.credentials().get(said));
    return credentialRecordFromKeriaCredential({
        credential,
        credentialTypes: ISSUEABLE_CREDENTIAL_TYPES,
        direction: 'issued',
        status: 'issued',
    });
}

/**
 * Send an IPEX grant for an issued credential and return the updated local
 * credential projection for the issuer wallet.
 */
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
            iss: new Serder(
                serderSad(credential.iss, 'Credential issue event')
            ),
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
            credentialTypes: ISSUEABLE_CREDENTIAL_TYPES,
            direction: 'issued',
            status: 'grantSent',
            grantSaid,
            grantedAt: recordDate(grantSad, 'dt') ?? new Date().toISOString(),
        }),
        issuerAid: normalizedIssuerAid,
        holderAid: recipient,
    };
}

/**
 * Query KERIA exchanges by route through the generic fetch endpoint.
 */
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

/**
 * Build local IPEX grant/admit activity from exchange inventory for known
 * credentials.
 */
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

/**
 * Fetch an admitted credential after IPEX admit submission.
 *
 * KERIA may not expose the held credential immediately after the admit
 * operation completes, so the retry loop is scoped inside this service.
 */
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

/**
 * Admit an inbound IPEX credential grant as the holder and clean up the KERIA
 * notification after the admit operation succeeds.
 */
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
            anchorSaid: grantId,
        },
        exchange,
        localAids: new Set([localHolderAid]),
        credentialTypes: ISSUEABLE_CREDENTIAL_TYPES,
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
        credentialTypes: ISSUEABLE_CREDENTIAL_TYPES,
        direction: 'held',
        status: 'admitted',
        grantSaid: grant.grantSaid,
        admitSaid: recordString(admitSad, 'd'),
        notificationId: noteId,
        admittedAt: recordDate(admitSad, 'dt') ?? new Date().toISOString(),
    });
}

/**
 * Start QVI-side W3C VC-JWT issuance from a native VRD source credential.
 *
 * The browser edge runtime builds and signs the VC-JWT, submits it to KERIA
 * for validation, then signs the grant EXN that delivers the artifact.
 */
export function* startW3CIssuanceService({
    client,
    issuerAlias,
    issuerAid,
    credentialSaid,
    timeoutMs,
    pollMs,
}: {
    client: SignifyClient;
    issuerAlias: string;
    issuerAid: string;
    credentialSaid: string;
    timeoutMs: number;
    pollMs?: number;
}): EffectionOperation<W3CIssuanceView> {
    const name = requireNonEmpty(issuerAlias, 'Issuer identifier');
    requireNonEmpty(issuerAid, 'Issuer AID');
    const sourceSaid = requireNonEmpty(credentialSaid, 'Credential SAID');
    yield* callPromise(() =>
        ensureDidWebsSetup({
            client,
            name,
            timeoutMs,
            pollMs,
        })
    );
    return yield* callPromise(() =>
        issueW3CCredential({
            client,
            issuerName: name,
            sourceCredentialSaid: sourceSaid,
            timeoutMs,
            pollMs,
        })
    );
}

/**
 * Build and submit a holder-signed W3C VP-JWT from a runtime verifier request.
 *
 * The browser edge runtime owns VP assembly and signing. KERIA validates the
 * submitted VP-JWT against the selected held credential and verifier request,
 * forwards it, and records the result.
 */
export function* presentCredentialService({
    client,
    presenterAlias,
    presenterAid,
    credentialSaid,
    verifierRequest,
    timeoutMs,
    pollMs,
}: {
    client: SignifyClient;
    presenterAlias: string;
    presenterAid: string;
    credentialSaid: string;
    verifierRequest: Record<string, unknown>;
    timeoutMs: number;
    pollMs?: number;
}): EffectionOperation<W3CPresentTxView> {
    const name = requireNonEmpty(presenterAlias, 'Presenter identifier');
    requireNonEmpty(presenterAid, 'Presenter AID');
    const said = requireNonEmpty(credentialSaid, 'Credential SAID');
    if (Object.keys(verifierRequest).length === 0) {
        throw new Error('Verifier request JSON is required.');
    }
    yield* callPromise(() =>
        ensureDidWebsSetup({
            client,
            name,
            timeoutMs,
            pollMs,
        })
    );
    const requestDescriptor = {
        ...verifierRequest,
        credentialSaid: said,
    };
    const w3c = new W3CKeriaClient(client);
    const credentials = yield* callPromise(() => w3c.credentials(name));
    const held = selectHeldW3CCredential(credentials, said);
    if (held === null) {
        throw new Error(
            `No held W3C credential was found for source credential ${said}.`
        );
    }
    const credentialId = requireNonEmpty(
        String(held.credentialId ?? ''),
        'W3C held credential id'
    );
    const result = yield* callPromise(() =>
        presentW3CCredential({
            client,
            holderName: name,
            credentialId,
            verifierRequest: requestDescriptor,
        })
    );
    const view = presentationViewFromResult({
        result,
        held,
        requestDescriptor,
        sourceCredentialSaid: said,
    });
    if (view.state === 'failed') {
        throw new Error(
            view.error ??
                `W3C presentation ${view.presentationId} ended as failed.`
        );
    }
    return view;
}

const selectHeldW3CCredential = (
    credentials: readonly W3CHeldCredential[],
    credentialSaid: string
): W3CHeldCredential | null =>
    credentials.find((credential) => {
        const credentialId = stringValue(credential.credentialId);
        const sourceCredentialSaid = stringValue(
            credential.sourceCredentialSaid
        );
        return (
            credentialId === credentialSaid ||
            sourceCredentialSaid === credentialSaid
        );
    }) ?? null;

const presentationViewFromResult = ({
    result,
    held,
    requestDescriptor,
    sourceCredentialSaid,
}: {
    result: W3CPresentationResult;
    held: W3CHeldCredential;
    requestDescriptor: Record<string, unknown>;
    sourceCredentialSaid: string;
}): W3CPresentTxView => {
    const presentationId = requireNonEmpty(
        String(result.presentationId ?? result.presentTxId ?? ''),
        'W3C presentation id'
    );
    const submissionEndpoint =
        stringValue(result.submissionEndpoint) ??
        stringValue(requestDescriptor.submissionEndpoint) ??
        stringValue(requestDescriptor.response_uri);
    return {
        ...result,
        presentationId,
        presentTxId: presentationId,
        selectedCredentialId:
            result.selectedCredentialId ?? String(held.credentialId ?? ''),
        vcJwt: stringValue(held.vcJwt) ?? null,
        verifierRequest: requestDescriptor,
        requestDescriptor: result.requestDescriptor ?? requestDescriptor,
        submissionEndpoint,
        sourceCredentialSaid,
    };
};

/**
 * Load issued and held credentials for local AIDs and project them into
 * serializable credential summary records.
 */
export function* listCredentialInventoryService({
    client,
    localAids,
}: {
    client: SignifyClient;
    localAids: readonly string[];
}): EffectionOperation<CredentialInventorySnapshot> {
    const localAidSet = new Set(
        localAids.map((aid) => aid.trim()).filter((aid) => aid.length > 0)
    );
    if (localAidSet.size === 0) {
        return { credentials: [], acdcs: [], chainGraphs: [], schemas: [] };
    }

    const records = new Map<string, CredentialSummaryRecord>();
    const acdcs = new Map<string, CredentialAcdcRecord>();
    const chainGraphs = new Map<string, CredentialChainGraphRecord>();
    const schemas = new Map<string, SchemaRecord>();
    const recordEmbeddedSchema = (credential: CredentialResult) => {
        const sad = credentialSad(credential);
        const schemaSaid = recordString(sad, 's');
        const schema = credentialSchema(credential);
        if (schemaSaid === null || schema === null) {
            return;
        }

        schemas.set(
            schemaSaid,
            schemaRecordFromKeriaSchema({
                schema,
                said: schemaSaid,
                oobi: null,
                updatedAt: new Date().toISOString(),
            })
        );
    };
    const recordCredentialTree = ({
        credential,
        status,
    }: {
        credential: CredentialResult;
        status: CredentialSummaryRecord['status'];
    }) => {
        const updatedAt = new Date().toISOString();
        const pending = [credential];
        const visited = new Set<string>();
        while (pending.length > 0) {
            const current = pending.shift();
            if (current === undefined) {
                continue;
            }

            const said = credentialSaid(current);
            if (visited.has(said)) {
                continue;
            }

            visited.add(said);
            recordEmbeddedSchema(current);
            acdcs.set(
                said,
                credentialAcdcRecordFromKeriaCredential({
                    credential: current,
                    status: current === credential ? status : null,
                    updatedAt,
                })
            );
            pending.push(...credentialChains(current));
        }

        chainGraphs.set(
            credentialSaid(credential),
            credentialChainGraphFromKeriaCredential({ credential, updatedAt })
        );
    };

    for (const localAid of localAidSet) {
        const issuedCredentials = yield* callPromise(() =>
            client.credentials().list({ filter: { '-i': localAid } })
        );
        for (const credential of issuedCredentials) {
            const said = credentialSaid(credential);
            const sad = credentialSad(credential);
            const ri = recordString(sad, 'ri') ?? recordString(sad, 'rd');
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
            const status = statusFromCredentialState(state, false);
            recordCredentialTree({ credential, status });

            records.set(
                `issued:${said}`,
                credentialRecordFromKeriaCredential({
                    credential,
                    credentialTypes: ISSUEABLE_CREDENTIAL_TYPES,
                    direction: 'issued',
                    status,
                })
            );
        }

        const heldCredentials = yield* callPromise(() =>
            client.credentials().list({ filter: { '-a-i': localAid } })
        );
        for (const credential of heldCredentials) {
            const said = credentialSaid(credential);
            const sad = credentialSad(credential);
            const ri = recordString(sad, 'ri') ?? recordString(sad, 'rd');
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
            const status = statusFromCredentialState(state, true);
            recordCredentialTree({ credential, status });

            records.set(
                `held:${said}`,
                credentialRecordFromKeriaCredential({
                    credential,
                    credentialTypes: ISSUEABLE_CREDENTIAL_TYPES,
                    direction: 'held',
                    status,
                })
            );
        }
    }

    return {
        credentials: Array.from(records.values()),
        acdcs: Array.from(acdcs.values()),
        chainGraphs: Array.from(chainGraphs.values()),
        schemas: Array.from(schemas.values()),
    };
}
