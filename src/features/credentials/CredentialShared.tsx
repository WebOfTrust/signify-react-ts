import type { ReactNode } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { StatusPill, TelemetryRow } from '../../app/Console';
import { clickablePanelSx, monoValueSx } from '../../app/consoleStyles';
import type {
    CredentialSummaryRecord,
    SchemaRecord,
} from '../../domain/credentials/credentialTypes';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import type { IssueableCredentialTypeView } from '../../domain/credentials/credentialCatalog';
import { abbreviateMiddle } from '../../domain/contacts/contactHelpers';
import { aidLabel, schemaLabel, timestampText } from './credentialDisplay';

/**
 * Shared credential summary rows for issuer and wallet panels.
 *
 * Keep credential selection, grant/admit submission, and expansion state in
 * the route container or owning panel.
 */
export const CredentialRecordRows = ({
    credential,
    credentialTypesBySchema,
    schemasBySaid = new Map(),
}: {
    credential: CredentialSummaryRecord;
    credentialTypesBySchema: ReadonlyMap<string, IssueableCredentialTypeView>;
    schemasBySaid?: ReadonlyMap<string, SchemaRecord>;
}) => (
    <Stack spacing={0.5}>
        <TelemetryRow
            label="Type"
            value={schemaLabel(
                credential.schemaSaid,
                credentialTypesBySchema,
                schemasBySaid
            )}
        />
        {credential.schemaSaid !== null && (
            <TelemetryRow
                label="Schema SAID"
                value={credential.schemaSaid}
                mono
            />
        )}
        <TelemetryRow
            label="Credential"
            value={aidLabel(credential.said)}
            mono
        />
        <TelemetryRow
            label="Issuer"
            value={aidLabel(credential.issuerAid)}
            mono
        />
        <TelemetryRow
            label="Registry"
            value={aidLabel(credential.registryId)}
            mono
        />
        <TelemetryRow
            label="Holder"
            value={aidLabel(credential.holderAid)}
            mono
        />
        <TelemetryRow
            label="Issued"
            value={timestampText(credential.issuedAt)}
        />
        {credential.grantSaid !== null && (
            <TelemetryRow label="Grant" value={credential.grantSaid} mono />
        )}
        {credential.admitSaid !== null && (
            <TelemetryRow label="Admit" value={credential.admitSaid} mono />
        )}
        {credential.attributes !== null && (
            <TelemetryRow
                label="Voter"
                value={`${credential.attributes.fullName} / ${credential.attributes.voterId}`}
            />
        )}
    </Stack>
);

/**
 * Local AID selector for credential route panels.
 */
export const AidSelector = ({
    selectedAid,
    identifiers,
    onSelect,
}: {
    selectedAid: string;
    identifiers: readonly IdentifierSummary[];
    onSelect: (aid: string) => void;
}) => (
    <FormControl fullWidth size="small">
        <InputLabel id="credential-aid-label">AID</InputLabel>
        <Select
            labelId="credential-aid-label"
            label="AID"
            value={
                identifiers.some(
                    (identifier) => identifier.prefix === selectedAid
                )
                    ? selectedAid
                    : ''
            }
            onChange={(event) => onSelect(event.target.value)}
        >
            <MenuItem value="">
                <em>Select AID</em>
            </MenuItem>
            {identifiers.map((identifier) => (
                <MenuItem key={identifier.prefix} value={identifier.prefix}>
                    {identifier.name} /{' '}
                    {abbreviateMiddle(identifier.prefix, 14)}
                </MenuItem>
            ))}
        </Select>
    </FormControl>
);

/**
 * Compact visual preview of the current wallet credential stack.
 */
export const WalletStackPreview = ({
    credentials,
    credentialTypesBySchema,
    schemasBySaid = new Map(),
}: {
    credentials: readonly CredentialSummaryRecord[];
    credentialTypesBySchema: ReadonlyMap<string, IssueableCredentialTypeView>;
    schemasBySaid?: ReadonlyMap<string, SchemaRecord>;
}) => {
    const previewCredentials = credentials.slice(0, 3);

    return (
        <Box sx={{ position: 'relative', minHeight: 150, mt: 1 }}>
            {previewCredentials.length === 0 ? (
                <Box
                    sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        height: 118,
                        p: 1.5,
                        bgcolor: 'background.paper',
                    }}
                >
                    <Typography sx={{ fontWeight: 800 }}>
                        Wallet empty
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                        No admitted credentials
                    </Typography>
                </Box>
            ) : (
                previewCredentials.map((credential, index) => (
                    <Box
                        key={credential.said}
                        sx={{
                            position: 'absolute',
                            top: index * 18,
                            left: index * 10,
                            right: 0,
                            minHeight: 100,
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 1.5,
                            bgcolor:
                                index === 0
                                    ? 'background.paper'
                                    : 'background.default',
                            boxShadow: (theme) =>
                                `0 16px 32px ${alpha(
                                    theme.palette.common.black,
                                    theme.palette.mode === 'dark' ? 0.24 : 0.1
                                )}`,
                            zIndex: previewCredentials.length - index,
                        }}
                    >
                        <Typography sx={{ fontWeight: 800 }}>
                            {schemaLabel(
                                credential.schemaSaid,
                                credentialTypesBySchema,
                                schemasBySaid
                            )}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ ...monoValueSx, mt: 1 }}
                        >
                            {abbreviateMiddle(credential.said, 24)}
                        </Typography>
                    </Box>
                ))
            )}
        </Box>
    );
};

/**
 * Small metric used by credential overview choice cards.
 */
export const OverviewMetric = ({
    label,
    value,
}: {
    label: string;
    value: string;
}) => (
    <Box sx={{ minWidth: 0 }}>
        <Typography
            variant="caption"
            color="text.secondary"
            sx={{
                display: 'block',
                fontWeight: 700,
                textTransform: 'uppercase',
            }}
        >
            {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {value}
        </Typography>
    </Box>
);

/**
 * Clickable issuer/wallet overview choice with stable route-owned navigation callbacks.
 */
export const OverviewChoiceCard = ({
    title,
    eyebrow,
    icon,
    status,
    statusTone,
    onOpen,
    children,
    actions,
    testId,
}: {
    title: string;
    eyebrow: string;
    icon: ReactNode;
    status: string;
    statusTone: 'neutral' | 'success' | 'warning' | 'error' | 'info';
    onOpen: () => void;
    children: ReactNode;
    actions?: ReactNode;
    testId: string;
}) => (
    <Box
        role="button"
        tabIndex={0}
        data-testid={testId}
        onClick={onOpen}
        onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen();
            }
        }}
        sx={[
            {
                height: '100%',
                minHeight: 300,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                boxShadow: (theme) =>
                    `0 18px 42px ${alpha(
                        theme.palette.common.black,
                        theme.palette.mode === 'dark' ? 0.2 : 0.08
                    )}`,
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                position: 'relative',
                overflow: 'hidden',
                '&:before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    borderTop: (theme) =>
                        `1px solid ${alpha(theme.palette.primary.light, 0.16)}`,
                },
            },
            clickablePanelSx,
        ]}
    >
        <Stack
            direction="row"
            spacing={1.5}
            sx={{
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                minWidth: 0,
            }}
        >
            <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                <Box
                    sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        border: 1,
                        borderColor: 'divider',
                        color: 'primary.main',
                        flex: '0 0 auto',
                    }}
                >
                    {icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        variant="caption"
                        color="primary.main"
                        sx={{ fontWeight: 700, textTransform: 'uppercase' }}
                    >
                        {eyebrow}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        {title}
                    </Typography>
                </Box>
            </Stack>
            <StatusPill label={status} tone={statusTone} />
        </Stack>
        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>{children}</Box>
        {actions != null && (
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
            >
                {actions}
            </Stack>
        )}
    </Box>
);
