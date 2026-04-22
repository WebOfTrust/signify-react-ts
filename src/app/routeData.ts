import { redirect } from 'react-router-dom';
import { appConfig } from '../config';
import type {
    IdentifierCreateDraft,
    IdentifierSummary,
} from '../features/identifiers/identifierTypes';
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

/**
 * Loader data for the client summary route.
 */
export type ClientLoaderData =
    | { status: 'ready'; summary: SignifyStateSummary }
    | BlockedRouteData;

/**
 * Loader data for the credentials route.
 *
 * This intentionally stays tiny until the real credential workflow lands; the
 * useful contract today is the connected-route gate.
 */
export type CredentialsLoaderData = { status: 'ready' } | BlockedRouteData;

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
              | 'delete'
              | 'updateAlias'
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

const parseOobiRole = (value: string): OobiRole | null =>
    value === 'agent' || value === 'witness' ? value : null;

const contactIntentFromString = (
    value: string
): Exclude<ContactActionData['intent'], 'unsupported'> =>
    value === 'generateOobi' ||
    value === 'generateChallenge' ||
    value === 'respondChallenge' ||
    value === 'verifyChallenge' ||
    value === 'delete' ||
    value === 'updateAlias'
        ? value
        : 'resolve';

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
        await Promise.all([
            runtime.listIdentifiers({ signal: request?.signal }),
            runtime.syncSessionInventory({ signal: request?.signal }),
        ]);
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
export const loadCredentials = (
    runtime: RouteDataRuntime
): CredentialsLoaderData =>
    runtime.getClient() === null ? { status: 'blocked' } : { status: 'ready' };

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
