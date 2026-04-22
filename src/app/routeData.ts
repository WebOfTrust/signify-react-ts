import { redirect } from 'react-router-dom';
import { appConfig } from '../config';
import type {
    IdentifierCreateDraft,
    IdentifierSummary,
} from '../features/identifiers/identifierTypes';
import type {
    MultisigCreateDraft,
    MultisigInteractionDraft,
    MultisigRequestActionInput,
    MultisigRotationDraft,
} from '../features/multisig/multisigTypes';
import {
    isMultisigThresholdSpec,
    thresholdSpecForMembers,
    type MultisigThresholdSith,
    type MultisigThresholdSpec,
} from '../features/multisig/multisigThresholds';
import { isIdentifierCreateDraft } from '../features/identifiers/identifierHelpers';
import type {
    OobiRole,
    ResolveContactInput,
} from '../services/contacts.service';
import {
    parseChallengeWords,
    validateChallengeWords,
} from '../features/contacts/challengeWords';
import type {
    GeneratedContactChallengeResult,
    GenerateContactChallengeInput,
    RespondToContactChallengeInput,
    SendChallengeRequestInput,
    VerifyContactChallengeInput,
} from '../workflows/challenges.op';
import type { DismissExchangeNotificationInput } from '../workflows/notifications.op';
import type { ApproveDelegationInput } from '../workflows/delegations.op';
import type {
    AdmitCredentialGrantInput,
    CreateCredentialRegistryInput,
    GrantCredentialInput,
    IssueSediCredentialInput,
    ResolveCredentialSchemaInput,
} from '../workflows/credentials.op';
import type {
    ConnectedSignifyClient,
    SignifyClientConfig,
    SignifyStateSummary,
} from '../signify/client';
import type { BackgroundWorkflowStartResult } from './runtime';

/**
 * Canonical route used for startup redirects, unknown paths, and successful
 * KERIA connection submissions.
 */
export const DEFAULT_APP_PATH = '/dashboard';

/**
 * Loader result used when a connected Signify client is required.
 */
export type BlockedRouteData = { status: 'blocked' };

/**
 * Loader data for the identifiers route.
 *
 * Identifier list failures are represented as `status: "error"` instead of a
 * thrown route error because the page can still render actionable diagnostic
 * text and keep the user in the connected shell.
 */
export type IdentifiersLoaderData =
    | { status: 'ready'; identifiers: IdentifierSummary[] }
    | { status: 'error'; identifiers: IdentifierSummary[]; message: string }
    | BlockedRouteData;

/**
 * Loader data for `/dashboard`.
 */
export type DashboardLoaderData =
    | { status: 'ready' }
    | { status: 'error'; message: string }
    | BlockedRouteData;

/**
 * Loader data for `/contacts`.
 */
export type ContactsLoaderData =
    | { status: 'ready' }
    | { status: 'error'; message: string }
    | BlockedRouteData;

/**
 * Loader data for `/notifications` and notification detail routes.
 */
export type NotificationsLoaderData =
    | { status: 'ready'; identifiers: IdentifierSummary[] }
    | { status: 'error'; identifiers: IdentifierSummary[]; message: string }
    | BlockedRouteData;

export interface MultisigGroupDetails {
    groupAlias: string;
    groupAid: string;
    signingMemberAids: string[];
    rotationMemberAids: string[];
    signingThreshold: MultisigThresholdSith | null;
    rotationThreshold: MultisigThresholdSith | null;
    sequence: string | null;
    digest: string | null;
}

/**
 * Loader data for `/multisig`.
 */
export type MultisigLoaderData =
    | {
          status: 'ready';
          identifiers: IdentifierSummary[];
          groupDetails: MultisigGroupDetails[];
      }
    | {
          status: 'error';
          identifiers: IdentifierSummary[];
          groupDetails: MultisigGroupDetails[];
          message: string;
      }
    | BlockedRouteData;

/**
 * Loader data for the client summary route.
 */
export type ClientLoaderData =
    | { status: 'ready'; summary: SignifyStateSummary }
    | BlockedRouteData;

/**
 * Loader data for the credentials route.
 */
export type CredentialsLoaderData =
    | { status: 'ready' }
    | { status: 'error'; message: string }
    | BlockedRouteData;

/**
 * Typed action result for root-level shell actions.
 *
 * Successful connect submissions return a React Router redirect, so this type
 * only models recoverable failures that should render inside the dialog.
 */
export type RootActionData =
    | { intent: 'connect'; ok: false; message: string }
    | { intent: 'generatePasscode'; ok: true; passcode: string }
    | { intent: 'generatePasscode'; ok: false; message: string }
    | { intent: 'unsupported'; ok: false; message: string };

/**
 * Typed action result for identifier mutations.
 */
export type IdentifierActionData =
    | {
          intent: 'create' | 'rotate';
          ok: true;
          message: string;
          requestId: string;
          operationRoute: string;
      }
    | {
          intent: 'create' | 'rotate' | 'unsupported';
          ok: false;
          message: string;
          requestId?: string;
          operationRoute?: string;
      };

/**
 * Typed action result for contact/OOBI mutations.
 */
export type ContactActionData =
    | {
          intent:
              | 'resolve'
              | 'generateOobi'
              | 'respondChallenge'
              | 'verifyChallenge'
              | 'dismissExchangeNotification'
              | 'approveDelegationRequest'
              | 'delete'
              | 'updateAlias';
          ok: true;
          message: string;
          requestId: string;
          operationRoute: string;
      }
    | {
          intent: 'generateChallenge';
          ok: true;
          message: string;
          requestId: string;
          operationRoute: string;
          challenge: GeneratedContactChallengeResult;
      }
    | {
          intent:
              | 'resolve'
              | 'generateOobi'
              | 'generateChallenge'
              | 'respondChallenge'
              | 'verifyChallenge'
              | 'dismissExchangeNotification'
              | 'approveDelegationRequest'
              | 'delete'
              | 'updateAlias'
              | 'unsupported';
          ok: false;
          message: string;
          requestId?: string;
          operationRoute?: string;
      };

/**
 * Typed action result for credential workflow commands.
 */
export type CredentialActionData =
    | {
          intent:
              | 'resolveSchema'
              | 'createRegistry'
              | 'issueCredential'
              | 'grantCredential'
              | 'admitCredentialGrant'
              | 'refreshCredentials';
          ok: true;
          message: string;
          requestId: string;
          operationRoute: string;
      }
    | {
          intent:
              | 'resolveSchema'
              | 'createRegistry'
              | 'issueCredential'
              | 'grantCredential'
              | 'admitCredentialGrant'
              | 'refreshCredentials'
              | 'unsupported';
          ok: false;
          message: string;
          requestId?: string;
          operationRoute?: string;
      };

/**
 * Typed action result for multisig group workflows.
 */
export type MultisigActionData =
    | {
          intent:
              | 'create'
              | 'acceptInception'
              | 'joinInception'
              | 'authorizeAgents'
              | 'acceptEndRole'
              | 'interact'
              | 'acceptInteraction'
              | 'rotate'
              | 'acceptRotation'
              | 'joinRotation';
          ok: true;
          message: string;
          requestId: string;
          operationRoute: string;
      }
    | {
          intent:
              | 'create'
              | 'acceptInception'
              | 'joinInception'
              | 'authorizeAgents'
              | 'acceptEndRole'
              | 'interact'
              | 'acceptInteraction'
              | 'rotate'
              | 'acceptRotation'
              | 'joinRotation'
              | 'unsupported';
          ok: false;
          message: string;
          requestId?: string;
          operationRoute?: string;
      };

/**
 * Minimal connected-client shape route data needs for diagnostics.
 */
interface RouteClient {
    /** KERIA admin URL shown in identifier-loader failure guidance. */
    url?: string;
    /** Optional live Signify identifier API used for group member detail hydration. */
    identifiers?: () => {
        members: (name: string) => Promise<unknown>;
    };
}

/**
 * Runtime surface consumed by route loaders and actions.
 *
 * The interface is narrower than `AppRuntime` so loader/action unit tests can
 * use cheap fakes and so route-data code cannot reach unrelated session
 * internals by accident.
 */
export interface RouteDataRuntime {
    /** Return the connected client shape, or `null` when disconnected. */
    getClient(): RouteClient | null;
    /** Return the latest normalized Signify state, or `null` when disconnected. */
    getState(): SignifyStateSummary | null;
    /** Connect and publish runtime connection state. */
    connect(
        config: SignifyClientConfig,
        options?: { signal?: AbortSignal; requestId?: string }
    ): Promise<ConnectedSignifyClient | null>;
    /** Generate a Signify passcode after Signify WASM readiness completes. */
    generatePasscode(options?: { signal?: AbortSignal }): Promise<string>;
    /** Refresh the normalized Signify state through the connected client. */
    refreshState(options?: {
        signal?: AbortSignal;
    }): Promise<SignifyStateSummary | null>;
    /** Load and normalize identifiers through the connected client. */
    listIdentifiers(options?: {
        signal?: AbortSignal;
    }): Promise<IdentifierSummary[]>;
    /** Load live contact, challenge, and protocol notification facts. */
    syncSessionInventory(options?: { signal?: AbortSignal }): Promise<unknown>;
    /** Load holder-side credential inventory. */
    syncCredentialInventory(options?: {
        signal?: AbortSignal;
    }): Promise<unknown>;
    /** Load issuer-side credential registry inventory. */
    syncCredentialRegistries(options?: {
        signal?: AbortSignal;
    }): Promise<unknown>;
    /** Load credential-linked IPEX exchange activity. */
    syncCredentialIpexActivity(options?: {
        signal?: AbortSignal;
    }): Promise<unknown>;
    /** Detect app-supported schemas the connected agent already knows. */
    syncKnownCredentialSchemas(options?: {
        signal?: AbortSignal;
    }): Promise<unknown>;
    /** Create an identifier and wait for its KERIA operation to complete. */
    createIdentifier(
        draft: IdentifierCreateDraft,
        options?: { signal?: AbortSignal; requestId?: string }
    ): Promise<IdentifierSummary[]>;
    /** Rotate an identifier and wait for its KERIA operation to complete. */
    rotateIdentifier(
        aid: string,
        options?: { signal?: AbortSignal; requestId?: string }
    ): Promise<IdentifierSummary[]>;
    /** Start identifier creation in the background. */
    startCreateIdentifier(
        draft: IdentifierCreateDraft,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start identifier rotation in the background. */
    startRotateIdentifier(
        aid: string,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start multisig group inception in the background. */
    startCreateMultisigGroup(
        draft: MultisigCreateDraft,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Accept a multisig inception request in the background. */
    startAcceptMultisigInception(
        input: MultisigRequestActionInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Authorize member agent endpoints for a multisig group. */
    startAuthorizeMultisigAgents(
        input: { groupAlias: string; localMemberName?: string | null },
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Accept a multisig endpoint role request in the background. */
    startAcceptMultisigEndRole(
        input: MultisigRequestActionInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start a multisig interaction in the background. */
    startInteractMultisigGroup(
        draft: MultisigInteractionDraft,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Accept a multisig interaction request in the background. */
    startAcceptMultisigInteraction(
        input: MultisigRequestActionInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start a multisig rotation in the background. */
    startRotateMultisigGroup(
        draft: MultisigRotationDraft,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Accept a multisig rotation request in the background. */
    startAcceptMultisigRotation(
        input: MultisigRequestActionInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Join a multisig group through a rotation request. */
    startJoinMultisigRotation(
        input: MultisigRequestActionInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start OOBI generation in the background. */
    startGenerateOobi(
        input: { identifier: string; role: OobiRole },
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start contact OOBI resolution in the background. */
    startResolveContact(
        input: ResolveContactInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start contact deletion in the background. */
    startDeleteContact(
        contactId: string,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start contact alias update in the background. */
    startUpdateContactAlias(
        input: { contactId: string; alias: string },
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Generate challenge words and record them in session state. */
    generateContactChallenge(
        input: GenerateContactChallengeInput,
        options?: { signal?: AbortSignal; requestId?: string }
    ): Promise<GeneratedContactChallengeResult>;
    /** Start challenge response sending in the background. */
    startRespondToChallenge(
        input: RespondToContactChallengeInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start challenge request notification sending in the background. */
    startSendChallengeRequest(
        input: SendChallengeRequestInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start challenger-side verification in the background. */
    startVerifyContactChallenge(
        input: VerifyContactChallengeInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Locally tombstone and optionally delete a KERIA notification note. */
    dismissExchangeNotification(
        input: DismissExchangeNotificationInput,
        options?: { signal?: AbortSignal; requestId?: string }
    ): Promise<void>;
    /** Start manual delegation approval in the background. */
    startApproveDelegation(
        input: ApproveDelegationInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start adding the SEDI credential schema type in the background. */
    startResolveCredentialSchema(
        input: ResolveCredentialSchemaInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start issuer registry creation in the background. */
    startCreateCredentialRegistry(
        input: CreateCredentialRegistryInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start issuer-side credential issuance in the background. */
    startIssueCredential(
        input: IssueSediCredentialInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start issuer-side IPEX grant in the background. */
    startGrantCredential(
        input: GrantCredentialInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
    /** Start holder-side IPEX grant admit in the background. */
    startAdmitCredentialGrant(
        input: AdmitCredentialGrantInput,
        options?: { requestId?: string }
    ): BackgroundWorkflowStartResult;
}

/**
 * Read a form field as a string, using an empty string for missing values.
 */
const formString = (formData: FormData, field: string): string => {
    const value = formData.get(field);
    return typeof value === 'string' ? value : '';
};

/**
 * Normalize unknown route-action failures without importing Signify readiness.
 */
const toRouteError = (error: unknown): Error =>
    error instanceof Error ? error : new Error(String(error));

/**
 * Parse the serialized typed create draft submitted by `IdentifiersView`.
 */
const parseIdentifierCreateDraft = (
    value: string
): IdentifierCreateDraft | null => {
    if (value.trim().length === 0) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        return isIdentifierCreateDraft(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;

const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === 'string');

const isNestedStringArray = (value: unknown): value is string[][] =>
    Array.isArray(value) && value.every(isStringArray);

const isSithValue = (value: unknown): value is MultisigThresholdSith =>
    typeof value === 'string' ||
    typeof value === 'number' ||
    isStringArray(value) ||
    isNestedStringArray(value);

const aidValue = (entry: unknown): string | null => {
    if (!isRecord(entry)) {
        return null;
    }

    const state = isRecord(entry.state) ? entry.state : {};
    const candidates = [entry.prefix, entry.aid, state.i];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
        }
    }

    return null;
};

const groupMembersFromResponse = (
    response: unknown,
    role: 'signing' | 'rotation'
): string[] => {
    const record = isRecord(response) ? response : {};
    const entries = Array.isArray(record[role]) ? record[role] : [];
    const seen = new Set<string>();
    const aids: string[] = [];
    for (const entry of entries) {
        const aid = aidValue(entry);
        if (aid !== null && !seen.has(aid)) {
            seen.add(aid);
            aids.push(aid);
        }
    }
    return aids;
};

const groupDetailsFromIdentifier = async (
    runtime: RouteDataRuntime,
    identifier: IdentifierSummary
): Promise<MultisigGroupDetails> => {
    const state: Record<string, unknown> = isRecord(identifier.state)
        ? (identifier.state as Record<string, unknown>)
        : {};
    let signingMemberAids: string[] = [];
    let rotationMemberAids: string[] = [];
    try {
        const response = await runtime
            .getClient()
            ?.identifiers?.()
            .members(identifier.name);
        signingMemberAids = groupMembersFromResponse(response, 'signing');
        rotationMemberAids = groupMembersFromResponse(response, 'rotation');
    } catch {
        // Missing member details should not block rendering the multisig page.
    }

    return {
        groupAlias: identifier.name,
        groupAid: identifier.prefix,
        signingMemberAids,
        rotationMemberAids:
            rotationMemberAids.length > 0 ? rotationMemberAids : signingMemberAids,
        signingThreshold: isSithValue(state.kt) ? state.kt : null,
        rotationThreshold: isSithValue(state.nt) ? state.nt : null,
        sequence: typeof state.s === 'string' ? state.s : null,
        digest: typeof state.d === 'string' ? state.d : null,
    };
};

const isThresholdSpec = (value: unknown): value is MultisigThresholdSpec =>
    isMultisigThresholdSpec(value);

const parseJsonRecord = (value: string): Record<string, unknown> | null => {
    if (value.trim().length === 0) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(value);
        return isRecord(parsed) ? parsed : null;
    } catch {
        return null;
    }
};

const parseMultisigCreateDraft = (
    value: string
): MultisigCreateDraft | null => {
    const parsed = parseJsonRecord(value);
    if (parsed === null) {
        return null;
    }

    const signingMemberAids = parsed.signingMemberAids;
    const rotationMemberAids = parsed.rotationMemberAids;
    if (
        typeof parsed.groupAlias !== 'string' ||
        parsed.groupAlias.trim().length === 0 ||
        typeof parsed.localMemberName !== 'string' ||
        parsed.localMemberName.trim().length === 0 ||
        typeof parsed.localMemberAid !== 'string' ||
        parsed.localMemberAid.trim().length === 0 ||
        !Array.isArray(parsed.members) ||
        !isStringArray(signingMemberAids) ||
        !isStringArray(rotationMemberAids)
    ) {
        return null;
    }

    return {
        groupAlias: parsed.groupAlias,
        localMemberName: parsed.localMemberName,
        localMemberAid: parsed.localMemberAid,
        members: parsed.members.flatMap((member) =>
            isRecord(member) &&
            typeof member.aid === 'string' &&
            typeof member.alias === 'string'
                ? [
                      {
                          aid: member.aid,
                          alias: member.alias,
                          source:
                              member.source === 'local' ||
                              member.source === 'contact' ||
                              member.source === 'manual'
                                  ? member.source
                                  : 'manual',
                      },
                  ]
                : []
        ),
        signingMemberAids,
        rotationMemberAids,
        signingThreshold: isThresholdSpec(parsed.signingThreshold)
            ? parsed.signingThreshold
            : thresholdSpecForMembers(signingMemberAids),
        rotationThreshold: isThresholdSpec(parsed.rotationThreshold)
            ? parsed.rotationThreshold
            : thresholdSpecForMembers(rotationMemberAids),
        witnessMode: parsed.witnessMode === 'demo' ? 'demo' : 'none',
    };
};

const parseMultisigInteractionDraft = (
    formData: FormData
): MultisigInteractionDraft | null => {
    const groupAlias = formString(formData, 'groupAlias').trim();
    if (groupAlias.length === 0) {
        return null;
    }

    const rawData = formString(formData, 'data').trim();
    let data: unknown = {};
    if (rawData.length > 0) {
        try {
            data = JSON.parse(rawData);
        } catch {
            data = rawData;
        }
    }

    return {
        groupAlias,
        localMemberName: formString(formData, 'localMemberName').trim() || null,
        data,
    };
};

const parseMultisigRotationDraft = (
    value: string
): MultisigRotationDraft | null => {
    const parsed = parseJsonRecord(value);
    if (parsed === null) {
        return null;
    }

    if (
        typeof parsed.groupAlias !== 'string' ||
        parsed.groupAlias.trim().length === 0 ||
        !isStringArray(parsed.signingMemberAids) ||
        !isStringArray(parsed.rotationMemberAids)
    ) {
        return null;
    }

    return {
        groupAlias: parsed.groupAlias,
        localMemberName:
            typeof parsed.localMemberName === 'string'
                ? parsed.localMemberName
                : null,
        signingMemberAids: parsed.signingMemberAids,
        rotationMemberAids: parsed.rotationMemberAids,
        nextThreshold: isThresholdSpec(parsed.nextThreshold)
            ? parsed.nextThreshold
            : thresholdSpecForMembers(parsed.rotationMemberAids),
    };
};

const parseMultisigRequestInput = (
    formData: FormData
): MultisigRequestActionInput | null => {
    const exnSaid = formString(formData, 'exnSaid').trim();
    const groupAlias = formString(formData, 'groupAlias').trim();
    const localMemberName = formString(formData, 'localMemberName').trim();
    if (
        exnSaid.length === 0 ||
        groupAlias.length === 0 ||
        localMemberName.length === 0
    ) {
        return null;
    }

    return {
        notificationId: formString(formData, 'notificationId').trim() || null,
        exnSaid,
        groupAlias,
        localMemberName,
    };
};

const parseOobiRole = (value: string): OobiRole | null =>
    value === 'agent' || value === 'witness' ? value : null;

const contactIntentFromString = (
    value: string
): Exclude<ContactActionData['intent'], 'unsupported'> =>
    value === 'generateOobi' ||
    value === 'generateChallenge' ||
    value === 'respondChallenge' ||
    value === 'verifyChallenge' ||
    value === 'dismissExchangeNotification' ||
    value === 'approveDelegationRequest' ||
    value === 'delete' ||
    value === 'updateAlias'
        ? value
        : 'resolve';

const credentialIntentFromString = (
    value: string
): Exclude<CredentialActionData['intent'], 'unsupported'> =>
    value === 'createRegistry' ||
    value === 'issueCredential' ||
    value === 'grantCredential' ||
    value === 'admitCredentialGrant' ||
    value === 'refreshCredentials'
        ? value
        : 'resolveSchema';

const formBoolean = (formData: FormData, field: string): boolean => {
    const value = formString(formData, field).trim().toLowerCase();
    return value === 'true' || value === 'on' || value === '1';
};

/**
 * Loader for `/dashboard`.
 */
export const loadDashboard = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<DashboardLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    try {
        await runtime.listIdentifiers({ signal: request?.signal });
        await Promise.all([
            runtime.syncSessionInventory({ signal: request?.signal }),
            runtime.syncKnownCredentialSchemas({ signal: request?.signal }),
            runtime.syncCredentialRegistries({ signal: request?.signal }),
            runtime.syncCredentialInventory({ signal: request?.signal }),
        ]);
        await runtime.syncCredentialIpexActivity({ signal: request?.signal });
        return { status: 'ready' };
    } catch (error) {
        return {
            status: 'error',
            message: `Unable to refresh dashboard inventory: ${toRouteError(error).message}`,
        };
    }
};

/**
 * Loader for `/contacts`.
 */
export const loadContacts = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<ContactsLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    try {
        await Promise.all([
            runtime.listIdentifiers({ signal: request?.signal }),
            runtime.syncSessionInventory({ signal: request?.signal }),
        ]);
        return { status: 'ready' };
    } catch (error) {
        return {
            status: 'error',
            message: `Unable to refresh contact inventory: ${toRouteError(error).message}`,
        };
    }
};

/**
 * Loader for `/notifications`.
 */
export const loadNotifications = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<NotificationsLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    try {
        const [identifiers] = await Promise.all([
            runtime.listIdentifiers({ signal: request?.signal }),
            runtime.syncSessionInventory({ signal: request?.signal }),
        ]);
        return { status: 'ready', identifiers };
    } catch (error) {
        return {
            status: 'error',
            identifiers: [],
            message: `Unable to refresh notifications: ${toRouteError(error).message}`,
        };
    }
};

/**
 * Loader for `/identifiers`.
 *
 * A disconnected route returns blocked data so direct navigation renders the
 * connection-required state. Identifier list failures are recoverable and
 * returned as typed loader data because the user may still be connected and
 * able to retry after fixing KERIA CORS or network setup.
 */
export const loadIdentifiers = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<IdentifiersLoaderData> => {
    const client = runtime.getClient();
    if (client === null) {
        return { status: 'blocked' };
    }

    try {
        return {
            status: 'ready',
            identifiers: await runtime.listIdentifiers({
                signal: request?.signal,
            }),
        };
    } catch (error) {
        const normalized = toRouteError(error);
        return {
            status: 'error',
            identifiers: [],
            message: `Unable to load identifiers: ${normalized.message}. Connect can succeed even when the browser blocks signed KERIA resource requests; check that ${client.url ?? 'KERIA'} is reachable from this page and allows the Signify signed-request headers.`,
        };
    }
};

/**
 * Loader for `/multisig`.
 */
export const loadMultisig = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<MultisigLoaderData> => {
    const client = runtime.getClient();
    if (client === null) {
        return { status: 'blocked' };
    }

    try {
        const [identifiers] = await Promise.all([
            runtime.listIdentifiers({ signal: request?.signal }),
            runtime.syncSessionInventory({ signal: request?.signal }),
        ]);
        const groupDetails = await Promise.all(
            identifiers
                .filter((identifier) => 'group' in identifier)
                .map((identifier) => groupDetailsFromIdentifier(runtime, identifier))
        );
        return { status: 'ready', identifiers, groupDetails };
    } catch (error) {
        return {
            status: 'error',
            identifiers: [],
            groupDetails: [],
            message: `Unable to load multisig inventory: ${toRouteError(error).message}`,
        };
    }
};

/**
 * Loader for `/client`.
 *
 * This refreshes the Signify state snapshot through the shared runtime so the
 * client summary route shows current controller/agent data after route
 * navigation and post-action revalidation.
 */
export const loadClient = async (
    runtime: RouteDataRuntime,
    request?: Request
): Promise<ClientLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    const summary =
        (await runtime.refreshState({ signal: request?.signal })) ??
        runtime.getState();
    return summary === null
        ? { status: 'blocked' }
        : { status: 'ready', summary };
};

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
        await runtime.listIdentifiers({ signal: request?.signal });
        await Promise.all([
            runtime.syncSessionInventory({ signal: request?.signal }),
            runtime.syncKnownCredentialSchemas({ signal: request?.signal }),
            runtime.syncCredentialRegistries({ signal: request?.signal }),
            runtime.syncCredentialInventory({ signal: request?.signal }),
        ]);
        await runtime.syncCredentialIpexActivity({ signal: request?.signal });
        return { status: 'ready' };
    } catch (error) {
        return {
            status: 'error',
            message: `Unable to refresh credential inventory: ${toRouteError(error).message}`,
        };
    }
};

/**
 * Root route action for shell-level commands.
 *
 * Currently this handles connect-dialog submissions and passcode generation.
 * Successful connections redirect to the default route; recoverable failures
 * return typed action data for the dialog instead of throwing into the root
 * error boundary.
 */
export const rootAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<Response | RootActionData> => {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');

    if (intent === 'generatePasscode') {
        try {
            return {
                intent,
                ok: true,
                passcode: await runtime.generatePasscode({
                    signal: request.signal,
                }),
            };
        } catch (error) {
            return {
                intent,
                ok: false,
                message: toRouteError(error).message,
            };
        }
    }

    if (intent === 'connect') {
        const connected = await runtime.connect(
            {
                adminUrl: formString(formData, 'adminUrl'),
                bootUrl: formString(formData, 'bootUrl'),
                passcode: formString(formData, 'passcode'),
                tier: appConfig.defaultTier,
            },
            { signal: request.signal }
        );

        if (connected !== null) {
            return redirect(DEFAULT_APP_PATH);
        }

        return {
            intent,
            ok: false,
            message: 'Unable to connect to KERIA with the supplied passcode.',
        };
    }

    return {
        intent: 'unsupported',
        ok: false,
        message: `Unsupported root action: ${intent || 'missing intent'}`,
    };
};

/**
 * Route action for identifier mutations.
 *
 * Create and rotate are intent-based because both mutate the same route data
 * and should trigger identifier-loader revalidation after completion.
 */
export const identifiersAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<IdentifierActionData> => {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');

    if (runtime.getClient() === null) {
        return {
            intent: intent === 'rotate' ? 'rotate' : 'create',
            ok: false,
            message: 'Connect to KERIA before changing identifiers.',
        };
    }

    if (intent === 'create') {
        const requestId = formString(formData, 'requestId');
        const draft = parseIdentifierCreateDraft(formString(formData, 'draft'));
        if (draft === null) {
            return {
                intent,
                ok: false,
                message: 'Invalid identifier create draft.',
                requestId,
            };
        }

        try {
            const started = runtime.startCreateIdentifier(draft, {
                requestId: requestId || undefined,
            });
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
                message: `Creating identifier ${draft.name}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        } catch (error) {
            return {
                intent,
                ok: false,
                message: toRouteError(error).message,
                requestId,
            };
        }
    }

    if (intent === 'rotate') {
        const aid = formString(formData, 'aid');
        const requestId = formString(formData, 'requestId');
        try {
            const started = runtime.startRotateIdentifier(aid, {
                requestId: requestId || undefined,
            });
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
                message: `Rotating identifier ${aid}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        } catch (error) {
            return {
                intent,
                ok: false,
                message: toRouteError(error).message,
                requestId,
            };
        }
    }

    return {
        intent: 'unsupported',
        ok: false,
        message: `Unsupported identifier action: ${intent || 'missing intent'}`,
    };
};

const multisigIntentFromString = (
    value: string
): Exclude<MultisigActionData['intent'], 'unsupported'> =>
    value === 'acceptInception' ||
    value === 'joinInception' ||
    value === 'authorizeAgents' ||
    value === 'acceptEndRole' ||
    value === 'interact' ||
    value === 'acceptInteraction' ||
    value === 'rotate' ||
    value === 'acceptRotation' ||
    value === 'joinRotation'
        ? value
        : 'create';

const multisigActionStarted = (
    intent: Exclude<MultisigActionData['intent'], 'unsupported'>,
    started: BackgroundWorkflowStartResult,
    message: string
): MultisigActionData => {
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
 * Route action for multisig group workflows.
 */
export const multisigAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<MultisigActionData> => {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');
    const requestId = formString(formData, 'requestId');
    const typedIntent = multisigIntentFromString(intent);

    if (runtime.getClient() === null) {
        return {
            intent: typedIntent,
            ok: false,
            message: 'Connect to KERIA before changing multisig groups.',
            requestId,
        };
    }

    try {
        if (intent === 'create') {
            const draft = parseMultisigCreateDraft(
                formString(formData, 'draft')
            );
            if (draft === null) {
                return {
                    intent,
                    ok: false,
                    message: 'Invalid multisig group draft.',
                    requestId,
                };
            }

            return multisigActionStarted(
                intent,
                runtime.startCreateMultisigGroup(draft, {
                    requestId: requestId || undefined,
                }),
                `Creating multisig group ${draft.groupAlias}`
            );
        }

        if (intent === 'authorizeAgents') {
            const groupAlias = formString(formData, 'groupAlias').trim();
            if (groupAlias.length === 0) {
                return {
                    intent,
                    ok: false,
                    message: 'Group alias is required.',
                    requestId,
                };
            }

            return multisigActionStarted(
                intent,
                runtime.startAuthorizeMultisigAgents(
                    {
                        groupAlias,
                        localMemberName:
                            formString(formData, 'localMemberName').trim() ||
                            null,
                    },
                    { requestId: requestId || undefined }
                ),
                `Authorizing agents for ${groupAlias}`
            );
        }

        if (intent === 'interact') {
            const draft = parseMultisigInteractionDraft(formData);
            if (draft === null) {
                return {
                    intent,
                    ok: false,
                    message: 'Group alias is required.',
                    requestId,
                };
            }

            return multisigActionStarted(
                intent,
                runtime.startInteractMultisigGroup(draft, {
                    requestId: requestId || undefined,
                }),
                `Interacting with ${draft.groupAlias}`
            );
        }

        if (intent === 'rotate') {
            const draft = parseMultisigRotationDraft(
                formString(formData, 'draft')
            );
            if (draft === null) {
                return {
                    intent,
                    ok: false,
                    message: 'Invalid multisig rotation draft.',
                    requestId,
                };
            }

            return multisigActionStarted(
                intent,
                runtime.startRotateMultisigGroup(draft, {
                    requestId: requestId || undefined,
                }),
                `Rotating multisig group ${draft.groupAlias}`
            );
        }

        if (
            intent === 'acceptInception' ||
            intent === 'joinInception' ||
            intent === 'acceptEndRole' ||
            intent === 'acceptInteraction' ||
            intent === 'acceptRotation' ||
            intent === 'joinRotation'
        ) {
            const input = parseMultisigRequestInput(formData);
            if (input === null) {
                return {
                    intent,
                    ok: false,
                    message:
                        'Notification SAID, group alias, and local member are required.',
                    requestId,
                };
            }

            const started =
                intent === 'acceptInception' || intent === 'joinInception'
                    ? runtime.startAcceptMultisigInception(input, {
                          requestId: requestId || undefined,
                      })
                    : intent === 'acceptEndRole'
                      ? runtime.startAcceptMultisigEndRole(input, {
                            requestId: requestId || undefined,
                        })
                      : intent === 'acceptInteraction'
                        ? runtime.startAcceptMultisigInteraction(input, {
                              requestId: requestId || undefined,
                          })
                        : intent === 'acceptRotation'
                          ? runtime.startAcceptMultisigRotation(input, {
                                requestId: requestId || undefined,
                            })
                          : runtime.startJoinMultisigRotation(input, {
                                requestId: requestId || undefined,
                            });

            return multisigActionStarted(
                intent,
                started,
                intent === 'joinInception'
                    ? `Joining multisig group ${input.groupAlias}`
                    : `Handling multisig request for ${input.groupAlias}`
            );
        }

        return {
            intent: 'unsupported',
            ok: false,
            message: `Unsupported multisig action: ${intent || 'missing intent'}`,
            requestId,
        };
    } catch (error) {
        return {
            intent: typedIntent,
            ok: false,
            message: toRouteError(error).message,
            requestId,
        };
    }
};

/**
 * Route action for contact/OOBI mutations.
 */
export const contactsAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<ContactActionData> => {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');
    const requestId = formString(formData, 'requestId');

    if (runtime.getClient() === null) {
        return {
            intent: contactIntentFromString(intent),
            ok: false,
            message: 'Connect to KERIA before changing contacts.',
            requestId,
        };
    }

    try {
        if (intent === 'resolve') {
            const oobi = formString(formData, 'oobi').trim();
            const alias = formString(formData, 'alias').trim();
            if (oobi.length === 0) {
                return {
                    intent,
                    ok: false,
                    message: 'OOBI URL is required.',
                    requestId,
                };
            }

            const started = runtime.startResolveContact(
                {
                    oobi,
                    alias: alias.length > 0 ? alias : null,
                },
                { requestId: requestId || undefined }
            );
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
                message: 'Resolving contact OOBI',
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }

        if (intent === 'generateOobi') {
            const identifier = formString(formData, 'identifier').trim();
            const role = parseOobiRole(formString(formData, 'role'));
            if (identifier.length === 0 || role === null) {
                return {
                    intent,
                    ok: false,
                    message: 'Identifier and OOBI role are required.',
                    requestId,
                };
            }

            const started = runtime.startGenerateOobi(
                { identifier, role },
                { requestId: requestId || undefined }
            );
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
                message: `Generating ${role} OOBI for ${identifier}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }

        if (intent === 'generateChallenge') {
            const contactId = formString(formData, 'contactId').trim();
            const contactAlias = formString(formData, 'contactAlias').trim();
            const localIdentifier = formString(
                formData,
                'localIdentifier'
            ).trim();
            const localAid = formString(formData, 'localAid').trim();
            if (contactId.length === 0 || localIdentifier.length === 0) {
                return {
                    intent,
                    ok: false,
                    message: 'Contact id and local identifier are required.',
                    requestId,
                };
            }

            const generated = await runtime.generateContactChallenge(
                {
                    counterpartyAid: contactId,
                    counterpartyAlias:
                        contactAlias.length > 0 ? contactAlias : null,
                    localIdentifier,
                    localAid: localAid.length > 0 ? localAid : null,
                },
                { signal: request.signal }
            );
            runtime.startSendChallengeRequest(
                {
                    challengeId: generated.challengeId,
                    counterpartyAid: generated.counterpartyAid,
                    counterpartyAlias: generated.counterpartyAlias,
                    localIdentifier: generated.localIdentifier,
                    localAid: generated.localAid,
                    wordsHash: generated.wordsHash,
                    strength: generated.strength,
                },
                {
                    requestId: requestId
                        ? `${requestId}:challenge-request`
                        : undefined,
                }
            );
            const started = runtime.startVerifyContactChallenge(
                {
                    challengeId: generated.challengeId,
                    counterpartyAid: generated.counterpartyAid,
                    counterpartyAlias: generated.counterpartyAlias,
                    localIdentifier: generated.localIdentifier,
                    localAid: generated.localAid,
                    words: generated.words,
                    wordsHash: generated.wordsHash,
                    generatedAt: generated.generatedAt,
                },
                { requestId: requestId || undefined }
            );
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
                message:
                    'Generated challenge, sent request, and started verification',
                requestId: started.requestId,
                operationRoute: started.operationRoute,
                challenge: generated,
            };
        }

        if (intent === 'respondChallenge') {
            const notificationId = formString(
                formData,
                'notificationId'
            ).trim();
            const challengeId = formString(formData, 'challengeId').trim();
            const wordsHash = formString(formData, 'wordsHash').trim();
            const contactId = formString(formData, 'contactId').trim();
            const contactAlias = formString(formData, 'contactAlias').trim();
            const localIdentifier = formString(
                formData,
                'localIdentifier'
            ).trim();
            const localAid = formString(formData, 'localAid').trim();
            const words = parseChallengeWords(formString(formData, 'words'));
            const wordError = validateChallengeWords(words);
            if (contactId.length === 0 || localIdentifier.length === 0) {
                return {
                    intent,
                    ok: false,
                    message: 'Contact id and local identifier are required.',
                    requestId,
                };
            }

            if (wordError !== null) {
                return {
                    intent,
                    ok: false,
                    message: wordError,
                    requestId,
                };
            }

            const started = runtime.startRespondToChallenge(
                {
                    challengeId:
                        challengeId.length > 0
                            ? challengeId
                            : requestId || undefined,
                    notificationId:
                        notificationId.length > 0 ? notificationId : undefined,
                    wordsHash: wordsHash.length > 0 ? wordsHash : null,
                    counterpartyAid: contactId,
                    counterpartyAlias:
                        contactAlias.length > 0 ? contactAlias : null,
                    localIdentifier,
                    localAid: localAid.length > 0 ? localAid : null,
                    words,
                },
                { requestId: requestId || undefined }
            );
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
                message: `Sending challenge response to ${contactId}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }

        if (intent === 'verifyChallenge') {
            const challengeId = formString(formData, 'challengeId').trim();
            const contactId = formString(formData, 'contactId').trim();
            const contactAlias = formString(formData, 'contactAlias').trim();
            const localIdentifier = formString(
                formData,
                'localIdentifier'
            ).trim();
            const localAid = formString(formData, 'localAid').trim();
            const words = parseChallengeWords(formString(formData, 'words'));
            const wordsHash = formString(formData, 'wordsHash').trim();
            const generatedAt = formString(formData, 'generatedAt').trim();
            const wordError = validateChallengeWords(words);
            if (
                challengeId.length === 0 ||
                contactId.length === 0 ||
                localIdentifier.length === 0
            ) {
                return {
                    intent,
                    ok: false,
                    message:
                        'Challenge id, contact id, and local identifier are required.',
                    requestId,
                };
            }

            if (wordError !== null) {
                return {
                    intent,
                    ok: false,
                    message: wordError,
                    requestId,
                };
            }

            const started = runtime.startVerifyContactChallenge(
                {
                    challengeId,
                    counterpartyAid: contactId,
                    counterpartyAlias:
                        contactAlias.length > 0 ? contactAlias : null,
                    localIdentifier,
                    localAid: localAid.length > 0 ? localAid : null,
                    words,
                    wordsHash: wordsHash.length > 0 ? wordsHash : null,
                    generatedAt: generatedAt.length > 0 ? generatedAt : null,
                },
                { requestId: requestId || undefined }
            );
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
                message: `Waiting for challenge response from ${contactId}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }

        if (intent === 'dismissExchangeNotification') {
            const notificationId = formString(
                formData,
                'notificationId'
            ).trim();
            const exnSaid = formString(formData, 'exnSaid').trim();
            const route = formString(formData, 'route').trim();
            if (
                notificationId.length === 0 ||
                exnSaid.length === 0 ||
                route.length === 0
            ) {
                return {
                    intent,
                    ok: false,
                    message:
                        'Notification id, EXN SAID, and route are required.',
                    requestId,
                };
            }

            await runtime.dismissExchangeNotification(
                { notificationId, exnSaid, route },
                { requestId: requestId || undefined, signal: request.signal }
            );

            return {
                intent,
                ok: true,
                message: 'Exchange notification dismissed.',
                requestId: requestId || '',
                operationRoute: '/notifications',
            };
        }

        if (intent === 'approveDelegationRequest') {
            const notificationId = formString(
                formData,
                'notificationId'
            ).trim();
            const delegatorName = formString(formData, 'delegatorName').trim();
            const delegatorAid = formString(formData, 'delegatorAid').trim();
            const delegateAid = formString(formData, 'delegateAid').trim();
            const delegateEventSaid = formString(
                formData,
                'delegateEventSaid'
            ).trim();
            const sequence = formString(formData, 'sequence').trim();
            const sourceAid = formString(formData, 'sourceAid').trim();
            const createdAt = formString(formData, 'createdAt').trim();
            if (
                notificationId.length === 0 ||
                delegatorName.length === 0 ||
                delegatorAid.length === 0 ||
                delegateAid.length === 0 ||
                delegateEventSaid.length === 0 ||
                sequence.length === 0 ||
                createdAt.length === 0
            ) {
                return {
                    intent,
                    ok: false,
                    message:
                        'Notification id, delegator, delegate event, sequence, and request time are required.',
                    requestId,
                };
            }

            const started = runtime.startApproveDelegation(
                {
                    notificationId,
                    delegatorName,
                    request: {
                        notificationId,
                        delegatorAid,
                        delegateAid,
                        delegateEventSaid,
                        sequence,
                        anchor: {
                            i: delegateAid,
                            s: sequence,
                            d: delegateEventSaid,
                        },
                        sourceAid: sourceAid.length > 0 ? sourceAid : null,
                        createdAt,
                        status: 'actionable',
                    },
                },
                { requestId: requestId || undefined }
            );
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
                message: `Approving delegation for ${delegateAid}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }

        if (intent === 'delete') {
            const contactId = formString(formData, 'contactId').trim();
            if (contactId.length === 0) {
                return {
                    intent,
                    ok: false,
                    message: 'Contact id is required.',
                    requestId,
                };
            }

            const started = runtime.startDeleteContact(contactId, {
                requestId: requestId || undefined,
            });
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
                message: `Deleting contact ${contactId}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }

        if (intent === 'updateAlias') {
            const contactId = formString(formData, 'contactId').trim();
            const alias = formString(formData, 'alias').trim();
            if (contactId.length === 0 || alias.length === 0) {
                return {
                    intent,
                    ok: false,
                    message: 'Contact id and alias are required.',
                    requestId,
                };
            }

            const started = runtime.startUpdateContactAlias(
                { contactId, alias },
                { requestId: requestId || undefined }
            );
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
                message: `Updating contact ${contactId}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }
    } catch (error) {
        return {
            intent: contactIntentFromString(intent),
            ok: false,
            message: toRouteError(error).message,
            requestId,
        };
    }

    return {
        intent: 'unsupported',
        ok: false,
        message: `Unsupported contact action: ${intent || 'missing intent'}`,
        requestId,
    };
};

/**
 * Notification actions share the contact challenge response path.
 */
export const notificationsAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<ContactActionData> => contactsAction(runtime, request);

/**
 * Route action for credential workflow commands.
 */
export const credentialsAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<CredentialActionData> => {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');
    const requestId = formString(formData, 'requestId');

    if (runtime.getClient() === null) {
        return {
            intent: credentialIntentFromString(intent),
            ok: false,
            message: 'Connect to KERIA before changing credentials.',
            requestId,
        };
    }

    try {
        if (intent === 'refreshCredentials') {
            await runtime.listIdentifiers({ signal: request.signal });
            await Promise.all([
                runtime.syncSessionInventory({ signal: request.signal }),
                runtime.syncKnownCredentialSchemas({ signal: request.signal }),
                runtime.syncCredentialRegistries({ signal: request.signal }),
                runtime.syncCredentialInventory({ signal: request.signal }),
            ]);
            await runtime.syncCredentialIpexActivity({
                signal: request.signal,
            });
            return {
                intent,
                ok: true,
                message: 'Credential inventory refreshed.',
                requestId,
                operationRoute: '/credentials',
            };
        }

        if (intent === 'resolveSchema') {
            const schemaSaid =
                formString(formData, 'schemaSaid').trim() ||
                appConfig.schemas.sediVoterId.said ||
                '';
            const schemaOobiUrl =
                formString(formData, 'schemaOobiUrl').trim() ||
                appConfig.schemas.sediVoterId.oobiUrl ||
                '';
            if (schemaSaid.length === 0 || schemaOobiUrl.length === 0) {
                return {
                    intent,
                    ok: false,
                    message: 'Schema SAID and OOBI URL are required.',
                    requestId,
                };
            }

            const started = runtime.startResolveCredentialSchema(
                { schemaSaid, schemaOobiUrl },
                { requestId: requestId || undefined }
            );
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
                message: 'Adding SEDI credential type',
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }

        if (intent === 'createRegistry') {
            const issuerAlias = formString(formData, 'issuerAlias').trim();
            const issuerAid = formString(formData, 'issuerAid').trim();
            const registryName =
                formString(formData, 'registryName').trim() ||
                'sedi-voter-registry';
            if (issuerAlias.length === 0 || issuerAid.length === 0) {
                return {
                    intent,
                    ok: false,
                    message: 'Issuer identifier and AID are required.',
                    requestId,
                };
            }

            const started = runtime.startCreateCredentialRegistry(
                { issuerAlias, issuerAid, registryName },
                { requestId: requestId || undefined }
            );
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
                message: `Preparing registry for ${issuerAlias}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }

        if (intent === 'issueCredential') {
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
                    message:
                        'Issuer, holder, registry, and schema are required.',
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
            const started = runtime.startIssueCredential(input, {
                requestId: requestId || undefined,
            });
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
                message: `Issuing credential to ${holderAid}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }

        if (intent === 'grantCredential') {
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
                    message:
                        'Issuer, holder, and credential SAID are required.',
                    requestId,
                };
            }

            const started = runtime.startGrantCredential(input, {
                requestId: requestId || undefined,
            });
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
                message: `Granting credential ${input.credentialSaid}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }

        if (intent === 'admitCredentialGrant') {
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

            const started = runtime.startAdmitCredentialGrant(input, {
                requestId: requestId || undefined,
            });
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
                message: `Admitting credential grant ${input.grantSaid}`,
                requestId: started.requestId,
                operationRoute: started.operationRoute,
            };
        }
    } catch (error) {
        return {
            intent: credentialIntentFromString(intent),
            ok: false,
            message: toRouteError(error).message,
            requestId,
        };
    }

    return {
        intent: 'unsupported',
        ok: false,
        message: `Unsupported credential action: ${intent || 'missing intent'}`,
        requestId,
    };
};
