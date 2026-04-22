import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
    AppBar,
    Badge,
    Box,
    Button,
    CircularProgress,
    Divider,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Popover,
    Stack,
    Toolbar,
    Tooltip,
    Typography,
} from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { Link as RouterLink, useFetcher } from 'react-router-dom';
import { StatusPill } from './Console';
import { PayloadDetails } from './PayloadDetails';
import { formatOperationWindow, formatTimestamp } from './timeFormat';
import type { ContactActionData } from './routeData';
import type { AppNotificationRecord } from '../state/appNotifications.slice';
import type { ChallengeRequestNotification } from '../state/notifications.slice';
import type { OperationRecord } from '../state/operations.slice';
import type { IdentifierSummary } from '../features/identifiers/identifierTypes';
import { allAppNotificationsRead } from '../state/appNotifications.slice';
import { useAppDispatch } from '../state/hooks';
import { ChallengeRequestResponseForm } from '../features/notifications/ChallengeRequestResponseForm';
import { abbreviateMiddle } from '../features/contacts/contactHelpers';

const APP_NOTIFICATION_READ_DELAY_MS = 1250;

/**
 * Props for the fixed app bar.
 */
export interface TopBarProps {
    /** True when the shared app runtime has a connected Signify client. */
    isConnected: boolean;
    /** Currently running background operations. */
    activeOperations: readonly OperationRecord[];
    /** Recent app notifications for the bell popover. */
    recentNotifications: readonly AppNotificationRecord[];
    /** Actionable challenge requests discovered from KERIA notifications. */
    challengeRequests: readonly ChallengeRequestNotification[];
    /** Local identifiers available for responding to challenge requests. */
    identifiers: readonly IdentifierSummary[];
    /** Number of unread app notifications plus actionable challenge requests. */
    unreadNotificationCount: number;
    /** Open the route navigation drawer. */
    onMenuClick: () => void;
    /** Open the KERIA connection dialog. */
    onConnectClick: () => void;
}

/**
 * Fixed application bar with menu and connect affordances.
 *
 * It renders only shell controls and connection indication; it does not know
 * about routes or Signify clients. Keep the `nav-open` and `connect-open`
 * selectors stable for browser smoke.
 */
export const TopBar = ({
    isConnected,
    activeOperations,
    recentNotifications,
    challengeRequests,
    identifiers,
    unreadNotificationCount,
    onMenuClick,
    onConnectClick,
}: TopBarProps) => {
    const [operationsAnchor, setOperationsAnchor] =
        useState<HTMLElement | null>(null);
    const [notificationsAnchor, setNotificationsAnchor] =
        useState<HTMLElement | null>(null);
    const dismissFetcher = useFetcher<ContactActionData>();
    const dispatch = useAppDispatch();
    const operationsOpen = operationsAnchor !== null;
    const notificationsOpen = notificationsAnchor !== null;
    const visibleNotifications = useMemo(
        () => recentNotifications.slice(0, 5),
        [recentNotifications]
    );
    const visibleChallengeRequests = useMemo(
        () => challengeRequests.slice(0, 3),
        [challengeRequests]
    );

    useEffect(() => {
        if (!notificationsOpen || unreadNotificationCount === 0) {
            return undefined;
        }

        const timeout = globalThis.setTimeout(() => {
            dispatch(allAppNotificationsRead());
        }, APP_NOTIFICATION_READ_DELAY_MS);

        return () => {
            globalThis.clearTimeout(timeout);
        };
    }, [dispatch, notificationsOpen, unreadNotificationCount]);

    const openOperations = (event: MouseEvent<HTMLElement>) => {
        setOperationsAnchor(event.currentTarget);
    };

    const openNotifications = (event: MouseEvent<HTMLElement>) => {
        setNotificationsAnchor(event.currentTarget);
    };

    const dismissChallengeRequest = (request: ChallengeRequestNotification) => {
        const formData = new FormData();
        formData.set('intent', 'dismissExchangeNotification');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', request.notificationId);
        formData.set('exnSaid', request.exnSaid);
        formData.set('route', '/challenge/request');
        dismissFetcher.submit(formData, {
            method: 'post',
            action: '/notifications',
        });
    };

    return (
        <AppBar position="fixed" sx={{ width: '100%' }}>
            <Toolbar
                sx={{
                    display: 'flex',
                    gap: { xs: 0.5, sm: 1.5 },
                    minWidth: 0,
                    minHeight: { xs: 56, sm: 64 },
                }}
            >
                <IconButton
                    edge="start"
                    color="inherit"
                    aria-label="menu"
                    data-testid="nav-open"
                    onClick={onMenuClick}
                    sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                >
                    <MenuIcon />
                </IconButton>
                <Typography
                    variant="h6"
                    noWrap
                    sx={{
                        flex: '1 1 auto',
                        minWidth: 0,
                        color: 'text.primary',
                        fontWeight: 700,
                    }}
                >
                    Signify Ops
                </Typography>
                <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                    <StatusPill
                        label={isConnected ? 'KERIA online' : 'KERIA offline'}
                        tone={isConnected ? 'success' : 'error'}
                    />
                </Box>
                <Tooltip title="Background operations">
                    <IconButton
                        color="inherit"
                        aria-label="Background operations"
                        data-testid="operations-indicator"
                        onClick={openOperations}
                    >
                        <Badge
                            color="primary"
                            badgeContent={activeOperations.length}
                            invisible={activeOperations.length === 0}
                        >
                            {activeOperations.length > 0 ? (
                                <CircularProgress
                                    size={22}
                                    color="inherit"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Box
                                    component="span"
                                    sx={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 1,
                                        border: 2,
                                        borderColor: 'currentColor',
                                        display: 'block',
                                    }}
                                />
                            )}
                        </Badge>
                    </IconButton>
                </Tooltip>
                <Tooltip title="Notifications">
                    <IconButton
                        color="inherit"
                        aria-label="Notifications"
                        data-testid="notifications-open"
                        onClick={openNotifications}
                    >
                        <Badge
                            color="error"
                            badgeContent={unreadNotificationCount}
                            invisible={unreadNotificationCount === 0}
                        >
                            <NotificationsIcon />
                        </Badge>
                    </IconButton>
                </Tooltip>
                <Button
                    variant={isConnected ? 'outlined' : 'contained'}
                    color={isConnected ? 'success' : 'primary'}
                    aria-label={isConnected ? 'Connected' : 'Connect'}
                    sx={{
                        flex: '0 0 auto',
                        minWidth: { xs: 44, sm: 92 },
                        px: { xs: 1, sm: 2 },
                        gap: 0.75,
                        borderColor: isConnected ? 'success.main' : undefined,
                    }}
                    onClick={onConnectClick}
                    data-testid="connect-open"
                >
                    <CircleIcon
                        sx={{
                            fontSize: 14,
                            color: isConnected ? 'success.main' : 'error.main',
                        }}
                    />
                    <Typography
                        component="span"
                        sx={{ display: { xs: 'none', sm: 'inline' } }}
                    >
                        {isConnected ? 'Online' : 'Connect'}
                    </Typography>
                </Button>
            </Toolbar>
            <Popover
                open={operationsOpen}
                anchorEl={operationsAnchor}
                onClose={() => setOperationsAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <List sx={{ width: 340, maxWidth: '90vw', p: 1 }}>
                    {activeOperations.length === 0 ? (
                        <ListItemText
                            sx={{ px: 2, py: 1 }}
                            primary="No active operations"
                        />
                    ) : (
                        activeOperations.map((operation) => (
                            <ListItemButton
                                key={operation.requestId}
                                component={RouterLink}
                                to={operation.operationRoute}
                                onClick={() => setOperationsAnchor(null)}
                                sx={{
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    mb: 0.75,
                                }}
                            >
                                <ListItemText
                                    primary={operation.title}
                                    secondary={
                                        <Box>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                {operation.phase}
                                            </Typography>
                                            {formatOperationWindow(
                                                operation
                                            ) !== null && (
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    {formatOperationWindow(
                                                        operation
                                                    )}
                                                </Typography>
                                            )}
                                        </Box>
                                    }
                                />
                            </ListItemButton>
                        ))
                    )}
                    <ListItemButton
                        component={RouterLink}
                        to="/operations"
                        onClick={() => setOperationsAnchor(null)}
                        sx={{ borderRadius: 1 }}
                    >
                        <ListItemText primary="Activity console" />
                    </ListItemButton>
                </List>
            </Popover>
            <Popover
                open={notificationsOpen}
                anchorEl={notificationsAnchor}
                onClose={() => setNotificationsAnchor(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
                <List sx={{ width: 360, maxWidth: '90vw', p: 1 }}>
                    {recentNotifications.length === 0 &&
                    visibleChallengeRequests.length === 0 ? (
                        <ListItemText
                            sx={{ px: 2, py: 1 }}
                            primary="No notifications"
                        />
                    ) : (
                        <>
                            {visibleChallengeRequests.map((request) => (
                                <Box
                                    key={request.notificationId}
                                    data-testid="challenge-notification-card"
                                    sx={{
                                        border: 1,
                                        borderColor: 'primary.main',
                                        borderRadius: 1,
                                        bgcolor: 'action.selected',
                                        p: 1.25,
                                        mb: 0.75,
                                    }}
                                >
                                    <Stack spacing={1}>
                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            sx={{
                                                alignItems: 'flex-start',
                                                justifyContent: 'space-between',
                                                gap: 1,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    minWidth: 0,
                                                    flex: '1 1 auto',
                                                }}
                                            >
                                                <Typography
                                                    variant="subtitle2"
                                                    noWrap
                                                >
                                                    Challenge request
                                                </Typography>
                                                <Typography
                                                    component="div"
                                                    variant="caption"
                                                    color="text.secondary"
                                                    noWrap
                                                    data-testid="challenge-notification-from"
                                                    sx={{
                                                        display: 'block',
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    From {request.senderAlias} (
                                                    {abbreviateMiddle(
                                                        request.senderAid,
                                                        28
                                                    )}
                                                    )
                                                </Typography>
                                                {formatTimestamp(
                                                    request.createdAt
                                                ) !== null && (
                                                    <Typography
                                                        component="div"
                                                        variant="caption"
                                                        color="text.secondary"
                                                        noWrap
                                                        sx={{
                                                            display: 'block',
                                                            mt: 0.25,
                                                        }}
                                                    >
                                                        {formatTimestamp(
                                                            request.createdAt
                                                        )}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Stack
                                                direction="row"
                                                spacing={0.5}
                                                sx={{
                                                    alignItems: 'center',
                                                    flex: '0 0 auto',
                                                }}
                                            >
                                                <Button
                                                    component={RouterLink}
                                                    to={`/notifications/${encodeURIComponent(
                                                        request.notificationId
                                                    )}`}
                                                    size="small"
                                                    data-testid="challenge-notification-detail-link"
                                                    onClick={() =>
                                                        setNotificationsAnchor(
                                                            null
                                                        )
                                                    }
                                                >
                                                    Open
                                                </Button>
                                                <Tooltip title="Dismiss challenge request">
                                                    <span>
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            aria-label="dismiss challenge request"
                                                            data-testid="challenge-notification-dismiss"
                                                            disabled={
                                                                dismissFetcher.state !==
                                                                'idle'
                                                            }
                                                            onClick={() =>
                                                                dismissChallengeRequest(
                                                                    request
                                                                )
                                                            }
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </span>
                                                </Tooltip>
                                            </Stack>
                                        </Stack>
                                        <ChallengeRequestResponseForm
                                            request={request}
                                            identifiers={identifiers}
                                            action="/notifications"
                                            dense
                                        />
                                    </Stack>
                                </Box>
                            ))}
                            {visibleChallengeRequests.length > 0 &&
                                visibleNotifications.length > 0 && (
                                    <Divider sx={{ my: 0.75 }} />
                                )}
                            {visibleNotifications.map((notification) => (
                                <ListItemButton
                                    key={notification.id}
                                    data-testid="notification-quick-item"
                                    component={RouterLink}
                                    to={
                                        notification.links[0]?.path ??
                                        '/notifications'
                                    }
                                    onClick={() => setNotificationsAnchor(null)}
                                    sx={{
                                        bgcolor:
                                            notification.status === 'unread'
                                                ? 'action.selected'
                                                : 'action.hover',
                                        color: 'text.primary',
                                        border: 1,
                                        borderColor:
                                            notification.status === 'unread'
                                                ? 'primary.main'
                                                : 'divider',
                                        borderRadius: 1,
                                        mb: 0.75,
                                    }}
                                >
                                    <ListItemText
                                        primary={notification.title}
                                        secondary={
                                            <Box>
                                                {formatTimestamp(
                                                    notification.createdAt
                                                ) !== null && (
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        Created{' '}
                                                        {formatTimestamp(
                                                            notification.createdAt
                                                        )}
                                                    </Typography>
                                                )}
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {notification.message}
                                                </Typography>
                                                <PayloadDetails
                                                    details={
                                                        notification.payloadDetails
                                                    }
                                                    dense
                                                />
                                            </Box>
                                        }
                                    />
                                </ListItemButton>
                            ))}
                        </>
                    )}
                    <ListItemButton
                        component={RouterLink}
                        to="/notifications"
                        onClick={() => setNotificationsAnchor(null)}
                        sx={{ borderRadius: 1 }}
                    >
                        <ListItemText primary="All notifications" />
                    </ListItemButton>
                </List>
            </Popover>
        </AppBar>
    );
};
