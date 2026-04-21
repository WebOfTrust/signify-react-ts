import { redirect } from 'react-router-dom';
import { Algos } from 'signify-ts';
import { appConfig } from '../config';
import type {
    DynamicIdentifierField,
    IdentifierSummary,
} from '../features/identifiers/identifierTypes';
import type {
    ConnectedSignifyClient,
    SignifyClientConfig,
    SignifyStateSummary,
} from '../signify/client';

/**
 * Canonical route used for startup redirects, unknown paths, and successful
 * KERIA connection submissions.
 */
export const DEFAULT_APP_PATH = '/identifiers';

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
export type CredentialsLoaderData =
    | { status: 'ready' }
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
    | { intent: 'create' | 'rotate'; ok: true; message: string }
    | { intent: 'create' | 'rotate' | 'unsupported'; ok: false; message: string };

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
    connect(config: SignifyClientConfig): Promise<ConnectedSignifyClient | null>;
    /** Generate a Signify passcode after Signify WASM readiness completes. */
    generatePasscode(): Promise<string>;
    /** Refresh the normalized Signify state through the connected client. */
    refreshState(): Promise<SignifyStateSummary | null>;
    /** Load and normalize identifiers through the connected client. */
    listIdentifiers(): Promise<IdentifierSummary[]>;
    /** Create an identifier and wait for its KERIA operation to complete. */
    createIdentifier(
        name: string,
        algo: Algos,
        fields: readonly DynamicIdentifierField[]
    ): Promise<IdentifierSummary[]>;
    /** Rotate an identifier and wait for its KERIA operation to complete. */
    rotateIdentifier(aid: string): Promise<IdentifierSummary[]>;
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

const parseIdentifierAlgo = (value: string): Algos =>
    Object.values(Algos).includes(value as Algos) ? (value as Algos) : Algos.salty;

/**
 * Parse the serialized dynamic create-dialog field rows submitted by
 * `IdentifiersView`.
 */
const parseDynamicFields = (value: string): DynamicIdentifierField[] => {
    if (value.trim().length === 0) {
        return [];
    }

    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
        return [];
    }

    return parsed.filter(
        (field): field is DynamicIdentifierField =>
            typeof field === 'object' &&
            field !== null &&
            'field' in field &&
            'value' in field &&
            typeof field.field === 'string' &&
            typeof field.value === 'string'
    );
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
    runtime: RouteDataRuntime
): Promise<IdentifiersLoaderData> => {
    const client = runtime.getClient();
    if (client === null) {
        return { status: 'blocked' };
    }

    try {
        return {
            status: 'ready',
            identifiers: await runtime.listIdentifiers(),
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
    runtime: RouteDataRuntime
): Promise<ClientLoaderData> => {
    if (runtime.getClient() === null) {
        return { status: 'blocked' };
    }

    const summary = (await runtime.refreshState()) ?? runtime.getState();
    return summary === null ? { status: 'blocked' } : { status: 'ready', summary };
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
                passcode: await runtime.generatePasscode(),
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
        const connected = await runtime.connect({
            adminUrl: formString(formData, 'adminUrl'),
            bootUrl: formString(formData, 'bootUrl'),
            passcode: formString(formData, 'passcode'),
            tier: appConfig.defaultTier,
        });

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
        const name = formString(formData, 'name');
        try {
            await runtime.createIdentifier(
                name,
                parseIdentifierAlgo(formString(formData, 'algo')),
                parseDynamicFields(formString(formData, 'fields'))
            );
            return {
                intent,
                ok: true,
                message: `Created identifier ${name}`,
            };
        } catch (error) {
            return {
                intent,
                ok: false,
                message: toRouteError(error).message,
            };
        }
    }

    if (intent === 'rotate') {
        const aid = formString(formData, 'aid');
        try {
            await runtime.rotateIdentifier(aid);
            return {
                intent,
                ok: true,
                message: `Rotated identifier ${aid}`,
            };
        } catch (error) {
            return {
                intent,
                ok: false,
                message: toRouteError(error).message,
            };
        }
    }

    return {
        intent: 'unsupported',
        ok: false,
        message: `Unsupported identifier action: ${intent || 'missing intent'}`,
    };
};
