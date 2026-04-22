import type { CredentialSummaryRecord } from '../../state/credentials.slice';
import type {
    IssueableCredentialTypeView,
} from '../../state/issueableCredentialTypes';
import type { CredentialGrantNotification } from '../../state/notifications.slice';
import type { RegistryRecord } from '../../state/registry.slice';
import { readyCredentialRegistriesForIssuer } from './credentialSelection';

export interface CredentialIssuerStats {
    issueableTypes: number;
    issued: number;
    granted: number;
}

export interface CredentialWalletStats {
    admitted: number;
    heldTypes: number;
    presentationGrants: number;
    pendingGrants: number;
}

export interface RegistrySchemaCount {
    schemaSaid: string;
    label: string;
    count: number;
}

export interface CredentialRegistryTile {
    registry: RegistryRecord;
    schemaCounts: RegistrySchemaCount[];
    selectedTypeCount: number;
    totalIssued: number;
}

export const issuedCredentialsForAid = (
    credentials: readonly CredentialSummaryRecord[],
    aid: string
): CredentialSummaryRecord[] =>
    credentials.filter((credential) => credential.issuerAid === aid);

export const heldCredentialsForAid = (
    credentials: readonly CredentialSummaryRecord[],
    aid: string
): CredentialSummaryRecord[] =>
    credentials.filter((credential) => credential.holderAid === aid);

export const issuedCredentialsForAidAndSchema = (
    credentials: readonly CredentialSummaryRecord[],
    aid: string,
    schemaSaid: string
): CredentialSummaryRecord[] =>
    issuedCredentialsForAid(credentials, aid).filter(
        (credential) => credential.schemaSaid === schemaSaid
    );

export const grantsForAid = (
    grants: readonly CredentialGrantNotification[],
    aid: string
): CredentialGrantNotification[] =>
    grants.filter((grant) => grant.holderAid === aid);

export const issuerStatsForAid = ({
    aid,
    credentialTypes,
    issuedCredentials,
}: {
    aid: string;
    credentialTypes: readonly IssueableCredentialTypeView[];
    issuedCredentials: readonly CredentialSummaryRecord[];
}): CredentialIssuerStats => {
    const issued = issuedCredentialsForAid(issuedCredentials, aid);

    return {
        issueableTypes: credentialTypes.filter(
            (credentialType) => credentialType.schemaStatus === 'resolved'
        ).length,
        issued: issued.length,
        granted: issued.filter((credential) => credential.grantSaid !== null)
            .length,
    };
};

export const walletStatsForAid = ({
    aid,
    heldCredentials,
    grants,
}: {
    aid: string;
    heldCredentials: readonly CredentialSummaryRecord[];
    grants: readonly CredentialGrantNotification[];
}): CredentialWalletStats => {
    const held = heldCredentialsForAid(heldCredentials, aid);

    return {
        admitted: held.filter((credential) => credential.status === 'admitted')
            .length,
        heldTypes: new Set(
            held.flatMap((credential) =>
                credential.schemaSaid === null ? [] : [credential.schemaSaid]
            )
        ).size,
        presentationGrants: 0,
        pendingGrants: grantsForAid(grants, aid).filter(
            (grant) => grant.status === 'actionable'
        ).length,
    };
};

export const registryTilesForIssuer = ({
    aid,
    registries,
    issuedCredentials,
    credentialTypes,
    selectedSchemaSaid,
}: {
    aid: string;
    registries: readonly RegistryRecord[];
    issuedCredentials: readonly CredentialSummaryRecord[];
    credentialTypes: readonly IssueableCredentialTypeView[];
    selectedSchemaSaid: string;
}): CredentialRegistryTile[] =>
    readyCredentialRegistriesForIssuer(registries, aid).map((registry) => {
        const issued = issuedCredentials.filter(
            (credential) =>
                credential.issuerAid === aid &&
                credential.registryId === registry.regk
        );
        const schemaCounts = credentialTypes.map((type) => ({
            schemaSaid: type.schemaSaid,
            label: type.label,
            count: issued.filter(
                (credential) => credential.schemaSaid === type.schemaSaid
            ).length,
        }));

        return {
            registry,
            schemaCounts,
            selectedTypeCount:
                schemaCounts.find(
                    (count) => count.schemaSaid === selectedSchemaSaid
                )?.count ?? 0,
            totalIssued: issued.length,
        };
    });
