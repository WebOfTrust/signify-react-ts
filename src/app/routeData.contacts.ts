import type { OobiRole } from '../services/contacts.service';
import {
    parseChallengeWords,
    validateChallengeWords,
} from '../domain/challenges/challengeWords';
import type {
    ContactActionData,
    ContactsLoaderData,
    NotificationsLoaderData,
    RouteDataRuntime,
} from './routeData.types';
import { formString, toRouteError } from './routeData.shared';

/**
 * Contact route action boundary.
 *
 * This module parses contact, OOBI, challenge, delegation, and notification
 * form intents before handing cancellable work to `AppRuntime`.
 */

type ContactIntent = Exclude<ContactActionData['intent'], 'unsupported'>;

/** Shared context passed to contact intent handlers. */
interface ContactActionContext {
    runtime: RouteDataRuntime;
    request: Request;
    formData: FormData;
    intent: string;
    requestId: string;
}

/** Parse the limited OOBI roles this route can request for local identifiers. */
const parseOobiRole = (value: string): OobiRole | null =>
    value === 'agent' || value === 'witness' ? value : null;

/** Normalize submitted contact intent strings to the supported action set. */
const contactIntentFromString = (value: string): ContactIntent =>
    value === 'generateOobi' ||
    value === 'generateChallenge' ||
    value === 'respondChallenge' ||
    value === 'verifyChallenge' ||
    value === 'dismissExchangeNotification' ||
    value === 'markNotificationRead' ||
    value === 'approveDelegationRequest' ||
    value === 'delete' ||
    value === 'updateAlias'
        ? value
        : 'resolve';

const requestIdOption = (requestId: string): { requestId?: string } =>
    requestId.length > 0 ? { requestId } : {};

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
            runtime.identifiers.list({ signal: request?.signal }),
            runtime.contacts.syncInventory({ signal: request?.signal }),
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
            runtime.identifiers.list({ signal: request?.signal }),
            runtime.contacts.syncInventory({ signal: request?.signal }),
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

/** Convert runtime launch results into typed contact route action data. */
const contactStartedResult = (
    intent: Exclude<ContactIntent, 'generateChallenge'>,
    started: ReturnType<RouteDataRuntime['contacts']['startResolve']>,
    message: string
): ContactActionData => {
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
 * Accepts a contact OOBI URL from the route form and starts the scoped
 * resolution workflow. This keeps OOBI validation and the runtime command at
 * the route boundary, so components do not learn KERIA contact APIs.
 */
const resolveContactAction = ({
    runtime,
    formData,
    requestId,
}: ContactActionContext): ContactActionData => {
    const intent = 'resolve';
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

    return contactStartedResult(
        intent,
        runtime.contacts.startResolve(
            {
                oobi,
                alias: alias.length > 0 ? alias : null,
            },
            requestIdOption(requestId)
        ),
        'Resolving contact OOBI'
    );
};

/**
 * Starts OOBI generation for an existing local identifier and explicit role.
 * Role parsing stays here because it is route input hygiene, while the runtime
 * owns the actual Signify/KERIA operation.
 */
const generateOobiAction = ({
    runtime,
    formData,
    requestId,
}: ContactActionContext): ContactActionData => {
    const intent = 'generateOobi';
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

    return contactStartedResult(
        intent,
        runtime.contacts.startGenerateOobi(
            { identifier, role },
            requestIdOption(requestId)
        ),
        `Generating ${role} OOBI for ${identifier}`
    );
};

/**
 * Creates challenge words, sends the non-secret request metadata, and starts
 * verification as one user intent. This is intentionally coordinated at the
 * route action boundary because the generated words must remain local while
 * the background workflows receive only the pieces they own.
 */
const generateChallengeAction = async ({
    runtime,
    request,
    formData,
    requestId,
}: ContactActionContext): Promise<ContactActionData> => {
    const intent = 'generateChallenge';
    const contactId = formString(formData, 'contactId').trim();
    const contactAlias = formString(formData, 'contactAlias').trim();
    const localIdentifier = formString(formData, 'localIdentifier').trim();
    const localAid = formString(formData, 'localAid').trim();
    if (contactId.length === 0 || localIdentifier.length === 0) {
        return {
            intent,
            ok: false,
            message: 'Contact id and local identifier are required.',
            requestId,
        };
    }

    const generated = await runtime.challenges.generate(
        {
            counterpartyAid: contactId,
            counterpartyAlias: contactAlias.length > 0 ? contactAlias : null,
            localIdentifier,
            localAid: localAid.length > 0 ? localAid : null,
        },
        { signal: request.signal }
    );
    runtime.challenges.startSendRequest(
        {
            challengeId: generated.challengeId,
            counterpartyAid: generated.counterpartyAid,
            counterpartyAlias: generated.counterpartyAlias,
            localIdentifier: generated.localIdentifier,
            localAid: generated.localAid,
            wordsHash: generated.wordsHash,
            strength: generated.strength,
        },
        requestId.length > 0
            ? { requestId: `${requestId}:challenge-request` }
            : {}
    );
    const started = runtime.challenges.startVerify(
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
        requestIdOption(requestId)
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
        message: 'Generated challenge, sent request, and started verification',
        requestId: started.requestId,
        operationRoute: started.operationRoute,
        challenge: generated,
    };
};

/**
 * Responds to a received challenge request by validating locally supplied
 * words and launching the challenge-response workflow. The handler maps
 * notification form fields into one command so notification UI state never
 * becomes protocol truth.
 */
const respondChallengeAction = ({
    runtime,
    formData,
    requestId,
}: ContactActionContext): ContactActionData => {
    const intent = 'respondChallenge';
    const notificationId = formString(formData, 'notificationId').trim();
    const challengeId = formString(formData, 'challengeId').trim();
    const wordsHash = formString(formData, 'wordsHash').trim();
    const contactId = formString(formData, 'contactId').trim();
    const contactAlias = formString(formData, 'contactAlias').trim();
    const localIdentifier = formString(formData, 'localIdentifier').trim();
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

    return contactStartedResult(
        intent,
        runtime.challenges.startRespond(
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
            requestIdOption(requestId)
        ),
        `Sending challenge response to ${contactId}`
    );
};

/**
 * Starts verifier-side challenge polling for words generated by this party.
 * The route action requires the challenge id and local identifier up front so
 * the background workflow has a stable, resumable resource key.
 */
const verifyChallengeAction = ({
    runtime,
    formData,
    requestId,
}: ContactActionContext): ContactActionData => {
    const intent = 'verifyChallenge';
    const challengeId = formString(formData, 'challengeId').trim();
    const contactId = formString(formData, 'contactId').trim();
    const contactAlias = formString(formData, 'contactAlias').trim();
    const localIdentifier = formString(formData, 'localIdentifier').trim();
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

    return contactStartedResult(
        intent,
        runtime.challenges.startVerify(
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
            requestIdOption(requestId)
        ),
        `Waiting for challenge response from ${contactId}`
    );
};

/**
 * Dismisses an exchange notification after the user has explicitly handled or
 * rejected it. This is an immediate runtime call, not a background workflow,
 * because dismissal is a bounded note mutation tied to this request signal.
 */
const dismissExchangeNotificationAction = async ({
    runtime,
    request,
    formData,
    requestId,
}: ContactActionContext): Promise<ContactActionData> => {
    const intent = 'dismissExchangeNotification';
    const notificationId = formString(formData, 'notificationId').trim();
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
            message: 'Notification id, EXN SAID, and route are required.',
            requestId,
        };
    }

    await runtime.notifications.dismissExchange(
        { notificationId, exnSaid, route },
        { ...requestIdOption(requestId), signal: request.signal }
    );

    return {
        intent,
        ok: true,
        message: 'Exchange notification dismissed.',
        requestId,
        operationRoute: '/notifications',
    };
};

const markNotificationReadAction = async ({
    runtime,
    request,
    formData,
    requestId,
}: ContactActionContext): Promise<ContactActionData> => {
    const intent = 'markNotificationRead';
    const notificationId = formString(formData, 'notificationId').trim();
    if (notificationId.length === 0) {
        return {
            intent,
            ok: false,
            message: 'Notification id is required.',
            requestId,
        };
    }

    await runtime.notifications.markRead(
        { notificationId },
        { ...requestIdOption(requestId), signal: request.signal }
    );

    return {
        intent,
        ok: true,
        message: 'Notification marked read.',
        requestId,
        operationRoute: '/notifications',
    };
};

/**
 * Converts an actionable delegation notification into the approve-delegation
 * workflow input. The handler rebuilds the anchor from submitted fields so the
 * workflow receives a domain-shaped request instead of raw form data.
 */
const approveDelegationRequestAction = ({
    runtime,
    formData,
    requestId,
}: ContactActionContext): ContactActionData => {
    const intent = 'approveDelegationRequest';
    const notificationId = formString(formData, 'notificationId').trim();
    const delegatorName = formString(formData, 'delegatorName').trim();
    const delegatorAid = formString(formData, 'delegatorAid').trim();
    const delegateAid = formString(formData, 'delegateAid').trim();
    const delegateEventSaid = formString(formData, 'delegateEventSaid').trim();
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

    return contactStartedResult(
        intent,
        runtime.delegations.startApprove(
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
            requestIdOption(requestId)
        ),
        `Approving delegation for ${delegateAid}`
    );
};

/**
 * Starts the contact deletion workflow for a single contact AID. Keeping this
 * as its own intent handler makes delete semantics obvious and prevents alias
 * or OOBI concerns from leaking into the destructive path.
 */
const deleteContactAction = ({
    runtime,
    formData,
    requestId,
}: ContactActionContext): ContactActionData => {
    const intent = 'delete';
    const contactId = formString(formData, 'contactId').trim();
    if (contactId.length === 0) {
        return {
            intent,
            ok: false,
            message: 'Contact id is required.',
            requestId,
        };
    }

    return contactStartedResult(
        intent,
        runtime.contacts.startDelete(contactId, requestIdOption(requestId)),
        `Deleting contact ${contactId}`
    );
};

/**
 * Starts the alias update workflow for an existing contact. The only route
 * responsibility is proving both the contact id and replacement alias are
 * present before passing a narrow command to the runtime.
 */
const updateContactAliasAction = ({
    runtime,
    formData,
    requestId,
}: ContactActionContext): ContactActionData => {
    const intent = 'updateAlias';
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

    return contactStartedResult(
        intent,
        runtime.contacts.startUpdateAlias(
            { contactId, alias },
            requestIdOption(requestId)
        ),
        `Updating contact ${contactId}`
    );
};

/**
 * Dispatches contact route intents to named handlers instead of a registry.
 * The explicit switch keeps the supported route commands searchable and makes
 * adding a new contact intent require a deliberate branch.
 */
const runContactIntentAction = (
    context: ContactActionContext
): ContactActionData | Promise<ContactActionData> => {
    switch (context.intent) {
        case 'resolve':
            return resolveContactAction(context);
        case 'generateOobi':
            return generateOobiAction(context);
        case 'generateChallenge':
            return generateChallengeAction(context);
        case 'respondChallenge':
            return respondChallengeAction(context);
        case 'verifyChallenge':
            return verifyChallengeAction(context);
        case 'dismissExchangeNotification':
            return dismissExchangeNotificationAction(context);
        case 'markNotificationRead':
            return markNotificationReadAction(context);
        case 'approveDelegationRequest':
            return approveDelegationRequestAction(context);
        case 'delete':
            return deleteContactAction(context);
        case 'updateAlias':
            return updateContactAliasAction(context);
        default:
            return {
                intent: 'unsupported',
                ok: false,
                message: `Unsupported contact action: ${
                    context.intent || 'missing intent'
                }`,
                requestId: context.requestId,
            };
    }
};

/**
 * Route action for contact/OOBI mutations.
 *
 * Recoverable KERIA/contact workflow failures stay in route action data
 * instead of leaking service exceptions into presentational components.
 */
export const contactsAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<ContactActionData> => {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');
    const requestId = formString(formData, 'requestId');
    const context: ContactActionContext = {
        runtime,
        request,
        formData,
        intent,
        requestId,
    };

    if (runtime.getClient() === null) {
        return {
            intent: contactIntentFromString(intent),
            ok: false,
            message: 'Connect to KERIA before changing contacts.',
            requestId,
        };
    }

    try {
        return await runContactIntentAction(context);
    } catch (error) {
        return {
            intent: contactIntentFromString(intent),
            ok: false,
            message: toRouteError(error).message,
            requestId,
        };
    }
};

/**
 * Notification actions share the contact challenge response path.
 */
export const notificationsAction = async (
    runtime: RouteDataRuntime,
    request: Request
): Promise<ContactActionData> => contactsAction(runtime, request);
