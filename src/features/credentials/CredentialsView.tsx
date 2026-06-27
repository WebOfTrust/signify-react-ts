import { useEffect } from 'react';
import {
    Box,
    Button,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    Link as RouterLink,
    Outlet,
    useFetcher,
    useLoaderData,
    useNavigate,
    useParams,
} from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import { ConsolePanel, EmptyState, PageHeader, StatusPill } from '../../app/Console';
import { useAppRuntime } from '../../app/runtimeHooks';
import type { CredentialActionData, CredentialsLoaderData } from '../../app/routeData';
import { submitCredentialAction } from '../../app/credentialActionSubmit';
import type { IssueableCredentialTypeView } from '../../domain/credentials/credentialCatalog';
import { useAppDispatch, useAppSelector } from '../../state/hooks';
import {
    selectIdentifiers,
    selectSelectedWalletAid,
} from '../../state/selectors';
import {
    walletAidCleared,
    walletAidSelected,
} from '../../state/walletSelection.slice';
import { credentialPath } from './credentialDisplay';
import { AidSelector } from './CredentialShared';
import type { CredentialsRouteContextValue } from './CredentialsRouteContext';

/**
 * Credentials route layout.
 *
 * This parent owns loader/fetcher state, selected-AID shell controls, and the
 * single credential action boundary. Child routes own issuer, wallet, type,
 * registry, SEDI issue, grant, and admit concerns.
 */
export const CredentialsView = () => {
    const loaderData = useLoaderData() as CredentialsLoaderData;
    const fetcher = useFetcher<CredentialActionData>();
    const runtime = useAppRuntime();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const { aid: aidParam } = useParams<{ aid?: string }>();
    const identifiers = useAppSelector(selectIdentifiers);
    const walletSelectedAid = useAppSelector(selectSelectedWalletAid);
    const actionRunning = fetcher.state !== 'idle';
    const selectedAid = aidParam ?? walletSelectedAid ?? '';
    const selectedIdentifier =
        identifiers.find((identifier) => identifier.prefix === selectedAid) ??
        null;
    const w3cVerifiers =
        loaderData.status === 'blocked' ? [] : loaderData.verifiers;

    useEffect(() => {
        if (aidParam === undefined && walletSelectedAid !== null) {
            navigate(credentialPath(walletSelectedAid), { replace: true });
        }
    }, [aidParam, navigate, walletSelectedAid]);

    useEffect(() => {
        if (
            aidParam !== undefined &&
            selectedIdentifier !== null &&
            walletSelectedAid !== selectedIdentifier.prefix
        ) {
            dispatch(walletAidSelected({ aid: selectedIdentifier.prefix }));
        }
    }, [aidParam, dispatch, selectedIdentifier, walletSelectedAid]);

    useEffect(() => {
        if (selectedIdentifier === null) {
            return undefined;
        }

        const controller = new AbortController();
        void runtime.didwebs
            .refreshIdentifierDid(selectedIdentifier.name, selectedIdentifier.prefix, {
                signal: controller.signal,
                track: false,
            })
            .catch(() => undefined);

        return () => controller.abort();
    }, [runtime, selectedIdentifier]);

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const actionStatus =
        fetcher.data === undefined
            ? loaderData.status === 'error'
                ? { ok: false, message: loaderData.message }
                : null
            : fetcher.data;

    const navigateToAid = (aid: string) => {
        if (aid.length === 0) {
            dispatch(walletAidCleared());
        } else {
            dispatch(walletAidSelected({ aid }));
        }
        navigate(aid.length === 0 ? credentialPath() : credentialPath(aid));
    };

    const submitCredentialForm = (formData: FormData) => {
        submitCredentialAction(fetcher, formData);
    };

    const submitRefresh = () => {
        const formData = new FormData();
        formData.set('intent', 'refreshCredentials');
        submitCredentialForm(formData);
    };

    const submitResolveSchema = (credentialType: IssueableCredentialTypeView) => {
        const formData = new FormData();
        formData.set('intent', 'resolveSchema');
        formData.set('schemaSaid', credentialType.schemaSaid);
        formData.set('schemaOobiUrl', credentialType.schemaOobiUrl);
        submitCredentialForm(formData);
    };

    const outletContext: CredentialsRouteContextValue = {
        actionRunning,
        actionStatus,
        selectedAid,
        selectedIdentifier,
        identifiers,
        w3cVerifiers,
        navigateToAid,
        submitRefresh,
        submitResolveSchema,
        submitCredentialForm,
    };

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }} data-testid="credentials-view">
            <PageHeader
                eyebrow="Credentials"
                title="Credentials"
                summary="Select one local AID to view issuer or wallet activity."
                actions={
                    <Tooltip title="Refresh credential inbox, registries, and wallet inventory">
                        <span>
                            <Button
                                variant="outlined"
                                startIcon={<RefreshIcon />}
                                disabled={actionRunning}
                                onClick={submitRefresh}
                            >
                                Refresh
                            </Button>
                        </span>
                    </Tooltip>
                }
            />

            {actionStatus !== null && (
                <ConsolePanel
                    title={actionStatus.ok ? 'Command accepted' : 'Command blocked'}
                    actions={
                        <StatusPill
                            label={actionStatus.ok ? 'Accepted' : 'Error'}
                            tone={actionStatus.ok ? 'success' : 'error'}
                        />
                    }
                >
                    <Typography color="text.secondary">
                        {actionStatus.message}
                    </Typography>
                </ConsolePanel>
            )}

            <ConsolePanel title="AID">
                <Stack spacing={2}>
                    <AidSelector
                        selectedAid={selectedAid}
                        identifiers={identifiers}
                        onSelect={navigateToAid}
                    />
                    {identifiers.length === 0 && (
                        <EmptyState
                            title="No local AIDs"
                            message="Create an identifier before using credentials."
                            action={
                                <Button
                                    component={RouterLink}
                                    to="/identifiers"
                                    variant="contained"
                                >
                                    Identifiers
                                </Button>
                            }
                        />
                    )}
                    {selectedAid.length > 0 && selectedIdentifier === null && (
                        <EmptyState
                            title="AID not found"
                            message="Choose a local identifier from the AID selector."
                        />
                    )}
                </Stack>
            </ConsolePanel>

            {selectedIdentifier !== null && aidParam !== undefined && (
                <Outlet context={outletContext} />
            )}
        </Box>
    );
};
