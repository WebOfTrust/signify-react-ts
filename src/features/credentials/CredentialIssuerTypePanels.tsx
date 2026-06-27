import type { Dispatch, SetStateAction } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Collapse,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import InventoryIcon from '@mui/icons-material/Inventory';
import SendIcon from '@mui/icons-material/Send';
import {
    ConsolePanel,
    EmptyState,
    StatusPill,
    TelemetryRow,
} from '../../app/Console';
import { clickablePanelSx, monoValueSx } from '../../app/consoleStyles';
import { abbreviateMiddle } from '../../domain/contacts/contactHelpers';
import {
    SEDI_VOTER_ISSUE_TEXT_FIELDS,
    type SediVoterIssueFormDraft,
} from '../../domain/credentials/sediVoterId';
import type {
    CredentialSummaryRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';
import type { IssueableCredentialTypeView } from '../../domain/credentials/credentialCatalog';
import type { ContactRecord } from '../../state/contacts.slice';
import type { CredentialRegistryTile } from './credentialViewModels';
import { statusTone } from './credentialDisplay';
import { CredentialRecordRows } from './CredentialShared';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import { CredentialW3CIssuanceControls } from './CredentialW3CIssuanceControls';
import type { CredentialActionData } from '../../app/routeData';

/**
 * Registry selection and creation controls for issuer credential-type routes.
 */
export const CredentialRegistrySelector = ({
    registryName,
    showNewRegistry,
    registryTiles,
    effectiveRegistryId,
    actionRunning,
    onToggleNewRegistry,
    onRegistryNameChange,
    onCreateRegistry,
    onSelectRegistry,
}: {
    registryName: string;
    showNewRegistry: boolean;
    registryTiles: readonly CredentialRegistryTile[];
    effectiveRegistryId: string;
    actionRunning: boolean;
    onToggleNewRegistry: () => void;
    onRegistryNameChange: (value: string) => void;
    onCreateRegistry: () => void;
    onSelectRegistry: (registryId: string) => void;
}) => (
    <Stack spacing={1.5}>
        <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
                justifyContent: 'space-between',
                alignItems: {
                    xs: 'stretch',
                    sm: 'center',
                },
            }}
        >
            <Typography variant="h6">Registries</Typography>
            <Button
                variant="outlined"
                startIcon={<AddCircleOutlineIcon />}
                onClick={onToggleNewRegistry}
            >
                New registry
            </Button>
        </Stack>
        <Collapse in={showNewRegistry}>
            <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 8 }}>
                    <TextField
                        fullWidth
                        size="small"
                        label="Registry name"
                        value={registryName}
                        onChange={(event) =>
                            onRegistryNameChange(event.target.value)
                        }
                    />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                    <Button
                        fullWidth
                        variant="contained"
                        disabled={
                            actionRunning || registryName.trim().length === 0
                        }
                        onClick={onCreateRegistry}
                    >
                        Create
                    </Button>
                </Grid>
            </Grid>
        </Collapse>
        {registryTiles.length === 0 ? (
            <EmptyState
                title="No registries"
                message="Create a registry for this AID before issuing."
            />
        ) : (
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        md: 'repeat(2, minmax(0, 1fr))',
                    },
                    gap: 1.5,
                }}
            >
                {registryTiles.map((tile) => {
                    const selected = tile.registry.id === effectiveRegistryId;
                    return (
                        <Box
                            key={tile.registry.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => onSelectRegistry(tile.registry.id)}
                            onKeyDown={(event) => {
                                if (
                                    event.key === 'Enter' ||
                                    event.key === ' '
                                ) {
                                    event.preventDefault();
                                    onSelectRegistry(tile.registry.id);
                                }
                            }}
                            sx={[
                                {
                                    border: 1,
                                    borderColor: selected
                                        ? 'primary.main'
                                        : 'divider',
                                    borderRadius: 1,
                                    p: 1.5,
                                    bgcolor: selected
                                        ? 'action.selected'
                                        : 'background.paper',
                                },
                                clickablePanelSx,
                            ]}
                        >
                            <Stack spacing={1}>
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <Typography sx={{ fontWeight: 800 }}>
                                        {tile.registry.registryName}
                                    </Typography>
                                    <StatusPill
                                        label={`${tile.selectedTypeCount} selected type`}
                                        tone={selected ? 'info' : 'neutral'}
                                    />
                                </Stack>
                                <Typography variant="body2" sx={monoValueSx}>
                                    {abbreviateMiddle(tile.registry.regk, 24)}
                                </Typography>
                                {tile.schemaCounts.map((count) => (
                                    <TelemetryRow
                                        key={count.schemaSaid}
                                        label={count.label}
                                        value={String(count.count)}
                                    />
                                ))}
                            </Stack>
                        </Box>
                    );
                })}
            </Box>
        )}
    </Stack>
);

/**
 * SEDI voter credential issue form for a selected issuer/type/registry.
 */
export const SediVoterIssueForm = ({
    resolvedHolderContacts,
    holderAid,
    holderSelectionMessage,
    draft,
    draftErrors,
    issuerReady,
    issueBlockers,
    actionRunning,
    onHolderAidChange,
    onDraftChange,
    onIssue,
}: {
    resolvedHolderContacts: readonly ContactRecord[];
    holderAid: string;
    holderSelectionMessage: string | null;
    draft: SediVoterIssueFormDraft;
    draftErrors: Partial<Record<keyof SediVoterIssueFormDraft, string>>;
    issuerReady: boolean;
    issueBlockers: readonly string[];
    actionRunning: boolean;
    onHolderAidChange: (holderAid: string) => void;
    onDraftChange: Dispatch<SetStateAction<SediVoterIssueFormDraft>>;
    onIssue: () => void;
}) => (
    <>
        <FormControl
            fullWidth
            size="small"
            error={holderSelectionMessage !== null}
        >
            <InputLabel id="holder-contact-label">Holder contact</InputLabel>
            <Select
                labelId="holder-contact-label"
                label="Holder contact"
                value={holderAid}
                onChange={(event) => onHolderAidChange(event.target.value)}
            >
                <MenuItem value="">
                    <em>Select holder contact</em>
                </MenuItem>
                {resolvedHolderContacts.map((contact) => (
                    <MenuItem key={contact.id} value={contact.aid ?? ''}>
                        {contact.alias}
                    </MenuItem>
                ))}
            </Select>
            {holderSelectionMessage !== null && (
                <FormHelperText>{holderSelectionMessage}</FormHelperText>
            )}
        </FormControl>

        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    md: 'repeat(2, minmax(0, 1fr))',
                },
                gap: 1.5,
            }}
        >
            {SEDI_VOTER_ISSUE_TEXT_FIELDS.map(({ key, label }) => (
                <TextField
                    key={key}
                    size="small"
                    label={label}
                    value={draft[key]}
                    error={draftErrors[key] !== undefined}
                    helperText={draftErrors[key] ?? ' '}
                    onChange={(event) =>
                        onDraftChange((current) => ({
                            ...current,
                            [key]: event.target.value,
                        }))
                    }
                />
            ))}
            <FormControlLabel
                control={
                    <Checkbox
                        checked={draft.eligible}
                        onChange={(event) =>
                            onDraftChange((current) => ({
                                ...current,
                                eligible: event.target.checked,
                            }))
                        }
                    />
                }
                label="Eligible"
            />
        </Box>

        <Box
            sx={{
                border: 1,
                borderColor: issuerReady ? 'success.main' : 'warning.main',
                borderRadius: 1,
                p: 1.5,
                bgcolor: (theme) =>
                    alpha(
                        issuerReady
                            ? theme.palette.success.main
                            : theme.palette.warning.main,
                        0.08
                    ),
            }}
        >
            <Stack spacing={1}>
                <StatusPill
                    label={issuerReady ? 'Ready to issue' : 'Issue blocked'}
                    tone={issuerReady ? 'success' : 'warning'}
                />
                {issuerReady ? (
                    <Typography variant="body2">
                        Schema, registry, holder, and credential fields are
                        ready.
                    </Typography>
                ) : (
                    <Stack spacing={0.5}>
                        {issueBlockers.map((blocker) => (
                            <Typography key={blocker} variant="body2">
                                {blocker}
                            </Typography>
                        ))}
                    </Stack>
                )}
            </Stack>
        </Box>

        <Button
            variant="contained"
            startIcon={<InventoryIcon />}
            disabled={actionRunning || !issuerReady}
            onClick={onIssue}
        >
            Issue credential
        </Button>
    </>
);

/**
 * Issued credentials for one issuer/type, including grant actions.
 */
export const IssuedCredentialsForTypePanel = ({
    credentials,
    actionRunning,
    credentialTypesBySchema,
    schemasBySaid,
    identifiers,
    didWebsReadyByAid,
    issuanceAction,
    onGrant,
    onStartW3CIssuance,
}: {
    credentials: readonly CredentialSummaryRecord[];
    actionRunning: boolean;
    credentialTypesBySchema: ReadonlyMap<string, IssueableCredentialTypeView>;
    schemasBySaid: ReadonlyMap<string, SchemaRecord>;
    identifiers: readonly IdentifierSummary[];
    didWebsReadyByAid: ReadonlyMap<string, boolean>;
    issuanceAction?: CredentialActionData | null;
    onGrant: (credential: CredentialSummaryRecord) => void;
    onStartW3CIssuance: (
        credential: CredentialSummaryRecord,
        issuer: IdentifierSummary
    ) => void;
}) => (
    <ConsolePanel
        title="Issued for this type"
        actions={
            <StatusPill
                label={`${credentials.length} issued`}
                tone={credentials.length > 0 ? 'success' : 'neutral'}
            />
        }
    >
        {credentials.length === 0 ? (
            <EmptyState
                title="No issued credentials"
                message="Issued credentials for this type will appear here."
            />
        ) : (
            <Stack spacing={1.5}>
                {credentials.map((credential) => (
                    <Box
                        key={credential.said}
                        sx={{
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 1.5,
                        }}
                    >
                        <Stack spacing={1.5}>
                            <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                spacing={1}
                                sx={{
                                    justifyContent: 'space-between',
                                    alignItems: {
                                        xs: 'stretch',
                                        sm: 'center',
                                    },
                                }}
                            >
                                <StatusPill
                                    label={credential.status}
                                    tone={statusTone(credential.status)}
                                />
                                <Button
                                    variant="outlined"
                                    startIcon={<SendIcon />}
                                    disabled={
                                        actionRunning ||
                                        credential.status !== 'issued' ||
                                        credential.holderAid === null
                                    }
                                    onClick={() => onGrant(credential)}
                                >
                                    Grant
                                </Button>
                            </Stack>
                            <CredentialRecordRows
                                credential={credential}
                                credentialTypesBySchema={
                                    credentialTypesBySchema
                                }
                                schemasBySaid={schemasBySaid}
                            />
                            <CredentialW3CIssuanceControls
                                credential={credential}
                                identifiers={identifiers}
                                didWebsReadyByAid={didWebsReadyByAid}
                                actionRunning={actionRunning}
                                issuanceAction={issuanceAction}
                                onStartIssuance={onStartW3CIssuance}
                            />
                        </Stack>
                    </Box>
                ))}
            </Stack>
        )}
    </ConsolePanel>
);
