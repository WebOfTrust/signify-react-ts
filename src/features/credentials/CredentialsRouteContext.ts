import { useOutletContext } from 'react-router-dom';
import type { CredentialActionData } from '../../app/routeData';
import type { IssueableCredentialTypeView } from '../../domain/credentials/credentialCatalog';
import type { W3CVerifierRequestPreset } from '../../domain/credentials/w3cVerifierPresets';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';

export interface CredentialsRouteContextValue {
    actionRunning: boolean;
    actionStatus: CredentialActionData | { ok: boolean; message: string } | null;
    selectedAid: string;
    selectedIdentifier: IdentifierSummary | null;
    identifiers: readonly IdentifierSummary[];
    w3cVerifiers: readonly W3CVerifierRequestPreset[];
    navigateToAid: (aid: string) => void;
    submitRefresh: () => void;
    submitResolveSchema: (credentialType: IssueableCredentialTypeView) => void;
    submitCredentialForm: (formData: FormData) => void;
}

/**
 * Read the shared credentials route layout context.
 *
 * Child routes own their domain-specific selectors and local form state; the
 * layout context only carries shell state and route action submission helpers.
 */
export const useCredentialsRouteContext = (): CredentialsRouteContextValue =>
    useOutletContext<CredentialsRouteContextValue>();
