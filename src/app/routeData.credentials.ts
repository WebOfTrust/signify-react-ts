import { ISSUEABLE_CREDENTIAL_TYPES } from '../config/credentialCatalog';
import { SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME } from '../domain/credentials/sediVoterId';
import type {
    AdmitCredentialGrantInput,
    GrantCredentialInput,
    IssueSediCredentialInput,
    PresentCredentialInput,
    StartW3CIssuanceInput,
} from '../domain/credentials/credentialCommands';
import type {
    CredentialActionData,
    CredentialsLoaderData,
    RouteDataRuntime,
} from './routeData.types';
import { formString, toRouteError } from './routeData.shared';
import { appConfig } from '../config';

/**
 * Credential route action boundary.
 *
 * This module parses form intent into domain command inputs. Signify/KERIA
 * work remains behind `AppRuntime`, workflows, and services.
 */

type CredentialIntent = Exclude<CredentialActionData['intent'], 'unsupported'>;

/** Shared context passed to credential intent handlers. */
interface CredentialActionContext {
    runtime: RouteDataRuntime;
    request: Request;
    formData: FormData;
    intent: string;
    requestId: string;
}

/** Normalize submitted credential intent strings to the supported action set. */
const credentialIntentFromString = (value: string): CredentialIntent =>
    value === 'createRegistry' ||
    value === 'issueCredential' ||
    value === 'grantCredential' ||
    value === 'startW3CIssuance' ||
    value === 'admitCredentialGrant' ||
    value === 'presentCredential' ||
    value === 'refreshCredentials'
        ? value
        : 'resolveSchema';

const requestIdOption = (requestId: string): { requestId?: string } =>
    requestId.length > 0 ? { requestId } : {};

/**
 * Loader for `/credentials`.
 *
 * The route is a connected placeholder today; keeping the loader explicit sets
 * the gating contract for future issuer/holder/verifier credential children.
 */
export const loadCredentials = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<CredentialsLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    try {
        await runtime.identifiers.list({ signal: request?.signal });
        await Promise.all([
            runtime.contacts.syncInventory({ signal: request?.signal }),
            runtime.credentials.syncKnownSchemas({ signal: request?.signal }),
            runtime.credentials.syncRegistries({ signal: request?.signal }),
            runtime.credentials.syncInventory({ signal: request?.signal }),
        ]);
        await runtime.credentials.syncIpexActivity({ signal: request?.signal });
        return {
            status: 'ready',
            verifiers: [...appConfig.w3cVerifiers],
        };
    } catch (error) {
        return {
            status: 'error',
            verifiers: [...appConfig.w3cVerifiers],
            message: `Unable to refresh credential inventory: ${toRouteError(error).message}`,
        };
    }
};

/** Parse checkbox-style form values without leaking DOM semantics downstream. */
const formBoolean = (formData: FormData, field: string): boolean => {
    const value = formString(formData, field).trim().toLowerCase();
    return value === 'true' || value === 'on' || value === '1';
};

const verifierRequestFromForm = (
    formData: FormData
): Record<string, unknown> | null => {
    const raw = formString(formData, 'verifierRequest').trim();
    if (raw.length === 0) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
};

/**
 * Resolve the selected issueable credential type from the app catalog.
 *
 * The route may use catalog defaults for convenience, but workflows still
 * receive explicit schema SAID/OOBI input.
 */
const issueableCredentialTypeFromForm = (formData: FormData) => {
    const credentialTypeKey = formString(formData, 'credentialTypeKey').trim();
    return (
        ISSUEABLE_CREDENTIAL_TYPES.find(
            (credentialType) => credentialType.key === credentialTypeKey
        ) ??
        ISSUEABLE_CREDENTIAL_TYPES[0] ??
        null
    );
};

/** Convert runtime background launch results into typed route action data. */
const credentialStartedResult = (
    intent: Exclude<CredentialIntent, 'refreshCredentials'>,
    started: ReturnType<RouteDataRuntime['credentials']['startResolveSchema']>,
    message: string
): CredentialActionData => {
    if (started.status === 'conflict') {
        return {
            intent,
            ok: false,
            message: started.message,
            requestId: started.requestId,
            operationRoute: started.operationRoute,
        };
    }

    return {
        intent,
        ok: true,
        message,
        requestId: started.requestId,
        operationRoute: started.operationRoute,
    };
};

/**
 * Refreshes all credential-facing inventories for the current session. This is
 * the only credential route action that performs bounded foreground sync work
 * because the UI expects a fresh inventory result rather than a queued command.
 */
const refreshCredentialsAction = async ({
    runtime,
    request,
    requestId,
}: CredentialActionContext): Promise<CredentialActionData> => {
    const intent = 'refreshCredentials';
    await runtime.identifiers.list({ signal: request.signal });
    await Promise.all([
        runtime.contacts.syncInventory({ signal: request.signal }),
        runtime.credentials.syncKnownSchemas({ signal: request.signal }),
        runtime.credentials.syncRegistries({ signal: request.signal }),
        runtime.credentials.syncInventory({ signal: request.signal }),
    ]);
    await runtime.credentials.syncIpexActivity({
        signal: request.signal,
    });

    return {
        intent,
        ok: true,
        message: 'Credential inventory refreshed.',
        requestId,
        operationRoute: '/credentials',
    };
};

/**
 * Starts schema OOBI resolution for the selected catalog credential type. The
 * route may default from the app catalog, but the workflow still receives an
 * explicit SAID and OOBI URL so it never depends on React form state.
 */
const resolveCredentialSchemaAction = ({
    runtime,
    formData,
    requestId,
}: CredentialActionContext): CredentialActionData => {
    const intent = 'resolveSchema';
    const credentialType = issueableCredentialTypeFromForm(formData);
    const schemaSaid =
        formString(formData, 'schemaSaid').trim() ||
        credentialType?.schemaSaid ||
        '';
    const schemaOobiUrl =
        formString(formData, 'schemaOobiUrl').trim() ||
        credentialType?.schemaOobiUrl ||
        '';
    if (schemaSaid.length === 0 || schemaOobiUrl.length === 0) {
        return {
            intent,
            ok: false,
            message: 'Schema SAID and OOBI URL are required.',
            requestId,
        };
    }

    return credentialStartedResult(
        intent,
        runtime.credentials.startResolveSchema(
            { schemaSaid, schemaOobiUrl },
            requestIdOption(requestId)
        ),
        'Adding SEDI credential type'
    );
};

/**
 * Starts registry creation for a selected issuer identifier. The handler keeps
 * issuer identity and registry label validation at the route boundary before
 * handing a domain-shaped command to the runtime.
 */
const createCredentialRegistryAction = ({
    runtime,
    formData,
    requestId,
}: CredentialActionContext): CredentialActionData => {
    const intent = 'createRegistry';
    const issuerAlias = formString(formData, 'issuerAlias').trim();
    const issuerAid = formString(formData, 'issuerAid').trim();
    const registryName =
        formString(formData, 'registryName').trim() ||
        SEDI_VOTER_ID_DEFAULT_REGISTRY_NAME;
    if (issuerAlias.length === 0 || issuerAid.length === 0) {
        return {
            intent,
            ok: false,
            message: 'Issuer identifier and AID are required.',
            requestId,
        };
    }

    return credentialStartedResult(
        intent,
        runtime.credentials.startCreateRegistry(
            { issuerAlias, issuerAid, registryName },
            requestIdOption(requestId)
        ),
        `Preparing registry for ${issuerAlias}`
    );
};

/**
 * Maps the issuance form into the SEDI credential command and starts the issue
 * workflow. Attribute collection belongs here because it is route-specific UI
 * input; signing, registry, and operation polling remain behind the runtime.
 */
const issueCredentialAction = ({
    runtime,
    formData,
    requestId,
}: CredentialActionContext): CredentialActionData => {
    const intent = 'issueCredential';
    const issuerAlias = formString(formData, 'issuerAlias').trim();
    const issuerAid = formString(formData, 'issuerAid').trim();
    const holderAid = formString(formData, 'holderAid').trim();
    const registryId = formString(formData, 'registryId').trim();
    const schemaSaid = formString(formData, 'schemaSaid').trim();
    if (
        issuerAlias.length === 0 ||
        issuerAid.length === 0 ||
        holderAid.length === 0 ||
        registryId.length === 0 ||
        schemaSaid.length === 0
    ) {
        return {
            intent,
            ok: false,
            message: 'Issuer, holder, registry, and schema are required.',
            requestId,
        };
    }

    const input: IssueSediCredentialInput = {
        issuerAlias,
        issuerAid,
        holderAid,
        registryId,
        schemaSaid,
        attributes: {
            i: holderAid,
            fullName: formString(formData, 'fullName'),
            voterId: formString(formData, 'voterId'),
            precinctId: formString(formData, 'precinctId'),
            county: formString(formData, 'county'),
            jurisdiction: formString(formData, 'jurisdiction'),
            electionId: formString(formData, 'electionId'),
            eligible: formBoolean(formData, 'eligible'),
            expires: formString(formData, 'expires'),
        },
    };

    return credentialStartedResult(
        intent,
        runtime.credentials.startIssue(input, requestIdOption(requestId)),
        `Issuing credential to ${holderAid}`
    );
};

/**
 * Starts the IPEX grant workflow for an already issued credential. The route
 * action requires issuer, holder, and credential SAID together so downstream
 * services do not have to recover missing protocol context.
 */
const grantCredentialAction = ({
    runtime,
    formData,
    requestId,
}: CredentialActionContext): CredentialActionData => {
    const intent = 'grantCredential';
    const input: GrantCredentialInput = {
        issuerAlias: formString(formData, 'issuerAlias').trim(),
        issuerAid: formString(formData, 'issuerAid').trim(),
        holderAid: formString(formData, 'holderAid').trim(),
        credentialSaid: formString(formData, 'credentialSaid').trim(),
    };
    if (
        input.issuerAlias.length === 0 ||
        input.issuerAid.length === 0 ||
        input.holderAid.length === 0 ||
        input.credentialSaid.length === 0
    ) {
        return {
            intent,
            ok: false,
            message: 'Issuer, holder, and credential SAID are required.',
            requestId,
        };
    }

    return credentialStartedResult(
        intent,
        runtime.credentials.startGrant(input, requestIdOption(requestId)),
        `Granting credential ${input.credentialSaid}`
    );
};

/**
 * Starts QVI-side W3C issuance from an already issued native VRD credential.
 */
const startW3CIssuanceAction = ({
    runtime,
    formData,
    requestId,
}: CredentialActionContext): CredentialActionData => {
    const intent = 'startW3CIssuance';
    const input: StartW3CIssuanceInput = {
        issuerAlias: formString(formData, 'issuerAlias').trim(),
        issuerAid: formString(formData, 'issuerAid').trim(),
        credentialSaid: formString(formData, 'credentialSaid').trim(),
    };
    if (
        input.issuerAlias.length === 0 ||
        input.issuerAid.length === 0 ||
        input.credentialSaid.length === 0
    ) {
        return {
            intent,
            ok: false,
            message: 'Issuer identifier, issuer AID, and credential SAID are required.',
            requestId,
        };
    }

    return credentialStartedResult(
        intent,
        runtime.credentials.startW3CIssuance(
            input,
            requestIdOption(requestId)
        ),
        `Starting W3C issuance for ${input.credentialSaid}`
    );
};

/**
 * Starts holder-side admission of a received credential grant. The handler
 * narrows notification form data into the workflow input and keeps IPEX admit
 * semantics out of presentational components.
 */
const admitCredentialGrantAction = ({
    runtime,
    formData,
    requestId,
}: CredentialActionContext): CredentialActionData => {
    const intent = 'admitCredentialGrant';
    const input: AdmitCredentialGrantInput = {
        holderAlias: formString(formData, 'holderAlias').trim(),
        holderAid: formString(formData, 'holderAid').trim(),
        notificationId: formString(formData, 'notificationId').trim(),
        grantSaid: formString(formData, 'grantSaid').trim(),
    };
    if (
        input.holderAlias.length === 0 ||
        input.holderAid.length === 0 ||
        input.notificationId.length === 0 ||
        input.grantSaid.length === 0
    ) {
        return {
            intent,
            ok: false,
            message:
                'Holder identifier, notification, and grant SAID are required.',
            requestId,
        };
    }

    return credentialStartedResult(
        intent,
        runtime.credentials.startAdmit(input, requestIdOption(requestId)),
        `Admitting credential grant ${input.grantSaid}`
    );
};

/**
 * Starts W3C presentation for an admitted VRD credential.
 */
const presentCredentialAction = ({
    runtime,
    formData,
    requestId,
}: CredentialActionContext): CredentialActionData => {
    const intent = 'presentCredential';
    const verifierRequest = verifierRequestFromForm(formData);
    const input: PresentCredentialInput = {
        presenterAlias: formString(formData, 'presenterAlias').trim(),
        presenterAid: formString(formData, 'presenterAid').trim(),
        credentialSaid: formString(formData, 'credentialSaid').trim(),
        verifierRequest: verifierRequest ?? {},
    };
    if (
        input.presenterAlias.length === 0 ||
        input.presenterAid.length === 0 ||
        input.credentialSaid.length === 0 ||
        verifierRequest === null
    ) {
        return {
            intent,
            ok: false,
            message:
                'Presenter identifier, credential, and verifier request JSON are required.',
            requestId,
        };
    }

    return credentialStartedResult(
        intent,
        runtime.credentials.startPresent(input, requestIdOption(requestId)),
        `Presenting credential ${input.credentialSaid}`
    );
};

/**
 * Dispatches credential route intents to named handlers. The explicit switch
 * is the local command map for this route family and should stay small enough
 * that each new credential workflow has to justify a branch.
 */
const runCredentialIntentAction = (
    context: CredentialActionContext
): CredentialActionData | Promise<CredentialActionData> => {
    switch (context.intent) {
        case 'refreshCredentials':
            return refreshCredentialsAction(context);
        case 'resolveSchema':
            return resolveCredentialSchemaAction(context);
        case 'createRegistry':
            return createCredentialRegistryAction(context);
        case 'issueCredential':
            return issueCredentialAction(context);
        case 'grantCredential':
            return grantCredentialAction(context);
        case 'startW3CIssuance':
            return startW3CIssuanceAction(context);
        case 'admitCredentialGrant':
            return admitCredentialGrantAction(context);
        case 'presentCredential':
            return presentCredentialAction(context);
        default:
            return {
                intent: 'unsupported',
                ok: false,
                message: `Unsupported credential action: ${
                    context.intent || 'missing intent'
                }`,
                requestId: context.requestId,
            };
    }
};

/**
 * Route action for credential workflow commands.
 *
 * Expected failures return typed action data for forms and notifications.
 * Unexpected programming failures are normalized only to a safe route message.
 */
export const credentialsAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<CredentialActionData> => {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');
    const requestId = formString(formData, 'requestId');
    const context: CredentialActionContext = {
        runtime,
        request,
        formData,
        intent,
        requestId,
    };

    if (runtime.getClient() === null) {
        return {
            intent: credentialIntentFromString(intent),
            ok: false,
            message: 'Connect to KERIA before changing credentials.',
            requestId,
        };
    }

    try {
        return await runCredentialIntentAction(context);
    } catch (error) {
        return {
            intent: credentialIntentFromString(intent),
            ok: false,
            message: toRouteError(error).message,
            requestId,
        };
    }
};
