import type {
    AdmitCredentialGrantInput,
    CreateCredentialRegistryInput,
    GrantCredentialInput,
    IssueSediCredentialInput,
    PresentCredentialInput,
    ResolveCredentialSchemaInput,
    StartW3CIssuanceInput,
} from '../../domain/credentials/credentialCommands';
import type {
    CredentialSummaryRecord,
    RegistryRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';
import type {
    W3CIssuanceView,
    W3CPresentTxView,
} from '../../services/credentials.service';
import {
    admitCredentialGrantOp,
    createCredentialRegistryOp,
    grantCredentialOp,
    issueSediCredentialOp,
    presentCredentialOp,
    resolveCredentialSchemaOp,
    startW3CIssuanceOp,
    syncCredentialInventoryOp,
    syncCredentialIpexActivityOp,
    syncCredentialRegistriesOp,
    syncKnownCredentialSchemasOp,
} from '../../workflows/credentials.op';
import { w3cPresentationPayloadDetails } from './payloadDetails';
import { credentialsRoute } from './helpers';
import type {
    BackgroundWorkflowRunOptions,
    BackgroundWorkflowStartResult,
    RequestIdOptions,
    RuntimeCommandContext,
    WorkflowRunOptions,
} from './types';

export interface CredentialRuntimeCommands {
    syncInventory(options?: WorkflowRunOptions): Promise<unknown>;
    syncRegistries(options?: WorkflowRunOptions): Promise<unknown>;
    syncIpexActivity(options?: WorkflowRunOptions): Promise<unknown>;
    syncKnownSchemas(options?: WorkflowRunOptions): Promise<unknown>;
    startResolveSchema(
        input: ResolveCredentialSchemaInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startCreateRegistry(
        input: CreateCredentialRegistryInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startIssue(
        input: IssueSediCredentialInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startGrant(
        input: GrantCredentialInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startW3CIssuance(
        input: StartW3CIssuanceInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startAdmit(
        input: AdmitCredentialGrantInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
    startPresent(
        input: PresentCredentialInput,
        options?: RequestIdOptions
    ): BackgroundWorkflowStartResult;
}

/**
 * Route-facing credential, schema, registry, grant, and admit commands.
 */
export const createCredentialRuntimeCommands = (
    context: RuntimeCommandContext
): CredentialRuntimeCommands => ({
    syncInventory: syncCredentialInventory(context),
    syncRegistries: syncCredentialRegistries(context),
    syncIpexActivity: syncCredentialIpexActivity(context),
    syncKnownSchemas: syncKnownCredentialSchemas(context),
    startResolveSchema: startResolveCredentialSchema(context),
    startCreateRegistry: startCreateCredentialRegistry(context),
    startIssue: startIssueCredential(context),
    startGrant: startGrantCredential(context),
    startW3CIssuance: startW3CIssuance(context),
    startAdmit: startAdmitCredentialGrant(context),
    startPresent: startPresentCredential(context),
});

const syncCredentialInventory =
    (context: RuntimeCommandContext) =>
    (options: WorkflowRunOptions = {}): Promise<unknown> =>
        context.runWorkflow(() => syncCredentialInventoryOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

const syncCredentialRegistries =
    (context: RuntimeCommandContext) =>
    (options: WorkflowRunOptions = {}): Promise<unknown> =>
        context.runWorkflow(() => syncCredentialRegistriesOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

const syncCredentialIpexActivity =
    (context: RuntimeCommandContext) =>
    (options: WorkflowRunOptions = {}): Promise<unknown> =>
        context.runWorkflow(() => syncCredentialIpexActivityOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

const syncKnownCredentialSchemas =
    (context: RuntimeCommandContext) =>
    (options: WorkflowRunOptions = {}): Promise<unknown> =>
        context.runWorkflow(() => syncKnownCredentialSchemasOp(), {
            ...options,
            label: options.label,
            kind: options.kind ?? 'syncInventory',
            track: options.track ?? false,
        });

const startResolveCredentialSchema =
    (context: RuntimeCommandContext) =>
    (
        input: ResolveCredentialSchemaInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => resolveCredentialSchemaOp(input),
            resolveCredentialSchemaOptions(input, options)
        );

const startCreateCredentialRegistry =
    (context: RuntimeCommandContext) =>
    (
        input: CreateCredentialRegistryInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => createCredentialRegistryOp(input),
            createCredentialRegistryOptions(input, options)
        );

const startIssueCredential =
    (context: RuntimeCommandContext) =>
    (
        input: IssueSediCredentialInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => issueSediCredentialOp(input),
            issueCredentialOptions(input, options)
        );

const startGrantCredential =
    (context: RuntimeCommandContext) =>
    (
        input: GrantCredentialInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => grantCredentialOp(input),
            grantCredentialOptions(input, options)
        );

const startW3CIssuance =
    (context: RuntimeCommandContext) =>
    (
        input: StartW3CIssuanceInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => startW3CIssuanceOp(input),
            w3cIssuanceOptions(input, options)
        );

const startAdmitCredentialGrant =
    (context: RuntimeCommandContext) =>
    (
        input: AdmitCredentialGrantInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => admitCredentialGrantOp(input),
            admitCredentialGrantOptions(input, options)
        );

const startPresentCredential =
    (context: RuntimeCommandContext) =>
    (
        input: PresentCredentialInput,
        options: RequestIdOptions = {}
    ): BackgroundWorkflowStartResult =>
        context.startBackgroundWorkflow(
            () => presentCredentialOp(input),
            presentCredentialOptions(input, options)
        );

const resolveCredentialSchemaOptions = (
    input: ResolveCredentialSchemaInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<SchemaRecord> => ({
    requestId: options.requestId,
    label: 'Adding SEDI credential type',
    title: 'Add credential type',
    description:
        'Adds the SEDI schema OOBI to this KERIA agent and records schema metadata.',
    kind: 'resolveSchema',
    resourceKeys: [`schema:${input.schemaSaid}`],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential type added',
        message: 'The SEDI credential type is available to this wallet.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Credential type add failed',
        message: 'The SEDI credential type could not be added.',
        severity: 'error',
    },
});

const createCredentialRegistryOptions = (
    input: CreateCredentialRegistryInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<RegistryRecord> => ({
    requestId: options.requestId,
    label: `Creating registry for ${input.issuerAlias}`,
    title: 'Create credential registry',
    description:
        'Creates or reuses the issuer credential registry for SEDI voter credentials.',
    kind: 'createRegistry',
    resourceKeys: [`registry:${input.issuerAid}`],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential registry ready',
        message: 'The issuer credential registry is ready.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Credential registry failed',
        message: 'The issuer credential registry could not be prepared.',
        severity: 'error',
    },
});

const issueCredentialOptions = (
    input: IssueSediCredentialInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<CredentialSummaryRecord> => ({
    requestId: options.requestId,
    label: `Issuing credential to ${input.holderAid}`,
    title: 'Issue SEDI voter credential',
    description:
        'Creates the ACDC in the issuer registry and waits for KERIA completion.',
    kind: 'issueCredential',
    resourceKeys: [
        `credential:issue:${input.issuerAid}:${input.holderAid}:${input.attributes.voterId}`,
    ],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential issued',
        message: 'The SEDI voter credential was issued.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Credential issuance failed',
        message: 'The SEDI voter credential could not be issued.',
        severity: 'error',
    },
});

const grantCredentialOptions = (
    input: GrantCredentialInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<CredentialSummaryRecord> => ({
    requestId: options.requestId,
    label: `Granting credential ${input.credentialSaid}`,
    title: 'Grant credential',
    description:
        'Sends an IPEX grant to the holder and waits for KERIA completion.',
    kind: 'grantCredential',
    resourceKeys: [`credential:${input.credentialSaid}:grant`],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential grant sent',
        message: 'The credential grant was sent to the holder.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Credential grant failed',
        message: 'The credential grant could not be sent.',
        severity: 'error',
    },
});

const w3cIssuanceOptions = (
    input: StartW3CIssuanceInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<W3CIssuanceView> => ({
    requestId: options.requestId,
    label: `Starting W3C issuance for ${input.credentialSaid}`,
    title: 'Start W3C issuance',
    description:
        'Starts QVI-side W3C VC-JWT issuance for a native VRD credential.',
    kind: 'w3cIssuance',
    resourceKeys: [`credential:${input.credentialSaid}:w3c-issue`],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'W3C VRD issued',
        message: 'The W3C VC-JWT was issued from the native VRD credential.',
        severity: 'success',
    },
    failureNotification: {
        title: 'W3C issuance failed',
        message: 'The W3C VRD could not be issued.',
        severity: 'error',
    },
});

const admitCredentialGrantOptions = (
    input: AdmitCredentialGrantInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<CredentialSummaryRecord> => ({
    requestId: options.requestId,
    label: `Admitting credential grant ${input.grantSaid}`,
    title: 'Admit credential grant',
    description:
        'Accepts the issuer IPEX grant and refreshes holder credential inventory.',
    kind: 'admitCredential',
    resourceKeys: [`grant:${input.grantSaid}:admit`],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential admitted',
        message: 'The credential is now available in this wallet.',
        severity: 'success',
    },
    failureNotification: {
        title: 'Credential admit failed',
        message: 'The credential grant could not be admitted.',
        severity: 'error',
    },
});

const presentCredentialOptions = (
    input: PresentCredentialInput,
    options: RequestIdOptions
): BackgroundWorkflowRunOptions<W3CPresentTxView> => ({
    requestId: options.requestId,
    label: `Presenting credential ${input.credentialSaid}`,
    title: 'Present credential',
    description:
        'Creates a KERIA W3C presentation transaction from a runtime verifier request.',
    kind: 'presentCredential',
    resourceKeys: [`credential:${input.credentialSaid}:w3c-present`],
    resultRoute: credentialsRoute,
    successNotification: {
        title: 'Credential presented',
        message: 'KERIA recorded the W3C presentation transaction result.',
        severity: 'success',
    },
    payloadDetails: w3cPresentationPayloadDetails,
    failureNotification: {
        title: 'Credential presentation failed',
        message:
            'The credential could not be presented through the verifier request.',
        severity: 'error',
    },
});
