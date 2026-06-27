import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink } from 'react-router-dom';
import { useAppSelector } from '../../state/hooks';
import {
    selectCredentialGrantNotifications,
    selectDidWebsDidsByAid,
    selectHeldCredentials,
    selectIssueableCredentialTypeViews,
    selectCredentialSchemas,
} from '../../state/selectors';
import { useAppRuntime } from '../../app/runtimeHooks';
import {
    grantsForAid,
    heldCredentialsForAid,
    walletStatsForAid,
} from './credentialViewModels';
import type { CredentialSummaryRecord } from '../../domain/credentials/credentialTypes';
import { credentialPath } from './credentialDisplay';
import { useCredentialsRouteContext } from './CredentialsRouteContext';
import {
    HeldCredentialsPanel,
    InboundGrantsPanel,
    WalletCredentialTypesPanel,
    WalletStatsPanel,
} from './CredentialWalletPanels';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import { selectW3CPresenter } from '../../domain/credentials/credentialPresentation';

/**
 * Wallet route for one selected local AID.
 *
 * This route owns holder-side schema readiness, inbound grant admission, and
 * held credential W3C Present actions.
 */
export const CredentialWalletRoute = () => {
    const runtime = useAppRuntime();
    const {
        actionRunning,
        actionStatus,
        selectedIdentifier,
        identifiers,
        submitResolveSchema,
        submitCredentialForm,
        w3cVerifiers,
    } = useCredentialsRouteContext();
    const credentialTypes = useAppSelector(selectIssueableCredentialTypeViews);
    const schemas = useAppSelector(selectCredentialSchemas);
    const heldCredentials = useAppSelector(selectHeldCredentials);
    const grantNotifications = useAppSelector(selectCredentialGrantNotifications);
    const didWebsByAid = useAppSelector(selectDidWebsDidsByAid);
    const [selectedVerifierId, setSelectedVerifierId] = useState('');

    const credentialTypesBySchema = new Map(
        credentialTypes.map((credentialType) => [
            credentialType.schemaSaid,
            credentialType,
        ])
    );
    const schemasBySaid = new Map(
        schemas.map((schema) => [schema.said, schema])
    );
    const selectedAid = selectedIdentifier?.prefix ?? '';
    const selectedAidHeldCredentials = useMemo(
        () => heldCredentialsForAid(heldCredentials, selectedAid),
        [heldCredentials, selectedAid]
    );
    const didWebsReadyByAid = useMemo(
        () =>
            new Map(
                Object.entries(didWebsByAid).map(([aid, did]) => [
                    aid,
                    did.loadState === 'ready' && did.did !== null,
                ])
            ),
        [didWebsByAid]
    );
    const presentationPresenters = useMemo(
        () =>
            Array.from(
                new Map(
                    selectedAidHeldCredentials
                        .map((credential) =>
                            selectW3CPresenter(
                                credential,
                                identifiers
                            )
                        )
                        .filter(
                            (
                                presenter
                            ): presenter is IdentifierSummary =>
                                presenter !== null
                        )
                        .map((presenter) => [presenter.prefix, presenter])
                ).values()
            ),
        [identifiers, selectedAidHeldCredentials]
    );
    const presentationPresenterRefreshKey = JSON.stringify(
        presentationPresenters
            .map(({ name, prefix }) => ({ name, prefix }))
            .sort((left, right) => left.prefix.localeCompare(right.prefix))
    );
    const selectedAidGrants = grantsForAid(
        grantNotifications,
        selectedAid
    );
    const walletStats = walletStatsForAid({
        aid: selectedAid,
        heldCredentials,
        grants: grantNotifications,
    });
    const effectiveVerifierId = selectedVerifierId;
    const unresolvedWalletCredentialType =
        credentialTypes.find((type) => type.schemaStatus !== 'resolved') ?? null;

    useEffect(() => {
        const presenters = JSON.parse(presentationPresenterRefreshKey) as Array<
            Pick<IdentifierSummary, 'name' | 'prefix'>
        >;

        if (presenters.length === 0) {
            return undefined;
        }

        const controller = new AbortController();
        for (const presenter of presenters) {
            void runtime.didwebs
                .refreshIdentifierDid(presenter.name, presenter.prefix, {
                    signal: controller.signal,
                    track: false,
                })
                .catch(() => undefined);
        }

        return () => controller.abort();
    }, [runtime, presentationPresenterRefreshKey]);

    if (selectedIdentifier === null) {
        return null;
    }

    const submitAdmit = (notificationId: string, grantSaid: string) => {
        const formData = new FormData();
        formData.set('intent', 'admitCredentialGrant');
        formData.set('holderAlias', selectedIdentifier.name);
        formData.set('holderAid', selectedIdentifier.prefix);
        formData.set('notificationId', notificationId);
        formData.set('grantSaid', grantSaid);
        submitCredentialForm(formData);
    };

    const submitPresent = (
        credential: CredentialSummaryRecord,
        presenter: IdentifierSummary,
        verifierRequestJson: string
    ) => {
        if (verifierRequestJson.length === 0) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'presentCredential');
        formData.set('presenterAlias', presenter.name);
        formData.set('presenterAid', presenter.prefix);
        formData.set('credentialSaid', credential.said);
        formData.set('verifierRequest', verifierRequestJson);
        submitCredentialForm(formData);
    };

    return (
        <Stack spacing={2}>
            <Box>
                <Button
                    component={RouterLink}
                    to={credentialPath(selectedIdentifier.prefix)}
                    startIcon={<ArrowBackIcon />}
                    variant="outlined"
                >
                    Back
                </Button>
            </Box>
            <HeldCredentialsPanel
                credentials={selectedAidHeldCredentials}
                credentialTypesBySchema={credentialTypesBySchema}
                schemasBySaid={schemasBySaid}
                identifiers={identifiers}
                didWebsReadyByAid={didWebsReadyByAid}
                verifiers={w3cVerifiers}
                selectedVerifierId={effectiveVerifierId}
                presentationAction={
                    actionStatus !== null &&
                    'intent' in actionStatus &&
                    actionStatus.intent === 'presentCredential'
                        ? actionStatus
                        : null
                }
                actionRunning={actionRunning}
                onVerifierChange={setSelectedVerifierId}
                onPresent={submitPresent}
            />
            <WalletCredentialTypesPanel
                selectedIdentifierName={selectedIdentifier.name}
                credentialTypes={credentialTypes}
                unresolvedWalletCredentialType={unresolvedWalletCredentialType}
                actionRunning={actionRunning}
                onResolveSchema={submitResolveSchema}
            />
            <WalletStatsPanel
                selectedIdentifierName={selectedIdentifier.name}
                walletStats={walletStats}
            />
            <InboundGrantsPanel
                grants={selectedAidGrants}
                actionRunning={actionRunning}
                credentialTypesBySchema={credentialTypesBySchema}
                schemasBySaid={schemasBySaid}
                onAdmit={submitAdmit}
            />
        </Stack>
    );
};
