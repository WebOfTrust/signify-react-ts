import type { Operation as EffectionOperation } from 'effection';
import { toErrorText } from '../effects/promise';
import { AppServicesContext } from '../effects/contexts';
import {
    admitCredentialGrantService,
    createCredentialRegistryService,
    grantIssuedCredentialService,
    listCredentialIpexActivityService,
    issueSediCredentialService,
    listCredentialInventoryService,
    listCredentialRegistriesService,
    listKnownCredentialSchemasService,
    presentCredentialService,
    startW3CIssuanceService,
    type W3CIssuanceView,
    type W3CPresentTxView,
    resolveCredentialSchemaService,
} from '../services/credentials.service';
import {
    credentialInventoryLoaded,
    credentialIpexActivityLoaded,
    credentialRecorded,
} from '../state/credentials.slice';
import {
    registryInventoryLoaded,
    registryRecorded,
} from '../state/registry.slice';
import { schemaRecorded } from '../state/schema.slice';
import { ISSUEABLE_CREDENTIAL_TYPES } from '../config/credentialCatalog';
import type {
    CredentialSummaryRecord,
    RegistryRecord,
    SchemaRecord,
} from '../domain/credentials/credentialTypes';
import { SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME } from '../domain/credentials/sediVoterId';
import type {
    AdmitCredentialGrantInput,
    CreateCredentialRegistryInput,
    GrantCredentialInput,
    IssueSediCredentialInput,
    PresentCredentialInput,
    ResolveCredentialSchemaInput,
    StartW3CIssuanceInput,
} from '../domain/credentials/credentialCommands';
import { localIdentifierAids, syncSessionInventoryOp } from './contacts.op';

export type {
    AdmitCredentialGrantInput,
    CreateCredentialRegistryInput,
    GrantCredentialInput,
    IssueSediCredentialInput,
    PresentCredentialInput,
    ResolveCredentialSchemaInput,
    StartW3CIssuanceInput,
} from '../domain/credentials/credentialCommands';

/**
 * Synthetic registry id used while registry creation is still pending.
 */
const pendingRegistryId = (issuerAid: string, registryName: string): string =>
    `${issuerAid}:${registryName}`;

/**
 * Workflow for resolving a credential schema and recording progress in Redux.
 */
export function* resolveCredentialSchemaOp(
    input: ResolveCredentialSchemaInput
): EffectionOperation<SchemaRecord> {
    const services = yield* AppServicesContext.expect();
    const now = new Date().toISOString();
    services.store.dispatch(
        schemaRecorded({
            said: input.schemaSaid,
            oobi: input.schemaOobiUrl,
            status: 'resolving',
            title: null,
            description: null,
            credentialType: null,
            version: null,
            rules: null,
            error: null,
            updatedAt: now,
        })
    );

    try {
        const schema = yield* resolveCredentialSchemaService({
            client: services.runtime.requireConnectedClient(),
            schemaSaid: input.schemaSaid,
            schemaOobiUrl: input.schemaOobiUrl,
            logger: services.logger,
        });
        services.store.dispatch(schemaRecorded(schema));
        return schema;
    } catch (error) {
        services.store.dispatch(
            schemaRecorded({
                said: input.schemaSaid,
                oobi: input.schemaOobiUrl,
                status: 'error',
                title: null,
                description: null,
                credentialType: null,
                version: null,
                rules: null,
                error: toErrorText(error),
                updatedAt: new Date().toISOString(),
            })
        );
        throw error;
    }
}

/**
 * Workflow for creating or rediscovering an issuer registry with optimistic
 * state so the UI can explain pending registry work.
 */
export function* createCredentialRegistryOp(
    input: CreateCredentialRegistryInput
): EffectionOperation<RegistryRecord> {
    const services = yield* AppServicesContext.expect();
    const registryName =
        input.registryName?.trim() || SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME;
    const now = new Date().toISOString();
    services.store.dispatch(
        registryRecorded({
            id: pendingRegistryId(input.issuerAid, registryName),
            name: input.issuerAlias,
            registryName,
            regk: '',
            issuerAlias: input.issuerAlias,
            issuerAid: input.issuerAid,
            status: 'creating',
            error: null,
            updatedAt: now,
        })
    );

    try {
        const registry = yield* createCredentialRegistryService({
            client: services.runtime.requireConnectedClient(),
            issuerAlias: input.issuerAlias,
            issuerAid: input.issuerAid,
            registryName,
            logger: services.logger,
        });
        services.store.dispatch(registryRecorded(registry));
        return registry;
    } catch (error) {
        services.store.dispatch(
            registryRecorded({
                id: pendingRegistryId(input.issuerAid, registryName),
                name: input.issuerAlias,
                registryName,
                regk: '',
                issuerAlias: input.issuerAlias,
                issuerAid: input.issuerAid,
                status: 'error',
                error: toErrorText(error),
                updatedAt: new Date().toISOString(),
            })
        );
        throw error;
    }
}

/**
 * Workflow for the schema-specific SEDI Voter ID issue command.
 */
export function* issueSediCredentialOp(
    input: IssueSediCredentialInput
): EffectionOperation<CredentialSummaryRecord> {
    const services = yield* AppServicesContext.expect();
    const credential = yield* issueSediCredentialService({
        client: services.runtime.requireConnectedClient(),
        issuerAlias: input.issuerAlias,
        issuerAid: input.issuerAid,
        holderAid: input.holderAid,
        registryId: input.registryId,
        schemaSaid: input.schemaSaid,
        attributes: input.attributes,
        logger: services.logger,
    });
    services.store.dispatch(credentialRecorded(credential));
    return credential;
}

/**
 * Workflow for sending an IPEX grant and refreshing wallet inventory facts.
 */
export function* grantCredentialOp(
    input: GrantCredentialInput
): EffectionOperation<CredentialSummaryRecord> {
    const services = yield* AppServicesContext.expect();
    const credential = yield* grantIssuedCredentialService({
        client: services.runtime.requireConnectedClient(),
        issuerAlias: input.issuerAlias,
        issuerAid: input.issuerAid,
        holderAid: input.holderAid,
        credentialSaid: input.credentialSaid,
        logger: services.logger,
    });
    services.store.dispatch(credentialRecorded(credential));
    yield* syncSessionInventoryOp();
    return credential;
}

/**
 * Workflow for holder-side IPEX admit and post-admit inventory refresh.
 */
export function* admitCredentialGrantOp(
    input: AdmitCredentialGrantInput
): EffectionOperation<CredentialSummaryRecord> {
    const services = yield* AppServicesContext.expect();
    const credential = yield* admitCredentialGrantService({
        client: services.runtime.requireConnectedClient(),
        holderAlias: input.holderAlias,
        holderAid: input.holderAid,
        notificationId: input.notificationId,
        grantSaid: input.grantSaid,
        logger: services.logger,
    });
    services.store.dispatch(credentialRecorded(credential));
    yield* syncCredentialInventoryOp();
    yield* syncSessionInventoryOp();
    return credential;
}

/**
 * Workflow for QVI-side W3C VRD issuance from a native VRD credential.
 */
export function* startW3CIssuanceOp(
    input: StartW3CIssuanceInput
): EffectionOperation<W3CIssuanceView> {
    const services = yield* AppServicesContext.expect();
    return yield* startW3CIssuanceService({
        client: services.runtime.requireConnectedClient(),
        issuerAlias: input.issuerAlias,
        issuerAid: input.issuerAid,
        credentialSaid: input.credentialSaid,
        timeoutMs: services.config.operations.timeoutMs,
    });
}

/**
 * Workflow for presenting a VRD credential through the W3C VC-JWT path.
 */
export function* presentCredentialOp(
    input: PresentCredentialInput
): EffectionOperation<W3CPresentTxView> {
    const services = yield* AppServicesContext.expect();
    return yield* presentCredentialService({
        client: services.runtime.requireConnectedClient(),
        presenterAlias: input.presenterAlias,
        presenterAid: input.presenterAid,
        credentialSaid: input.credentialSaid,
        verifierRequest: input.verifierRequest,
        timeoutMs: services.config.operations.timeoutMs,
    });
}

/**
 * Synchronize issued and held credential inventory for local identifiers.
 */
export function* syncCredentialInventoryOp(): EffectionOperation<
    CredentialSummaryRecord[]
> {
    const services = yield* AppServicesContext.expect();
    const inventory = yield* listCredentialInventoryService({
        client: services.runtime.requireConnectedClient(),
        localAids: localIdentifierAids(services.store),
    });

    for (const schema of inventory.schemas) {
        services.store.dispatch(schemaRecorded(schema));
    }

    const credentials = inventory.credentials;
    services.store.dispatch(
        credentialInventoryLoaded({
            credentials,
            acdcs: inventory.acdcs,
            chainGraphs: inventory.chainGraphs,
        })
    );
    return credentials;
}

/**
 * Synchronize IPEX grant/admit activity for credentials already in state.
 */
export function* syncCredentialIpexActivityOp(): EffectionOperation<unknown[]> {
    const services = yield* AppServicesContext.expect();
    const state = services.store.getState();
    const credentials = state.credentials.saids.flatMap((said) => {
        const credential = state.credentials.bySaid[said];
        return credential === undefined ? [] : [credential];
    });
    const activities = yield* listCredentialIpexActivityService({
        client: services.runtime.requireConnectedClient(),
        credentials,
        localAids: localIdentifierAids(services.store),
    });
    services.store.dispatch(
        credentialIpexActivityLoaded({
            activities,
            loadedAt: new Date().toISOString(),
        })
    );
    return activities;
}

/**
 * Synchronize credential registries owned by local issuer identifiers.
 */
export function* syncCredentialRegistriesOp(): EffectionOperation<
    RegistryRecord[]
> {
    const services = yield* AppServicesContext.expect();
    const state = services.store.getState();
    const identifiers = state.identifiers.prefixes.flatMap((prefix) => {
        const identifier = state.identifiers.byPrefix[prefix];
        if (identifier === undefined) {
            return [];
        }

        return [
            {
                issuerAlias: identifier.name,
                issuerAid: identifier.prefix,
            },
        ];
    });
    const inventory = yield* listCredentialRegistriesService({
        client: services.runtime.requireConnectedClient(),
        identifiers,
    });

    services.store.dispatch(
        registryInventoryLoaded({
            registries: inventory.registries,
            loadedAt: inventory.loadedAt,
        })
    );
    return inventory.registries;
}

/**
 * Synchronize configured credential schemas already known to the agent.
 */
export function* syncKnownCredentialSchemasOp(): EffectionOperation<
    SchemaRecord[]
> {
    const services = yield* AppServicesContext.expect();
    const schemas = yield* listKnownCredentialSchemasService({
        client: services.runtime.requireConnectedClient(),
        credentialTypes: ISSUEABLE_CREDENTIAL_TYPES,
    });

    for (const schema of schemas) {
        services.store.dispatch(schemaRecorded(schema));
    }

    return schemas;
}
