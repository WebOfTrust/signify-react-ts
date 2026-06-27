import { Box, Button, Stack, Typography } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
    ConsolePanel,
    EmptyState,
    StatusPill,
    TelemetryRow,
} from '../../app/Console';
import type { CredentialActionData } from '../../app/routeData';
import { monoValueSx } from '../../app/consoleStyles';
import { abbreviateMiddle } from '../../domain/contacts/contactHelpers';
import type { IssueableCredentialTypeView } from '../../domain/credentials/credentialCatalog';
import type {
    CredentialGrantNotification,
    CredentialSummaryRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';
import type { W3CVerifierRequestPreset } from '../../domain/credentials/w3cVerifierPresets';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import type { CredentialWalletStats } from './credentialViewModels';
import { schemaLabel, schemaStatusTone, statusTone } from './credentialDisplay';
import { W3CPresentCtrls } from './W3CPresentCtrls.tsx';

/**
 * Holder-side credential type readiness panel.
 */
export const WalletCredentialTypesPanel = ({
    selectedIdentifierName,
    credentialTypes,
    unresolvedWalletCredentialType,
    actionRunning,
    onResolveSchema,
}: {
    selectedIdentifierName: string;
    credentialTypes: readonly IssueableCredentialTypeView[];
    unresolvedWalletCredentialType: IssueableCredentialTypeView | null;
    actionRunning: boolean;
    onResolveSchema: (credentialType: IssueableCredentialTypeView) => void;
}) => (
    <ConsolePanel
        title="Credential types"
        eyebrow={selectedIdentifierName}
        actions={
            <StatusPill
                label={
                    unresolvedWalletCredentialType === null
                        ? 'ready'
                        : 'setup needed'
                }
                tone={
                    unresolvedWalletCredentialType === null
                        ? 'success'
                        : 'warning'
                }
            />
        }
    >
        {credentialTypes.length === 0 ? (
            <EmptyState
                title="No supported schemas"
                message="No credential types are configured for this wallet."
            />
        ) : (
            <Stack spacing={1.5}>
                {credentialTypes.map((credentialType) => (
                    <Stack
                        key={credentialType.key}
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{
                            justifyContent: 'space-between',
                            alignItems: {
                                xs: 'stretch',
                                sm: 'center',
                            },
                            minWidth: 0,
                        }}
                    >
                        <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 800 }}>
                                {credentialType.label}
                            </Typography>
                            <Typography variant="body2" sx={monoValueSx}>
                                {abbreviateMiddle(
                                    credentialType.schemaSaid,
                                    28
                                )}
                            </Typography>
                        </Box>
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{
                                alignItems: {
                                    xs: 'stretch',
                                    sm: 'center',
                                },
                            }}
                        >
                            <StatusPill
                                label={credentialType.schemaStatus}
                                tone={schemaStatusTone(
                                    credentialType.schemaStatus
                                )}
                            />
                            {credentialType.schemaStatus !== 'resolved' && (
                                <Button
                                    variant="outlined"
                                    startIcon={<RefreshIcon />}
                                    disabled={
                                        actionRunning ||
                                        credentialType.schemaStatus ===
                                            'resolving'
                                    }
                                    onClick={() =>
                                        onResolveSchema(credentialType)
                                    }
                                >
                                    Add schema type
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                ))}
            </Stack>
        )}
    </ConsolePanel>
);

/**
 * Holder-side wallet statistics panel.
 */
export const WalletStatsPanel = ({
    selectedIdentifierName,
    walletStats,
}: {
    selectedIdentifierName: string;
    walletStats: CredentialWalletStats;
}) => (
    <ConsolePanel
        title="Wallet"
        eyebrow={selectedIdentifierName}
        actions={
            <StatusPill
                label={`${walletStats.pendingGrants} pending`}
                tone={walletStats.pendingGrants > 0 ? 'info' : 'neutral'}
            />
        }
    >
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(3, minmax(0, 1fr))',
                },
                gap: 1.5,
            }}
        >
            <TelemetryRow
                label="Admitted"
                value={String(walletStats.admitted)}
            />
            <TelemetryRow
                label="Held types"
                value={String(walletStats.heldTypes)}
            />
            <TelemetryRow
                label="Presentations"
                value={String(walletStats.presentationGrants)}
            />
        </Box>
    </ConsolePanel>
);

/**
 * Holder-side inbound credential grant panel.
 */
export const InboundGrantsPanel = ({
    grants,
    actionRunning,
    credentialTypesBySchema,
    schemasBySaid,
    onAdmit,
}: {
    grants: readonly CredentialGrantNotification[];
    actionRunning: boolean;
    credentialTypesBySchema: ReadonlyMap<string, IssueableCredentialTypeView>;
    schemasBySaid: ReadonlyMap<string, SchemaRecord>;
    onAdmit: (notificationId: string, grantSaid: string) => void;
}) => (
    <ConsolePanel title="Inbound grants">
        {grants.length === 0 ? (
            <EmptyState
                title="No credential grants"
                message="Credential grants addressed to this AID will appear here."
            />
        ) : (
            <Stack spacing={1.5}>
                {grants.map((grant) => {
                    const canAdmit = grant.status === 'actionable';
                    return (
                        <Box
                            key={grant.notificationId}
                            sx={{
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                p: 1.5,
                            }}
                        >
                            <Stack spacing={1}>
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
                                    <Typography sx={{ fontWeight: 800 }}>
                                        {String(
                                            grant.attributes.fullName ??
                                                schemaLabel(
                                                    grant.schemaSaid,
                                                    credentialTypesBySchema,
                                                    schemasBySaid
                                                )
                                        )}
                                    </Typography>
                                    <StatusPill
                                        label={grant.status}
                                        tone={canAdmit ? 'info' : 'neutral'}
                                    />
                                </Stack>
                                <Typography variant="body2" sx={monoValueSx}>
                                    {grant.credentialSaid}
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<CheckCircleOutlineIcon />}
                                    disabled={actionRunning || !canAdmit}
                                    onClick={() =>
                                        onAdmit(
                                            grant.notificationId,
                                            grant.grantSaid
                                        )
                                    }
                                >
                                    Admit
                                </Button>
                            </Stack>
                        </Box>
                    );
                })}
            </Stack>
        )}
    </ConsolePanel>
);

/**
 * Holder-side admitted credential list. W3C Present stays a row-local command.
 */
export const HeldCredentialsPanel = ({
    credentials,
    credentialTypesBySchema,
    schemasBySaid,
    identifiers,
    didWebsReadyByAid,
    verifiers,
    selectedVerifierId,
    presentationAction,
    actionRunning,
    onVerifierChange,
    onPresent,
}: {
    credentials: readonly CredentialSummaryRecord[];
    credentialTypesBySchema: ReadonlyMap<string, IssueableCredentialTypeView>;
    schemasBySaid: ReadonlyMap<string, SchemaRecord>;
    identifiers: readonly IdentifierSummary[];
    didWebsReadyByAid: ReadonlyMap<string, boolean>;
    verifiers: readonly W3CVerifierRequestPreset[];
    selectedVerifierId: string;
    presentationAction?: CredentialActionData | null;
    actionRunning: boolean;
    onVerifierChange: (verifierRequestJson: string) => void;
    onPresent: (
        credential: CredentialSummaryRecord,
        presenter: IdentifierSummary,
        verifierRequestJson: string
    ) => void;
}) => (
    <ConsolePanel title="Held credentials">
        {credentials.length === 0 ? (
            <EmptyState
                title="No held credentials"
                message="Admitted credentials for this AID will appear here."
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
                            bgcolor: 'background.paper',
                        }}
                    >
                        <Stack spacing={1}>
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
                                <Typography sx={{ fontWeight: 800 }}>
                                    {schemaLabel(
                                        credential.schemaSaid,
                                        credentialTypesBySchema,
                                        schemasBySaid
                                    )}
                                </Typography>
                                <StatusPill
                                    label={credential.status}
                                    tone={statusTone(credential.status)}
                                />
                            </Stack>
                            <Typography variant="body2" sx={monoValueSx}>
                                {abbreviateMiddle(credential.said, 28)}
                            </Typography>
                            <W3CPresentCtrls
                                credential={credential}
                                identifiers={identifiers}
                                didWebsReadyByAid={didWebsReadyByAid}
                                verifiers={verifiers}
                                selectedVerifierId={selectedVerifierId}
                                presentationAction={presentationAction}
                                actionRunning={actionRunning}
                                onVerifierChange={onVerifierChange}
                                onPresent={onPresent}
                            />
                        </Stack>
                    </Box>
                ))}
            </Stack>
        )}
    </ConsolePanel>
);
