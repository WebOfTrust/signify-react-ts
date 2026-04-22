import {
    Box,
    Divider,
    List,
    ListItem,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material';
import { Link as RouterLink, useLoaderData } from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import {
    ConsolePanel,
    EmptyState,
    PageHeader,
    StatusPill,
    TelemetryRow,
} from '../../app/Console';
import { monoValueSx } from '../../app/consoleStyles';
import { clickablePanelSx } from '../../app/consoleStyles';
import { useAppSession } from '../../app/runtimeHooks';
import { formatTimestamp } from '../../app/timeFormat';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { DashboardLoaderData } from '../../app/routeData';
import { useAppSelector } from '../../state/hooks';
import {
    selectDashboardCounts,
    selectKnownComponentsByRole,
    selectRecentAppNotifications,
    selectRecentChallenges,
    selectRecentKeriaNotifications,
    selectRecentOperations,
    selectSession,
} from '../../state/selectors';

const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

const CountTile = ({
    label,
    value,
    to,
}: {
    label: string;
    value: number;
    to: string;
}) => (
    <Box
        component={RouterLink}
        to={to}
        aria-label={`Open ${label}`}
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

/**
 * Route view that summarizes session health, activity, and known components.
 */
export const DashboardView = () => {
    const loaderData = useLoaderData() as DashboardLoaderData;
    const runtimeSnapshot = useAppSession();
    const session = useAppSelector(selectSession);
    const counts = useAppSelector(selectDashboardCounts);
    const recentOperations = useAppSelector(selectRecentOperations(5));
    const recentKeriaNotifications = useAppSelector(
        selectRecentKeriaNotifications(5)
    );
    const recentAppNotifications = useAppSelector(selectRecentAppNotifications(5));
    const recentChallenges = useAppSelector(selectRecentChallenges(5));
    const componentGroups = Array.from(
        useAppSelector(selectKnownComponentsByRole).entries()
    ).sort(([left], [right]) => left.localeCompare(right));
    const connection = runtimeSnapshot.connection;

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const keriaTarget =
        connection.status === 'connected' ? connection.client.url : 'Disconnected';

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Session"
                title="Dashboard"
                summary="Live agent inventory, operation status, and protocol activity for the connected KERIA session."
            />
            {loaderData.status === 'error' && (
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
                        {loaderData.message}
                    </Typography>
                </Box>
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
                />
                <CountTile
                    label="Contacts"
                    value={counts.contacts}
                    to="/contacts"
                />
                <CountTile
                    label="Known components"
                    value={counts.knownComponents}
                    to="/contacts"
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
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                    gap: 2,
                }}
            >
                <ConsolePanel
                    title="Agent information"
                    eyebrow="KERIA"
                    to="/client"
                >
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
                <ConsolePanel
                    title="Known components"
                    eyebrow="Contacts"
                    sx={{ minWidth: 0 }}
                    to="/contacts"
                >
                    <Box data-testid="known-components">
                        {componentGroups.length === 0 ? (
                            <EmptyState
                                title="No known components"
                                message="Resolved OOBIs with endpoint roles will populate this inventory."
                            />
                        ) : (
                            <Stack spacing={1.5}>
                                {componentGroups.map(([role, components]) => (
                                    <Box key={role}>
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            sx={{
                                                alignItems: 'center',
                                                flexWrap: 'wrap',
                                                mb: 0.75,
                                            }}
                                        >
                                            <Typography variant="subtitle2">
                                                {role}
                                            </Typography>
                                            <StatusPill
                                                label={components.length.toString()}
                                                tone="info"
                                            />
                                        </Stack>
                                        <List disablePadding>
                                            {components.slice(0, 6).map(
                                                (component) => (
                                                    <ListItem
                                                        key={component.id}
                                                        disableGutters
                                                        sx={{
                                                            py: 0.5,
                                                            alignItems:
                                                                'flex-start',
                                                        }}
                                                    >
                                                        <ListItemText
                                                            primary={
                                                                component.alias
                                                            }
                                                            secondary={
                                                                <Typography
                                                                    variant="body2"
                                                                    color="text.secondary"
                                                                    sx={
                                                                        monoValueSx
                                                                    }
                                                                >
                                                                    {component.url ??
                                                                        component.eid ??
                                                                        component.contactId}
                                                                </Typography>
                                                            }
                                                        />
                                                    </ListItem>
                                                )
                                            )}
                                        </List>
                                        <Divider sx={{ mt: 1 }} />
                                    </Box>
                                ))}
                            </Stack>
                        )}
                    </Box>
                </ConsolePanel>
            </Box>
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
