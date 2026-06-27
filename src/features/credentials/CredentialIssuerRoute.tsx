import {
    Box,
    Button,
    Grid,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { ConsolePanel, EmptyState, StatusPill, TelemetryRow } from '../../app/Console';
import { monoValueSx } from '../../app/consoleStyles';
import { abbreviateMiddle } from '../../domain/contacts/contactHelpers';
import { useAppSelector } from '../../state/hooks';
import {
    selectCredentialRegistries,
    selectCredentialSchemas,
    selectDidWebsDidsByAid,
    selectIssueableCredentialTypeViews,
    selectIssuedCredentials,
} from '../../state/selectors';
import {
    issuedCredentialsForAid,
    issuedCredentialsForAidAndSchema,
    issuerStatsForAid,
} from './credentialViewModels';
import {
    credentialPath,
    issuerTypePath,
    registryLabel,
    schemaLabel,
    statusTone,
    timestampText,
} from './credentialDisplay';
import { useCredentialsRouteContext } from './CredentialsRouteContext';
import { CredentialW3CIssuanceControls } from './CredentialW3CIssuanceControls';
import type { CredentialSummaryRecord } from '../../domain/credentials/credentialTypes';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';

/**
 * Issuer route for one selected local AID.
 *
 * This route owns issuer statistics, issueable credential type navigation,
 * and the all-issued credential list. Type-specific issue/grant state stays in
 * `CredentialIssuerTypeRoute`.
 */
export const CredentialIssuerRoute = () => {
    const {
        actionStatus,
        actionRunning,
        identifiers,
        selectedIdentifier,
        submitResolveSchema,
        submitCredentialForm,
    } = useCredentialsRouteContext();
    const navigate = useNavigate();
    const credentialTypes = useAppSelector(selectIssueableCredentialTypeViews);
    const schemas = useAppSelector(selectCredentialSchemas);
    const issuedCredentials = useAppSelector(selectIssuedCredentials);
    const registries = useAppSelector(selectCredentialRegistries);
    const didWebsByAid = useAppSelector(selectDidWebsDidsByAid);

    if (selectedIdentifier === null) {
        return null;
    }

    const issueableCredentialTypes = credentialTypes.filter(
        (type) => type.schemaStatus === 'resolved'
    );
    const addableCredentialTypes = credentialTypes.filter(
        (type) => type.schemaStatus !== 'resolved'
    );
    const credentialTypesBySchema = new Map(
        credentialTypes.map((credentialType) => [
            credentialType.schemaSaid,
            credentialType,
        ])
    );
    const schemasBySaid = new Map(
        schemas.map((schema) => [schema.said, schema])
    );
    const issuerStats = issuerStatsForAid({
        aid: selectedIdentifier.prefix,
        credentialTypes,
        issuedCredentials,
    });
    const selectedAidIssuedCredentials = issuedCredentialsForAid(
        issuedCredentials,
        selectedIdentifier.prefix
    );
    const didWebsReadyByAid = new Map(
        Object.entries(didWebsByAid).map(([aid, did]) => [
            aid,
            did.loadState === 'ready' && did.did !== null,
        ])
    );
    const issuanceAction =
        actionStatus !== null &&
        'intent' in actionStatus &&
        actionStatus.intent === 'startW3CIssuance'
            ? actionStatus
            : null;
    const submitStartW3CIssuance = (
        credential: CredentialSummaryRecord,
        issuer: IdentifierSummary
    ) => {
        const formData = new FormData();
        formData.set('intent', 'startW3CIssuance');
        formData.set('issuerAlias', issuer.name);
        formData.set('issuerAid', issuer.prefix);
        formData.set('credentialSaid', credential.said);
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
            <ConsolePanel
                title="Issuer"
                eyebrow={selectedIdentifier.name}
                actions={
                    <StatusPill
                        label={`${issuerStats.granted} granted`}
                        tone={issuerStats.granted > 0 ? 'success' : 'neutral'}
                    />
                }
            >
                <Grid container spacing={1.5}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TelemetryRow
                            label="Issuable types"
                            value={String(issuerStats.issueableTypes)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TelemetryRow
                            label="Issued"
                            value={String(issuerStats.issued)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TelemetryRow
                            label="Granted"
                            value={String(issuerStats.granted)}
                        />
                    </Grid>
                </Grid>
            </ConsolePanel>
            <ConsolePanel
                title="Issueable credential types"
                actions={
                    addableCredentialTypes[0] === undefined ? null : (
                        <Button
                            variant="outlined"
                            startIcon={<AssignmentTurnedInIcon />}
                            disabled={actionRunning}
                            onClick={() =>
                                submitResolveSchema(addableCredentialTypes[0])
                            }
                        >
                            Add schema type
                        </Button>
                    )
                }
            >
                {issueableCredentialTypes.length === 0 ? (
                    <EmptyState
                        title="No credential types added"
                        message="Add a supported schema type to this agent before issuing credentials."
                    />
                ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 560 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Type</TableCell>
                                    <TableCell align="right">Issued</TableCell>
                                    <TableCell align="right">Granted</TableCell>
                                    <TableCell>Last issued</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {issueableCredentialTypes.map(
                                    (credentialType) => {
                                        const issuedForType =
                                            issuedCredentialsForAidAndSchema(
                                                issuedCredentials,
                                                selectedIdentifier.prefix,
                                                credentialType.schemaSaid
                                            );
                                        return (
                                            <TableRow
                                                key={credentialType.key}
                                                hover
                                                role="button"
                                                tabIndex={0}
                                                sx={{ cursor: 'pointer' }}
                                                onClick={() =>
                                                    navigate(
                                                        issuerTypePath(
                                                            selectedIdentifier.prefix,
                                                            credentialType.key
                                                        )
                                                    )
                                                }
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key === 'Enter' ||
                                                        event.key === ' '
                                                    ) {
                                                        event.preventDefault();
                                                        navigate(
                                                            issuerTypePath(
                                                                selectedIdentifier.prefix,
                                                                credentialType.key
                                                            )
                                                        );
                                                    }
                                                }}
                                            >
                                                <TableCell>
                                                    <Typography
                                                        sx={{ fontWeight: 800 }}
                                                    >
                                                        {credentialType.label}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell align="right">
                                                    {issuedForType.length}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {
                                                        issuedForType.filter(
                                                            (credential) =>
                                                                credential.grantSaid !==
                                                                null
                                                        ).length
                                                    }
                                                </TableCell>
                                                <TableCell>
                                                    {timestampText(
                                                        issuedForType
                                                            .map(
                                                                (credential) =>
                                                                    credential.issuedAt
                                                            )
                                                            .filter(
                                                                (
                                                                    value
                                                                ): value is string =>
                                                                    value !==
                                                                    null
                                                            )
                                                            .sort((left, right) =>
                                                                right.localeCompare(
                                                                    left
                                                                )
                                                            )[0] ?? null
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    }
                                )}
                            </TableBody>
                        </Table>
                    </Box>
                )}
            </ConsolePanel>
            <ConsolePanel
                title="Issued credentials"
                actions={
                    <StatusPill
                        label={`${selectedAidIssuedCredentials.length} total`}
                        tone={
                            selectedAidIssuedCredentials.length > 0
                                ? 'success'
                                : 'neutral'
                        }
                    />
                }
            >
                {selectedAidIssuedCredentials.length === 0 ? (
                    <EmptyState
                        title="No issued credentials"
                        message="Credentials issued by this AID across all registries will appear here."
                    />
                ) : (
                    <Box sx={{ overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 1040 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Registry</TableCell>
                                    <TableCell>Holder</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Issued</TableCell>
                                    <TableCell>Credential</TableCell>
                                    <TableCell>W3C Issue</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {selectedAidIssuedCredentials.map(
                                    (credential) => (
                                        <TableRow key={credential.said}>
                                            <TableCell>
                                                {schemaLabel(
                                                    credential.schemaSaid,
                                                    credentialTypesBySchema,
                                                    schemasBySaid
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {registryLabel(
                                                    credential.registryId,
                                                    registries
                                                )}
                                            </TableCell>
                                            <TableCell sx={monoValueSx}>
                                                {abbreviateMiddle(
                                                    credential.holderAid ??
                                                        'Not available',
                                                    24
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <StatusPill
                                                    label={credential.status}
                                                    tone={statusTone(
                                                        credential.status
                                                    )}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {timestampText(
                                                    credential.issuedAt
                                                )}
                                            </TableCell>
                                            <TableCell sx={monoValueSx}>
                                                {abbreviateMiddle(
                                                    credential.said,
                                                    24
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <CredentialW3CIssuanceControls
                                                    credential={credential}
                                                    identifiers={identifiers}
                                                    didWebsReadyByAid={
                                                        didWebsReadyByAid
                                                    }
                                                    actionRunning={
                                                        actionRunning
                                                    }
                                                    issuanceAction={
                                                        issuanceAction
                                                    }
                                                    onStartIssuance={
                                                        submitStartW3CIssuance
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    )
                                )}
                            </TableBody>
                        </Table>
                    </Box>
                )}
            </ConsolePanel>
        </Stack>
    );
};
