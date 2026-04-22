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
    resolveCredentialSchemaService,
} from '../services/credentials.service';
import {
    credentialInventoryLoaded,
    credentialIpexActivityLoaded,
    credentialRecorded,
    type CredentialSummaryRecord,
    type SediVoterCredentialAttributes,
} from '../state/credentials.slice';
import {
    registryInventoryLoaded,
    registryRecorded,
    type RegistryRecord,
} from '../state/registry.slice';
import { schemaRecorded, type SchemaRecord } from '../state/schema.slice';
import { ISSUEABLE_CREDENTIAL_TYPES } from '../state/issueableCredentialTypes';
import { localIdentifierAids, syncSessionInventoryOp } from './contacts.op';

export interface ResolveCredentialSchemaInput {
    schemaSaid: string;
    schemaOobiUrl: string;
}

export interface CreateCredentialRegistryInput {
    issuerAlias: string;
    issuerAid: string;
    registryName?: string;
}

export interface IssueSediCredentialInput {
    issuerAlias: string;
    issuerAid: string;
    holderAid: string;
    registryId: string;
    schemaSaid: string;
    attributes: SediVoterCredentialAttributes;
}

export interface GrantCredentialInput {
    issuerAlias: string;
    issuerAid: string;
    holderAid: string;
    credentialSaid: string;
}

export interface AdmitCredentialGrantInput {
    holderAlias: string;
    holderAid: string;
    notificationId: string;
    grantSaid: string;
}

const pendingRegistryId = (issuerAid: string, registryName: string): string =>
    `${issuerAid}:${registryName}`;

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
                version: null,
                rules: null,
                error: toErrorText(error),
                updatedAt: new Date().toISOString(),
            })
        );
        throw error;
    }
}

export function* createCredentialRegistryOp(
    input: CreateCredentialRegistryInput
): EffectionOperation<RegistryRecord> {
    const services = yield* AppServicesContext.expect();
    const registryName = input.registryName?.trim() || 'sedi-voter-registry';
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

export function* syncCredentialInventoryOp(): EffectionOperation<
    CredentialSummaryRecord[]
> {
    const services = yield* AppServicesContext.expect();
    const credentials = yield* listCredentialInventoryService({
        client: services.runtime.requireConnectedClient(),
        localAids: localIdentifierAids(services.store),
    });

    services.store.dispatch(credentialInventoryLoaded({ credentials }));
    return credentials;
}

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
