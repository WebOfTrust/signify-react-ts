import type { IdentifierSummary } from '../domain/identifiers/identifierTypes';
import type { MultisigGroupDetails } from '../domain/multisig/multisigGroupDetails';
import type { GeneratedContactChallengeResult } from '../workflows/challenges.op';
import type {
    SignifyClientConfig,
    SignifyStateSummary,
} from '../signify/client';
import type {
    ChallengeRuntimeCommands,
    ContactRuntimeCommands,
    CredentialRuntimeCommands,
    DelegationRuntimeCommands,
    DidWebsRuntimeCommands,
    IdentifierRuntimeCommands,
    MultisigRuntimeCommands,
    NotificationRuntimeCommands,
} from './runtimeCommands';
import type { W3CVerifierRequestPreset } from '../domain/credentials/w3cVerifierPresets';

/**
 * Canonical route used for startup redirects, unknown paths, and successful
 * KERIA connection submissions.
 */
export const DEFAULT_APP_PATH = '/dashboard';

export type { W3CVerifierRequestPreset };

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
    | { status: 'ready'; verifiers: W3CVerifierRequestPreset[] }
    | {
          status: 'error';
          message: string;
          verifiers: W3CVerifierRequestPreset[];
      }
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

export type { MultisigGroupDetails } from '../domain/multisig/multisigGroupDetails';

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
    | { status: 'ready'; verifiers: W3CVerifierRequestPreset[] }
    | {
          status: 'error';
          message: string;
          verifiers: W3CVerifierRequestPreset[];
      }
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
              | 'markNotificationRead'
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
              | 'markNotificationRead'
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
              | 'startW3CIssuance'
              | 'admitCredentialGrant'
              | 'presentCredential'
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
              | 'startW3CIssuance'
              | 'admitCredentialGrant'
              | 'presentCredential'
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
}

/** Route actions only need to know whether connection succeeded. */
type RouteConnectionResult = unknown;

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
    ): Promise<RouteConnectionResult | null>;
    /** Generate a Signify passcode after Signify WASM readiness completes. */
    generatePasscode(options?: { signal?: AbortSignal }): Promise<string>;
    /** Refresh the normalized Signify state through the connected client. */
    refreshState(options?: {
        signal?: AbortSignal;
    }): Promise<SignifyStateSummary | null>;
    /** Identifier route commands. */
    identifiers: IdentifierRuntimeCommands;
    /** Contact and OOBI route commands. */
    contacts: Omit<ContactRuntimeCommands, 'liveInventory'>;
    /** Challenge-response route commands. */
    challenges: ChallengeRuntimeCommands;
    /** Notification route commands. */
    notifications: NotificationRuntimeCommands;
    /** Delegation route commands. */
    delegations: DelegationRuntimeCommands;
    /** Credential, schema, registry, grant, and admit route commands. */
    credentials: CredentialRuntimeCommands;
    /** Multisig route commands. */
    multisig: MultisigRuntimeCommands;
    /** did:webs DID route commands. */
    didwebs: DidWebsRuntimeCommands;
}
