import { useMemo, type ReactNode } from 'react';
import {
    Box,
    Button,
    List,
    ListItem,
    ListItemText,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    Link as RouterLink,
    useLoaderData,
    useLocation,
    useNavigate,
    useParams,
} from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import {
    ConsolePanel,
    EmptyState,
    PageHeader,
    StatusPill,
    TelemetryRow,
} from '../../app/Console';
import { clickablePanelSx, monoValueSx } from '../../app/consoleStyles';
import { useAppSession } from '../../app/runtimeHooks';
import { formatTimestamp } from '../../app/timeFormat';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { DashboardLoaderData } from '../../app/routeData';
import { abbreviateMiddle } from '../contacts/contactHelpers';
import { schemaRuleViews } from './schemaRules';
import type {
    CredentialIpexActivityRecord,
    CredentialSummaryRecord,
} from '../../state/credentials.slice';
import type { CredentialGrantNotification } from '../../state/notifications.slice';
import type { RegistryRecord } from '../../state/registry.slice';
import type { SchemaRecord } from '../../state/schema.slice';
import { useAppSelector } from '../../state/hooks';
import { ISSUEABLE_CREDENTIAL_TYPES } from '../../state/issueableCredentialTypes';
import {
    selectContacts,
    selectCredentialIpexActivity,
    selectCredentialRegistries,
    selectDashboardCounts,
    selectCredentialGrantNotifications,
    selectHeldCredentials,
    selectIdentifiers,
    selectIssuedCredentials,
    selectRecentAppNotifications,
    selectRecentChallenges,
    selectRecentKeriaNotifications,
    selectRecentOperations,
    selectResolvedCredentialSchemas,
    selectSession,
} from '../../state/selectors';

type DashboardMode =
    | 'overview'
    | 'schemas'
    | 'issuedCredentials'
    | 'heldCredentials'
    | 'credentialDetail';

type AidAliases = ReadonlyMap<string, string>;

interface CredentialActivityEntry {
    id: string;
    kind: 'grant' | 'admit';
    direction: 'sent' | 'received' | 'unknown';
    title: string;
    timestamp: string | null;
    said: string;
    primaryAid: string | null;
    secondaryAid: string | null;
}

const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

const displayText = (value: string | null | undefined): string =>
    value === undefined || value === null || value.trim().length === 0
        ? 'Not available'
        : value;

const dashboardModeForPath = (pathname: string): DashboardMode => {
    if (pathname === '/dashboard/schemas') {
        return 'schemas';
    }

    if (pathname === '/dashboard/credentials/issued') {
        return 'issuedCredentials';
    }

    if (pathname === '/dashboard/credentials/held') {
        return 'heldCredentials';
    }

    if (pathname.startsWith('/dashboard/credentials/')) {
        return 'credentialDetail';
    }

    return 'overview';
};

const credentialDetailPath = (said: string): string =>
    `/dashboard/credentials/${encodeURIComponent(said)}`;

const schemaTypeLabel = (schemaSaid: string | null | undefined): string => {
    if (schemaSaid === undefined || schemaSaid === null) {
        return 'Unknown schema';
    }

    return (
        ISSUEABLE_CREDENTIAL_TYPES.find(
            (type) => type.schemaSaid === schemaSaid
        )?.label ?? 'Credential schema'
    );
};

const schemaTitle = (schema: SchemaRecord): string =>
    schema.title ?? schemaTypeLabel(schema.said);

const credentialTypeLabel = (credential: CredentialSummaryRecord): string =>
    schemaTypeLabel(credential.schemaSaid);

const copyToClipboard = (value: string): void => {
    void globalThis.navigator.clipboard?.writeText(value);
};

const CopyableAbbreviation = ({
    value,
    label,
    maxLength = 18,
}: {
    value: string;
    label: string;
    maxLength?: number;
}) => (
    <Tooltip title={value}>
        <Box
            component="button"
            type="button"
            aria-label={`Copy ${label} ${value}`}
            data-ui-sound={UI_SOUND_HOVER_VALUE}
            onClick={(event) => {
                event.stopPropagation();
                copyToClipboard(value);
            }}
            sx={{
                p: 0,
                m: 0,
                border: 0,
                bgcolor: 'transparent',
                color: 'primary.main',
                cursor: 'copy',
                display: 'inline',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                textAlign: 'left',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'clip',
                verticalAlign: 'baseline',
                whiteSpace: 'nowrap',
                ...monoValueSx,
            }}
        >
            {abbreviateMiddle(value, maxLength)}
        </Box>
    </Tooltip>
);

const AidValue = ({
    aid,
    aliases,
}: {
    aid: string | null;
    aliases: AidAliases;
}) => {
    if (aid === null) {
        return <DetailValue mono>Not available</DetailValue>;
    }

    const alias = aliases.get(aid) ?? null;
    return (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            {alias !== null && (
                <Typography variant="body2" noWrap>
                    {alias}
                </Typography>
            )}
            <CopyableAbbreviation value={aid} label="AID" maxLength={20} />
        </Stack>
    );
};

const FullMonoValue = ({ value }: { value: string }) => (
    <Typography component="span" variant="body2" sx={monoValueSx}>
        {value}
    </Typography>
);

const FullAidValue = ({
    aid,
    aliases,
}: {
    aid: string | null;
    aliases: AidAliases;
}) => {
    if (aid === null) {
        return <FullMonoValue value="Not available" />;
    }

    const alias = aliases.get(aid) ?? null;
    return (
        <Stack spacing={0.25} sx={{ minWidth: 0 }}>
            {alias !== null && (
                <Typography variant="body2" noWrap>
                    {alias}
                </Typography>
            )}
            <FullMonoValue value={aid} />
        </Stack>
    );
};

const CredentialTypeValue = ({
    credential,
}: {
    credential: CredentialSummaryRecord;
}) => (
    <Stack spacing={0.25} sx={{ minWidth: 0 }}>
        <Typography variant="body2" noWrap>
            {credentialTypeLabel(credential)}
        </Typography>
        {credential.schemaSaid !== null && (
            <CopyableAbbreviation
                value={credential.schemaSaid}
                label="schema SAID"
                maxLength={18}
            />
        )}
    </Stack>
);

const credentialLedgerStatus = (
    credential: CredentialSummaryRecord
): {
    label: string;
    tone: 'neutral' | 'success' | 'warning' | 'error' | 'info';
} => {
    if (credential.error !== null || credential.status === 'error') {
        return { label: 'error', tone: 'error' };
    }

    if (credential.revokedAt !== null || credential.status === 'revoked') {
        return { label: 'revoked', tone: 'warning' };
    }

    return { label: 'issued', tone: 'success' };
};

const buildCredentialActivity = ({
    credential,
    grantNotifications,
    exchangeActivities,
}: {
    credential: CredentialSummaryRecord;
    grantNotifications: readonly CredentialGrantNotification[];
    exchangeActivities: readonly CredentialIpexActivityRecord[];
}): CredentialActivityEntry[] => {
    const entries: CredentialActivityEntry[] = [];

    for (const activity of exchangeActivities) {
        const directionLabel =
            activity.direction === 'sent'
                ? 'Sent'
                : activity.direction === 'received'
                  ? 'Received'
                  : 'Observed';
        const kindLabel = activity.kind === 'grant' ? 'Grant' : 'Admit';
        entries.push({
            id: `exchange:${activity.exchangeSaid}`,
            kind: activity.kind,
            direction: activity.direction,
            title: `${directionLabel} ${kindLabel}`,
            timestamp: activity.createdAt,
            said: activity.exchangeSaid,
            primaryAid: activity.senderAid,
            secondaryAid: activity.recipientAid,
        });
    }

    const matchingGrantNotifications = grantNotifications.filter(
        (grant) =>
            grant.credentialSaid === credential.said &&
            !entries.some((entry) => entry.said === grant.grantSaid)
    );

    if (matchingGrantNotifications.length > 0) {
        for (const grant of matchingGrantNotifications) {
            entries.push({
                id: `received-grant:${grant.grantSaid}`,
                kind: 'grant',
                direction: 'received',
                title: 'Received Grant',
                timestamp: grant.createdAt,
                said: grant.grantSaid,
                primaryAid: grant.issuerAid,
                secondaryAid: grant.holderAid,
            });
        }
    } else if (
        credential.direction === 'held' &&
        credential.grantSaid !== null &&
        !entries.some((entry) => entry.said === credential.grantSaid)
    ) {
        entries.push({
            id: `received-grant:${credential.grantSaid}`,
            kind: 'grant',
            direction: 'received',
            title: 'Received Grant',
            timestamp: credential.grantedAt ?? credential.admittedAt,
            said: credential.grantSaid,
            primaryAid: credential.issuerAid,
            secondaryAid: credential.holderAid,
        });
    }

    if (
        credential.direction === 'held' &&
        credential.admitSaid !== null &&
        !entries.some((entry) => entry.said === credential.admitSaid)
    ) {
        entries.push({
            id: `sent-admit:${credential.admitSaid}`,
            kind: 'admit',
            direction: 'sent',
            title: 'Sent Admit',
            timestamp: credential.admittedAt,
            said: credential.admitSaid,
            primaryAid: credential.holderAid,
            secondaryAid: credential.issuerAid,
        });
    }

    if (
        credential.direction === 'issued' &&
        credential.grantSaid !== null &&
        !entries.some((entry) => entry.said === credential.grantSaid)
    ) {
        entries.push({
            id: `sent-grant:${credential.grantSaid}`,
            kind: 'grant',
            direction: 'sent',
            title: 'Sent Grant',
            timestamp: credential.grantedAt,
            said: credential.grantSaid,
            primaryAid: credential.issuerAid,
            secondaryAid: credential.holderAid,
        });
    }

    return entries.sort((left, right) => {
        if (left.timestamp === null && right.timestamp === null) {
            return left.title.localeCompare(right.title);
        }

        if (left.timestamp === null) {
            return 1;
        }

        if (right.timestamp === null) {
            return -1;
        }

        return left.timestamp.localeCompare(right.timestamp);
    });
};

const registryDisplay = (
    credential: CredentialSummaryRecord,
    registriesById: ReadonlyMap<string, RegistryRecord>
): string => {
    if (credential.registryId === null) {
        return 'Not available';
    }

    const registry = registriesById.get(credential.registryId);
    if (registry === undefined) {
        return credential.registryId;
    }

    return registry.regk || registry.registryName || registry.id;
};

const DetailValue = ({
    children,
    mono = false,
}: {
    children: ReactNode;
    mono?: boolean;
}) => (
    <Typography
        component="span"
        variant="body2"
        sx={mono ? monoValueSx : undefined}
    >
        {children}
    </Typography>
);

const BackToDashboard = () => (
    <Button
        component={RouterLink}
        to="/dashboard"
        variant="outlined"
        data-ui-sound={UI_SOUND_HOVER_VALUE}
    >
        Back to Dashboard
    </Button>
);

const CountTile = ({
    label,
    value,
    to,
    testId,
}: {
    label: string;
    value: number;
    to: string;
    testId?: string;
}) => (
    <Box
        component={RouterLink}
        to={to}
        aria-label={`Open ${label}`}
        data-testid={testId}
        data-ui-sound={UI_SOUND_HOVER_VALUE}
        sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            px: 2,
            py: 1.75,
            minWidth: 0,
            ...clickablePanelSx,
        }}
    >
        <Typography variant="caption" color="text.secondary">
            {label}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5 }}>
            {value}
        </Typography>
    </Box>
);

const CredentialSubTile = ({
    label,
    value,
    to,
    testId,
}: {
    label: string;
    value: number;
    to: string;
    testId: string;
}) => (
    <Box
        component={RouterLink}
        to={to}
        aria-label={`Open ${label} credentials`}
        data-testid={testId}
        data-ui-sound={UI_SOUND_HOVER_VALUE}
        sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'rgba(13, 23, 34, 0.72)',
            px: 1.25,
            py: 1,
            minWidth: 0,
            ...clickablePanelSx,
        }}
    >
        <Typography variant="caption" color="text.secondary">
            {label}
        </Typography>
        <Typography variant="h5" sx={{ mt: 0.25 }}>
            {value}
        </Typography>
    </Box>
);

const CredentialsCountTile = ({
    issued,
    held,
}: {
    issued: number;
    held: number;
}) => (
    <Box
        data-testid="dashboard-credentials-tile"
        sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            bgcolor: 'background.paper',
            px: 2,
            py: 1.75,
            minWidth: 0,
        }}
    >
        <Typography variant="caption" color="text.secondary">
            Credentials
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5 }}>
            {issued + held}
        </Typography>
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                },
                gap: 1,
                mt: 1.25,
            }}
        >
            <CredentialSubTile
                label="Issued"
                value={issued}
                to="/dashboard/credentials/issued"
                testId="dashboard-issued-credentials-tile"
            />
            <CredentialSubTile
                label="Held"
                value={held}
                to="/dashboard/credentials/held"
                testId="dashboard-held-credentials-tile"
            />
        </Box>
    </Box>
);

const DashboardWarning = ({ message }: { message: string }) => (
    <Box
        sx={{
            border: 1,
            borderColor: 'warning.main',
            borderRadius: 1,
            bgcolor: 'rgba(255, 196, 87, 0.08)',
            px: 2,
            py: 1.25,
        }}
    >
        <StatusPill label="warning" tone="warning" />{' '}
        <Typography component="span" color="text.primary">
            {message}
        </Typography>
    </Box>
);

const DashboardOverview = ({
    loaderData,
}: {
    loaderData: Exclude<DashboardLoaderData, { status: 'blocked' }>;
}) => {
    const runtimeSnapshot = useAppSession();
    const session = useAppSelector(selectSession);
    const counts = useAppSelector(selectDashboardCounts);
    const recentOperations = useAppSelector(selectRecentOperations(5));
    const recentKeriaNotifications = useAppSelector(
        selectRecentKeriaNotifications(5)
    );
    const recentAppNotifications = useAppSelector(selectRecentAppNotifications(5));
    const recentChallenges = useAppSelector(selectRecentChallenges(5));
    const connection = runtimeSnapshot.connection;
    const keriaTarget =
        connection.status === 'connected' ? connection.client.url : 'Disconnected';

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }} data-testid="dashboard-view">
            <PageHeader
                eyebrow="Session"
                title="Dashboard"
                summary="Live agent inventory, operation status, credential inventory, and protocol activity for the connected KERIA session."
            />
            {loaderData.status === 'error' && (
                <DashboardWarning message={loaderData.message} />
            )}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                        xs: '1fr',
                        sm: 'repeat(2, minmax(0, 1fr))',
                        lg: 'repeat(4, minmax(0, 1fr))',
                    },
                    gap: 1.5,
                }}
            >
                <CountTile
                    label="Identifiers"
                    value={counts.identifiers}
                    to="/identifiers"
                    testId="dashboard-identifiers-tile"
                />
                <CountTile
                    label="Contacts"
                    value={counts.contacts}
                    to="/contacts"
                    testId="dashboard-contacts-tile"
                />
                <CountTile
                    label="Schemas resolved"
                    value={counts.resolvedSchemas}
                    to="/dashboard/schemas"
                    testId="dashboard-schemas-tile"
                />
                <CredentialsCountTile
                    issued={counts.issuedCredentials}
                    held={counts.heldCredentials}
                />
                <CountTile
                    label="Active operations"
                    value={counts.activeOperations}
                    to="/operations"
                />
                <CountTile
                    label="Unread KERIA notices"
                    value={counts.unreadKeriaNotifications}
                    to="/notifications"
                />
                <CountTile
                    label="Unread app notices"
                    value={counts.unreadAppNotifications}
                    to="/notifications"
                />
                <CountTile
                    label="Challenges"
                    value={counts.challenges}
                    to="/contacts"
                />
            </Box>
            <ConsolePanel title="Agent information" eyebrow="KERIA" to="/client">
                <TelemetryRow
                    label="Controller AID"
                    value={session.controllerAid ?? 'Not connected'}
                    mono
                />
                <TelemetryRow
                    label="Agent AID"
                    value={session.agentAid ?? 'Not connected'}
                    mono
                />
                <TelemetryRow
                    label="Connected"
                    value={timestampText(session.connectedAt)}
                />
                <TelemetryRow label="KERIA target" value={keriaTarget} mono />
                <TelemetryRow
                    label="Booted this session"
                    value={session.booted ? 'Yes' : 'No'}
                />
            </ConsolePanel>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                    gap: 2,
                }}
            >
                <ConsolePanel
                    title="Recent operations"
                    eyebrow="Runtime"
                    to="/operations"
                >
                    {recentOperations.length === 0 ? (
                        <EmptyState
                            title="No operations"
                            message="Background workflow activity appears here."
                        />
                    ) : (
                        <List disablePadding>
                            {recentOperations.map((operation) => (
                                <ListItem
                                    key={operation.requestId}
                                    disableGutters
                                    sx={{ alignItems: 'flex-start' }}
                                >
                                    <ListItemText
                                        primary={
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Typography component="span">
                                                    {operation.title}
                                                </Typography>
                                                <StatusPill
                                                    label={operation.status}
                                                    tone={
                                                        operation.status ===
                                                        'error'
                                                            ? 'error'
                                                            : operation.status ===
                                                                'success'
                                                              ? 'success'
                                                              : operation.status ===
                                                                  'running'
                                                                ? 'warning'
                                                                : 'neutral'
                                                    }
                                                />
                                            </Stack>
                                        }
                                        secondary={timestampText(
                                            operation.startedAt
                                        )}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </ConsolePanel>
                <ConsolePanel
                    title="Protocol notifications"
                    eyebrow="KERIA"
                    to="/notifications"
                >
                    {recentKeriaNotifications.length === 0 ? (
                        <EmptyState
                            title="No protocol notifications"
                            message="KERIA inbox items appear here after sync."
                        />
                    ) : (
                        <List disablePadding>
                            {recentKeriaNotifications.map((notification) => (
                                <ListItem
                                    key={notification.id}
                                    disableGutters
                                    sx={{ alignItems: 'flex-start' }}
                                >
                                    <ListItemText
                                        primary={
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Typography component="span">
                                                    {notification.route}
                                                </Typography>
                                                <StatusPill
                                                    label={
                                                        notification.read
                                                            ? 'read'
                                                            : 'unread'
                                                    }
                                                    tone={
                                                        notification.read
                                                            ? 'neutral'
                                                            : 'info'
                                                    }
                                                />
                                            </Stack>
                                        }
                                        secondary={timestampText(
                                            notification.updatedAt
                                        )}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </ConsolePanel>
                <ConsolePanel
                    title="App notices"
                    eyebrow="Runtime"
                    to="/notifications"
                >
                    {recentAppNotifications.length === 0 ? (
                        <EmptyState
                            title="No app notices"
                            message="Completed background tasks report here."
                        />
                    ) : (
                        <List disablePadding>
                            {recentAppNotifications.map((notification) => (
                                <ListItem
                                    key={notification.id}
                                    disableGutters
                                    sx={{ alignItems: 'flex-start' }}
                                >
                                    <ListItemText
                                        primary={notification.title}
                                        secondary={notification.message}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </ConsolePanel>
                <ConsolePanel
                    title="Challenge responses"
                    eyebrow="Contacts"
                    to="/contacts"
                >
                    {recentChallenges.length === 0 ? (
                        <EmptyState
                            title="No challenge responses"
                            message="Resolved contact challenge records appear here."
                        />
                    ) : (
                        <List disablePadding>
                            {recentChallenges.map((challenge) => (
                                <ListItem
                                    key={challenge.id}
                                    disableGutters
                                    sx={{ alignItems: 'flex-start' }}
                                >
                                    <ListItemText
                                        primary={
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Typography component="span">
                                                    {challenge.role}
                                                </Typography>
                                                <StatusPill
                                                    label={challenge.status}
                                                    tone={
                                                        challenge.authenticated
                                                            ? 'success'
                                                            : 'warning'
                                                    }
                                                />
                                            </Stack>
                                        }
                                        secondary={timestampText(
                                            challenge.updatedAt
                                        )}
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </ConsolePanel>
            </Box>
        </Box>
    );
};

const ResolvedSchemasDetail = ({
    loaderData,
    schemas,
}: {
    loaderData: Exclude<DashboardLoaderData, { status: 'blocked' }>;
    schemas: readonly SchemaRecord[];
}) => (
    <Box
        sx={{ display: 'grid', gap: 2.5 }}
        data-testid="dashboard-schemas-detail"
    >
        <PageHeader
            eyebrow="Dashboard"
            title="Resolved Schemas"
            summary="Credential schema types recorded as resolved for the connected agent."
            actions={<BackToDashboard />}
        />
        {loaderData.status === 'error' && (
            <DashboardWarning message={loaderData.message} />
        )}
        <ConsolePanel title="Schemas resolved" eyebrow="Credentials">
            {schemas.length === 0 ? (
                <EmptyState
                    title="No resolved schemas"
                    message="Add a supported credential type before issuing or receiving credentials."
                    action={
                        <Button
                            component={RouterLink}
                            to="/credentials"
                            variant="contained"
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                        >
                            Open Credentials
                        </Button>
                    }
                />
            ) : (
                <>
                    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                        <TableContainer>
                            <Table
                                size="small"
                                data-testid="dashboard-schemas-table"
                            >
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Schema</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>SAID</TableCell>
                                        <TableCell>OOBI URL</TableCell>
                                        <TableCell>Version</TableCell>
                                        <TableCell>Updated</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {schemas.map((schema) => (
                                        <TableRow key={schema.said}>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {schemaTitle(schema)}
                                                </Typography>
                                                {schema.description !== null && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        {schema.description}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <StatusPill
                                                    label={schema.status}
                                                    tone="success"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <DetailValue mono>
                                                    {schema.said}
                                                </DetailValue>
                                            </TableCell>
                                            <TableCell>
                                                <DetailValue mono>
                                                    {displayText(schema.oobi)}
                                                </DetailValue>
                                            </TableCell>
                                            <TableCell>
                                                {displayText(schema.version)}
                                            </TableCell>
                                            <TableCell>
                                                {timestampText(schema.updatedAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                    <Stack
                        spacing={1.5}
                        sx={{ display: { xs: 'flex', md: 'none' } }}
                    >
                        {schemas.map((schema) => (
                            <Box
                                key={schema.said}
                                sx={{
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    pb: 1.5,
                                    '&:last-child': {
                                        borderBottom: 0,
                                        pb: 0,
                                    },
                                }}
                            >
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: 1,
                                        mb: 1,
                                    }}
                                >
                                    <Typography variant="subtitle1">
                                        {schemaTitle(schema)}
                                    </Typography>
                                    <StatusPill
                                        label={schema.status}
                                        tone="success"
                                    />
                                </Stack>
                                <TelemetryRow
                                    label="SAID"
                                    value={schema.said}
                                    mono
                                />
                                <TelemetryRow
                                    label="OOBI URL"
                                    value={displayText(schema.oobi)}
                                    mono
                                />
                                <TelemetryRow
                                    label="Version"
                                    value={displayText(schema.version)}
                                />
                                <TelemetryRow
                                    label="Updated"
                                    value={timestampText(schema.updatedAt)}
                                />
                            </Box>
                        ))}
                    </Stack>
                </>
            )}
        </ConsolePanel>
    </Box>
);

const CredentialDetailMobileRows = ({
    credentials,
    aidAliases,
    onOpenCredential,
}: {
    credentials: readonly CredentialSummaryRecord[];
    aidAliases: AidAliases;
    onOpenCredential: (said: string) => void;
}) => (
    <Stack spacing={1.5} sx={{ display: { xs: 'flex', md: 'none' } }}>
        {credentials.map((credential) => (
            <Box
                key={credential.said}
                role="button"
                tabIndex={0}
                data-ui-sound={UI_SOUND_HOVER_VALUE}
                onClick={() => onOpenCredential(credential.said)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onOpenCredential(credential.said);
                    }
                }}
                sx={{
                    borderBottom: 1,
                    borderColor: 'divider',
                    cursor: 'pointer',
                    pb: 1.5,
                    '&:last-child': {
                        borderBottom: 0,
                        pb: 0,
                    },
                }}
            >
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        mb: 1,
                    }}
                >
                    <CredentialTypeValue credential={credential} />
                </Stack>
                <TelemetryRow
                    label="Credential SAID"
                    value={
                        <CopyableAbbreviation
                            value={credential.said}
                            label="credential SAID"
                            maxLength={20}
                        />
                    }
                />
                <TelemetryRow
                    label="Issuer AID"
                    value={
                        <AidValue
                            aid={credential.issuerAid}
                            aliases={aidAliases}
                        />
                    }
                />
                <TelemetryRow
                    label="Holder AID"
                    value={
                        <AidValue
                            aid={credential.holderAid}
                            aliases={aidAliases}
                        />
                    }
                />
            </Box>
        ))}
    </Stack>
);

const CredentialDetailTable = ({
    credentials,
    aidAliases,
    kind,
    onOpenCredential,
}: {
    credentials: readonly CredentialSummaryRecord[];
    aidAliases: AidAliases;
    kind: 'issued' | 'held';
    onOpenCredential: (said: string) => void;
}) => (
    <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <TableContainer>
            <Table
                size="small"
                data-testid={`dashboard-${kind}-credentials-table`}
            >
                <TableHead>
                    <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>Issuer AID</TableCell>
                        <TableCell>Holder AID</TableCell>
                        <TableCell>Credential SAID</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {credentials.map((credential) => (
                        <TableRow
                            key={credential.said}
                            hover
                            role="button"
                            tabIndex={0}
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                            onClick={() => onOpenCredential(credential.said)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    onOpenCredential(credential.said);
                                }
                            }}
                            sx={{ cursor: 'pointer' }}
                        >
                            <TableCell>
                                <CredentialTypeValue credential={credential} />
                            </TableCell>
                            <TableCell>
                                <AidValue
                                    aid={credential.issuerAid}
                                    aliases={aidAliases}
                                />
                            </TableCell>
                            <TableCell>
                                <AidValue
                                    aid={credential.holderAid}
                                    aliases={aidAliases}
                                />
                            </TableCell>
                            <TableCell>
                                <CopyableAbbreviation
                                    value={credential.said}
                                    label="credential SAID"
                                    maxLength={20}
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    </Box>
);

const CredentialsDetail = ({
    loaderData,
    credentials,
    aidAliases,
    kind,
    onOpenCredential,
}: {
    loaderData: Exclude<DashboardLoaderData, { status: 'blocked' }>;
    credentials: readonly CredentialSummaryRecord[];
    aidAliases: AidAliases;
    kind: 'issued' | 'held';
    onOpenCredential: (said: string) => void;
}) => {
    const issued = kind === 'issued';
    const title = issued ? 'Issued Credentials' : 'Held Credentials';
    const emptyTitle = issued ? 'No issued credentials' : 'No held credentials';
    const emptyMessage = issued
        ? 'Credentials issued from any local AID and registry will appear here.'
        : 'Credentials admitted into this wallet will appear here.';

    return (
        <Box
            sx={{ display: 'grid', gap: 2.5 }}
            data-testid={`dashboard-${kind}-credentials-detail`}
        >
            <PageHeader
                eyebrow="Dashboard"
                title={title}
                summary={
                    issued
                        ? 'All credentials issued by this connected wallet across every registry.'
                        : 'All credentials currently held by this connected wallet.'
                }
                actions={<BackToDashboard />}
            />
            {loaderData.status === 'error' && (
                <DashboardWarning message={loaderData.message} />
            )}
            <ConsolePanel title={title} eyebrow="Credentials">
                {credentials.length === 0 ? (
                    <EmptyState
                        title={emptyTitle}
                        message={emptyMessage}
                        action={
                            <Button
                                component={RouterLink}
                                to="/credentials"
                                variant="contained"
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                            >
                                Open Credentials
                            </Button>
                        }
                    />
                ) : (
                    <>
                        <CredentialDetailTable
                            credentials={credentials}
                            aidAliases={aidAliases}
                            kind={kind}
                            onOpenCredential={onOpenCredential}
                        />
                        <CredentialDetailMobileRows
                            credentials={credentials}
                            aidAliases={aidAliases}
                            onOpenCredential={onOpenCredential}
                        />
                    </>
                )}
            </ConsolePanel>
        </Box>
    );
};

const CredentialActivityPill = ({
    entry,
}: {
    entry: CredentialActivityEntry;
}) => {
    const direction =
        entry.direction === 'sent'
            ? 'sent'
            : entry.direction === 'received'
              ? 'received'
              : 'observed';
    const kind = entry.kind === 'grant' ? 'grant' : 'admit';
    return (
        <StatusPill
            label={`${direction} ${kind}`}
            tone={entry.kind === 'admit' ? 'success' : 'info'}
        />
    );
};

const credentialDataRows = (
    credential: CredentialSummaryRecord
): Array<{ label: string; value: ReactNode }> => {
    if (credential.attributes === null) {
        return [];
    }

    return [
        { label: 'Subject AID', value: credential.attributes.i },
        { label: 'Full name', value: credential.attributes.fullName },
        { label: 'Voter ID', value: credential.attributes.voterId },
        { label: 'Precinct ID', value: credential.attributes.precinctId },
        { label: 'County', value: credential.attributes.county },
        { label: 'Jurisdiction', value: credential.attributes.jurisdiction },
        { label: 'Election ID', value: credential.attributes.electionId },
        { label: 'Eligible', value: credential.attributes.eligible ? 'Yes' : 'No' },
        { label: 'Expires', value: credential.attributes.expires },
    ];
};

const CredentialRecordDetail = ({
    loaderData,
    credential,
    schema,
    registriesById,
    aidAliases,
    activity,
}: {
    loaderData: Exclude<DashboardLoaderData, { status: 'blocked' }>;
    credential: CredentialSummaryRecord | null;
    schema: SchemaRecord | null;
    registriesById: ReadonlyMap<string, RegistryRecord>;
    aidAliases: AidAliases;
    activity: readonly CredentialActivityEntry[];
}) => {
    if (credential === null) {
        return (
            <Box
                sx={{ display: 'grid', gap: 2.5 }}
                data-testid="dashboard-credential-detail"
            >
                <PageHeader
                    eyebrow="Dashboard"
                    title="Credential not found"
                    actions={<BackToDashboard />}
                />
                {loaderData.status === 'error' && (
                    <DashboardWarning message={loaderData.message} />
                )}
                <EmptyState
                    title="No credential record"
                    message="The credential is not present in this connected wallet's local inventory."
                    action={
                        <Button
                            component={RouterLink}
                            to="/dashboard/credentials/held"
                            variant="contained"
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                        >
                            Open Held Credentials
                        </Button>
                    }
                />
            </Box>
        );
    }

    const ledgerStatus = credentialLedgerStatus(credential);
    const dataRows = credentialDataRows(credential);
    const schemaRules = schema?.rules ?? null;
    const schemaRulesRows = schemaRuleViews(schemaRules);
    const backPath =
        credential.direction === 'issued'
            ? '/dashboard/credentials/issued'
            : '/dashboard/credentials/held';

    return (
        <Box
            sx={{ display: 'grid', gap: 2.5 }}
            data-testid="dashboard-credential-detail"
        >
            <PageHeader
                eyebrow="Credential"
                title={credentialTypeLabel(credential)}
                summary={credential.said}
                actions={
                    <Button
                        component={RouterLink}
                        to={backPath}
                        variant="outlined"
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                    >
                        Back to {credential.direction === 'issued' ? 'Issued' : 'Held'}
                    </Button>
                }
            />
            {loaderData.status === 'error' && (
                <DashboardWarning message={loaderData.message} />
            )}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                    gap: 2,
                }}
            >
                <ConsolePanel
                    title="Credential"
                    eyebrow="Inventory"
                    actions={
                        <StatusPill
                            label={ledgerStatus.label}
                            tone={ledgerStatus.tone}
                        />
                    }
                >
                    <Stack spacing={0.5}>
                        <TelemetryRow
                            label="Type"
                            value={credentialTypeLabel(credential)}
                        />
                        <TelemetryRow
                            label="Credential SAID"
                            value={<FullMonoValue value={credential.said} />}
                        />
                        <TelemetryRow
                            label="Schema SAID"
                            value={
                                credential.schemaSaid === null ? (
                                    'Not available'
                                ) : (
                                    <FullMonoValue value={credential.schemaSaid} />
                                )
                            }
                        />
                        <TelemetryRow
                            label="Issuer AID"
                            value={
                                <FullAidValue
                                    aid={credential.issuerAid}
                                    aliases={aidAliases}
                                />
                            }
                        />
                        <TelemetryRow
                            label="Holder AID"
                            value={
                                <FullAidValue
                                    aid={credential.holderAid}
                                    aliases={aidAliases}
                                />
                            }
                        />
                        <TelemetryRow
                            label="Registry"
                            value={registryDisplay(credential, registriesById)}
                            mono
                        />
                        <TelemetryRow
                            label="Issued"
                            value={timestampText(credential.issuedAt)}
                        />
                        {credential.revokedAt !== null && (
                            <TelemetryRow
                                label="Revoked"
                                value={timestampText(credential.revokedAt)}
                            />
                        )}
                        {credential.error !== null && (
                            <TelemetryRow
                                label="Error"
                                value={credential.error}
                            />
                        )}
                    </Stack>
                </ConsolePanel>
                <ConsolePanel title="Credential data" eyebrow="Subject">
                    {dataRows.length === 0 ? (
                        <EmptyState
                            title="No decoded credential data"
                            message="This credential does not match a supported local data mapper."
                        />
                    ) : (
                        <Stack spacing={0.5}>
                            {dataRows.map((row) => (
                                <TelemetryRow
                                    key={row.label}
                                    label={row.label}
                                    value={row.value}
                                />
                            ))}
                        </Stack>
                    )}
                </ConsolePanel>
            </Box>
            <ConsolePanel title="Schema rules" eyebrow="ACDC">
                {schemaRulesRows.length === 0 ? (
                    <EmptyState
                        title="No schema rules"
                        message="The resolved schema does not include a top-level rules section."
                    />
                ) : (
                    <TableContainer>
                        <Table size="small" aria-label="Schema rules">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Name</TableCell>
                                    <TableCell>Value</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {schemaRulesRows.map((rule) => (
                                    <TableRow
                                        key={rule.name}
                                        data-testid={`schema-rule-${rule.name}`}
                                    >
                                        <TableCell
                                            sx={{
                                                width: { xs: '42%', md: '30%' },
                                                verticalAlign: 'top',
                                                ...monoValueSx,
                                                overflowWrap: 'anywhere',
                                            }}
                                        >
                                            {rule.name}
                                        </TableCell>
                                        <TableCell
                                            sx={{
                                                verticalAlign: 'top',
                                                overflowWrap: 'anywhere',
                                                whiteSpace: 'pre-wrap',
                                            }}
                                        >
                                            {rule.value}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </ConsolePanel>
            <ConsolePanel title="Activity log" eyebrow="IPEX">
                {activity.length === 0 ? (
                    <EmptyState
                        title="No credential activity"
                        message="Grant and admit exchange activity will appear here when available."
                    />
                ) : (
                    <List disablePadding>
                        {activity.map((entry) => (
                            <ListItem
                                key={entry.id}
                                disableGutters
                                sx={{
                                    alignItems: 'flex-start',
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    py: 1.25,
                                    '&:last-child': {
                                        borderBottom: 0,
                                    },
                                }}
                            >
                                <ListItemText
                                    primary={
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1}
                                            sx={{
                                                alignItems: {
                                                    xs: 'flex-start',
                                                    sm: 'center',
                                                },
                                                justifyContent: 'space-between',
                                                gap: 1,
                                            }}
                                        >
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{
                                                    alignItems: 'center',
                                                    flexWrap: 'wrap',
                                                }}
                                            >
                                                <Typography component="span">
                                                    {entry.title}
                                                </Typography>
                                                <CredentialActivityPill
                                                    entry={entry}
                                                />
                                            </Stack>
                                            <Typography
                                                variant="caption"
                                                color="text.secondary"
                                            >
                                                {timestampText(entry.timestamp)}
                                            </Typography>
                                        </Stack>
                                    }
                                    secondary={
                                        <Stack spacing={0.5} sx={{ mt: 0.75 }}>
                                            <TelemetryRow
                                                label="Exchange SAID"
                                                value={<FullMonoValue value={entry.said} />}
                                            />
                                            <TelemetryRow
                                                label="Sender"
                                                value={
                                                    <FullAidValue
                                                        aid={entry.primaryAid}
                                                        aliases={aidAliases}
                                                    />
                                                }
                                            />
                                            <TelemetryRow
                                                label="Recipient"
                                                value={
                                                    <FullAidValue
                                                        aid={entry.secondaryAid}
                                                        aliases={aidAliases}
                                                    />
                                                }
                                            />
                                        </Stack>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </ConsolePanel>
        </Box>
    );
};

/**
 * Route view that summarizes session health, activity, and credential inventory.
 */
export const DashboardView = () => {
    const loaderData = useLoaderData() as DashboardLoaderData;
    const location = useLocation();
    const navigate = useNavigate();
    const { credentialSaid = '' } = useParams();
    const resolvedSchemas = useAppSelector(selectResolvedCredentialSchemas);
    const issuedCredentials = useAppSelector(selectIssuedCredentials);
    const heldCredentials = useAppSelector(selectHeldCredentials);
    const grantNotifications = useAppSelector(selectCredentialGrantNotifications);
    const selectedCredentialExchangeActivities = useAppSelector(
        selectCredentialIpexActivity(credentialSaid)
    );
    const registries = useAppSelector(selectCredentialRegistries);
    const contacts = useAppSelector(selectContacts);
    const identifiers = useAppSelector(selectIdentifiers);
    const registriesById = useMemo(() => {
        const byId = new Map<string, RegistryRecord>();
        for (const registry of registries) {
            byId.set(registry.id, registry);
            if (registry.regk.length > 0) {
                byId.set(registry.regk, registry);
            }
        }
        return byId;
    }, [registries]);
    const aidAliases = useMemo(() => {
        const aliases = new Map<string, string>();
        for (const contact of contacts) {
            if (contact.aid !== null) {
                aliases.set(contact.aid, contact.alias);
            }
        }
        for (const identifier of identifiers) {
            aliases.set(identifier.prefix, identifier.name);
        }
        return aliases;
    }, [contacts, identifiers]);
    const credentials = useMemo(
        () => [...issuedCredentials, ...heldCredentials],
        [issuedCredentials, heldCredentials]
    );
    const selectedCredential = useMemo(
        () =>
            credentials.find(
                (credential) => credential.said === credentialSaid
            ) ?? null,
        [credentialSaid, credentials]
    );
    const selectedCredentialSchema = useMemo(
        () =>
            selectedCredential?.schemaSaid === null ||
            selectedCredential?.schemaSaid === undefined
                ? null
                : (resolvedSchemas.find(
                      (schema) => schema.said === selectedCredential.schemaSaid
                  ) ?? null),
        [resolvedSchemas, selectedCredential]
    );
    const selectedCredentialActivity = useMemo(
        () =>
            selectedCredential === null
                ? []
                : buildCredentialActivity({
                      credential: selectedCredential,
                      grantNotifications,
                      exchangeActivities: selectedCredentialExchangeActivities,
                  }),
        [
            grantNotifications,
            selectedCredential,
            selectedCredentialExchangeActivities,
        ]
    );
    const openCredential = (said: string) => {
        navigate(credentialDetailPath(said));
    };

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const mode = dashboardModeForPath(location.pathname);

    if (mode === 'schemas') {
        return (
            <ResolvedSchemasDetail
                loaderData={loaderData}
                schemas={resolvedSchemas}
            />
        );
    }

    if (mode === 'issuedCredentials') {
        return (
            <CredentialsDetail
                loaderData={loaderData}
                credentials={issuedCredentials}
                aidAliases={aidAliases}
                kind="issued"
                onOpenCredential={openCredential}
            />
        );
    }

    if (mode === 'heldCredentials') {
        return (
            <CredentialsDetail
                loaderData={loaderData}
                credentials={heldCredentials}
                aidAliases={aidAliases}
                kind="held"
                onOpenCredential={openCredential}
            />
        );
    }

    if (mode === 'credentialDetail') {
        return (
            <CredentialRecordDetail
                loaderData={loaderData}
                credential={selectedCredential}
                schema={selectedCredentialSchema}
                registriesById={registriesById}
                aidAliases={aidAliases}
                activity={selectedCredentialActivity}
            />
        );
    }

    return <DashboardOverview loaderData={loaderData} />;
};
