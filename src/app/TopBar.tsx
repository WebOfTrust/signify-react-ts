import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import {
    AppBar,
    Badge,
    Box,
    Button,
    CircularProgress,
    Divider,
    FormControl,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    Popover,
    Select,
    Stack,
    Toolbar,
    Tooltip,
    Typography,
} from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import DeleteIcon from '@mui/icons-material/Delete';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import {
    Link as RouterLink,
    useFetcher,
    useLocation,
    useNavigate,
} from 'react-router-dom';
import { StatusPill } from './Console';
import { PayloadDetails } from './PayloadDetails';
import { formatOperationWindow, formatTimestamp } from './timeFormat';
import { UI_SOUND_HOVER_VALUE } from './uiSound';
import type { ContactActionData, CredentialActionData } from './routeData';
import type { AppNotificationRecord } from '../state/appNotifications.slice';
import type {
    ChallengeRequestNotification,
    CredentialGrantNotification,
    DelegationRequestNotification,
} from '../state/notifications.slice';
import type { OperationRecord } from '../state/operations.slice';
import type { IdentifierSummary } from '../features/identifiers/identifierTypes';
import { allAppNotificationsRead } from '../state/appNotifications.slice';
import { hoverSoundMutedToggled } from '../state/uiPreferences.slice';
import {
    walletAidCleared,
    walletAidSelected,
    walletRegistryCleared,
    walletRegistrySelected,
} from '../state/walletSelection.slice';
import { useAppDispatch, useAppSelector } from '../state/hooks';
import {
    selectHoverSoundMuted,
    selectReadyCredentialRegistriesForSelectedAid,
    selectSelectedWalletIdentifier,
    selectSelectedWalletRegistry,
} from '../state/selectors';
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
    /** Actionable credential grants discovered from KERIA notifications. */
    credentialGrants: readonly CredentialGrantNotification[];
    /** Actionable delegation requests discovered from KERIA notifications. */
    delegationRequests: readonly DelegationRequestNotification[];
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
    credentialGrants,
    delegationRequests,
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
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();
    const hoverSoundMuted = useAppSelector(selectHoverSoundMuted);
    const selectedIdentifier = useAppSelector(selectSelectedWalletIdentifier);
    const readyRegistries = useAppSelector(
        selectReadyCredentialRegistriesForSelectedAid
    );
    const selectedRegistry = useAppSelector(selectSelectedWalletRegistry);
    const operationsOpen = operationsAnchor !== null;
    const notificationsOpen = notificationsAnchor !== null;
    const visibleNotifications = useMemo(
        () => recentNotifications.slice(0, 5),
        [recentNotifications]
    );
    const credentialFetcher = useFetcher<CredentialActionData>();
    const delegationFetcher = useFetcher<ContactActionData>();
    const visibleChallengeRequests = useMemo(
        () => challengeRequests.slice(0, 3),
        [challengeRequests]
    );
    const visibleCredentialGrants = useMemo(
        () => credentialGrants.slice(0, 3),
        [credentialGrants]
    );
    const visibleDelegationRequests = useMemo(
        () => delegationRequests.slice(0, 3),
        [delegationRequests]
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

    const toggleHoverSoundMuted = () => {
        dispatch(hoverSoundMutedToggled());
    };

    const navigateCredentialSelection = (aid: string | null) => {
        if (!location.pathname.startsWith('/credentials')) {
            return;
        }

        navigate(
            aid === null
                ? '/credentials'
                : `/credentials/${encodeURIComponent(aid)}`
        );
    };

    const handleSelectedAidChange = (value: string) => {
        if (value.length === 0) {
            dispatch(walletAidCleared());
            navigateCredentialSelection(null);
            return;
        }

        dispatch(walletAidSelected({ aid: value }));
        navigateCredentialSelection(value);
    };

    const handleSelectedRegistryChange = (value: string) => {
        if (value.length === 0) {
            dispatch(walletRegistryCleared());
            return;
        }

        dispatch(walletRegistrySelected({ registryId: value }));
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

    const admitCredentialGrant = (grant: CredentialGrantNotification) => {
        const recipient = identifiers.find(
            (identifier) => identifier.prefix === grant.holderAid
        );
        if (recipient === undefined) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'admitCredentialGrant');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('holderAlias', recipient.name);
        formData.set('holderAid', grant.holderAid);
        formData.set('notificationId', grant.notificationId);
        formData.set('grantSaid', grant.grantSaid);
        credentialFetcher.submit(formData, {
            method: 'post',
            action: '/credentials',
        });
        setNotificationsAnchor(null);
    };

    const approveDelegationRequest = (
        request: DelegationRequestNotification
    ) => {
        const delegator = identifiers.find(
            (identifier) => identifier.prefix === request.delegatorAid
        );
        if (delegator === undefined) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'approveDelegationRequest');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', request.notificationId);
        formData.set('delegatorName', delegator.name);
        formData.set('delegatorAid', request.delegatorAid);
        formData.set('delegateAid', request.delegateAid);
        formData.set('delegateEventSaid', request.delegateEventSaid);
        formData.set('sequence', request.sequence);
        formData.set('sourceAid', request.sourceAid ?? '');
        formData.set('createdAt', request.createdAt);
        delegationFetcher.submit(formData, {
            method: 'post',
            action: '/notifications',
        });
        setNotificationsAnchor(null);
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
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                    onClick={onMenuClick}
                    sx={{ display: { xs: 'inline-flex', md: 'none' } }}
                >
                    <MenuIcon />
                </IconButton>
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        flex: '1 1 auto',
                        minWidth: 0,
                        alignItems: 'center',
                    }}
                >
                    <Typography
                        variant="h6"
                        noWrap
                        sx={{
                            flex: '0 0 auto',
                            color: 'text.primary',
                            fontWeight: 700,
                        }}
                    >
                        Signify Ops
                    </Typography>
                    {selectedIdentifier !== null && (
                        <FormControl
                            size="small"
                            sx={{
                                display: { xs: 'none', sm: 'block' },
                                minWidth: { sm: 146, lg: 190 },
                                maxWidth: { sm: 170, lg: 230 },
                                flex: '0 1 auto',
                            }}
                        >
                            <Select
                                aria-label="Selected wallet AID"
                                value={selectedIdentifier.prefix}
                                onChange={(event) =>
                                    handleSelectedAidChange(event.target.value)
                                }
                                renderValue={(value) => {
                                    const identifier =
                                        identifiers.find(
                                            (candidate) =>
                                                candidate.prefix === value
                                        ) ?? selectedIdentifier;
                                    return `${identifier.name} / ${abbreviateMiddle(
                                        identifier.prefix,
                                        12
                                    )}`;
                                }}
                                data-testid="topbar-selected-aid"
                                sx={{
                                    height: 32,
                                    fontSize: '0.78rem',
                                    bgcolor: 'rgba(13, 23, 34, 0.72)',
                                    '.MuiSelect-select': {
                                        py: 0.5,
                                        pr: 3,
                                        minWidth: 0,
                                    },
                                }}
                            >
                                <MenuItem value="">
                                    <em>Clear AID</em>
                                </MenuItem>
                                {identifiers.map((identifier) => (
                                    <MenuItem
                                        key={identifier.prefix}
                                        value={identifier.prefix}
                                    >
                                        {identifier.name} /{' '}
                                        {abbreviateMiddle(
                                            identifier.prefix,
                                            18
                                        )}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                    {selectedRegistry !== null && (
                        <FormControl
                            size="small"
                            sx={{
                                display: { xs: 'none', lg: 'block' },
                                minWidth: 168,
                                maxWidth: 230,
                                flex: '0 1 auto',
                            }}
                        >
                            <Select
                                aria-label="Selected credential registry"
                                value={selectedRegistry.id}
                                onChange={(event) =>
                                    handleSelectedRegistryChange(
                                        event.target.value
                                    )
                                }
                                renderValue={(value) => {
                                    const registry =
                                        readyRegistries.find(
                                            (candidate) =>
                                                candidate.id === value
                                        ) ?? selectedRegistry;
                                    return `Registry: ${registry.registryName}`;
                                }}
                                data-testid="topbar-selected-registry"
                                sx={{
                                    height: 32,
                                    fontSize: '0.78rem',
                                    bgcolor: 'rgba(13, 23, 34, 0.72)',
                                    '.MuiSelect-select': {
                                        py: 0.5,
                                        pr: 3,
                                        minWidth: 0,
                                    },
                                }}
                            >
                                <MenuItem value="">
                                    <em>Clear registry</em>
                                </MenuItem>
                                {readyRegistries.map((registry) => (
                                    <MenuItem
                                        key={registry.id}
                                        value={registry.id}
                                    >
                                        {registry.registryName} /{' '}
                                        {abbreviateMiddle(registry.regk, 18)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                </Stack>
                <Box sx={{ display: { xs: 'none', lg: 'block' } }}>
                    <StatusPill
                        label={isConnected ? 'KERIA online' : 'KERIA offline'}
                        tone={isConnected ? 'success' : 'error'}
                    />
                </Box>
                <Tooltip
                    title={
                        hoverSoundMuted
                            ? 'Enable interface sounds'
                            : 'Mute interface sounds'
                    }
                >
                    <IconButton
                        color="inherit"
                        aria-label={
                            hoverSoundMuted
                                ? 'Enable interface sounds'
                                : 'Mute interface sounds'
                        }
                        aria-pressed={hoverSoundMuted}
                        data-testid="ui-sound-toggle"
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                        onClick={toggleHoverSoundMuted}
                    >
                        {hoverSoundMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                    </IconButton>
                </Tooltip>
                <Tooltip title="Background operations">
                    <IconButton
                        color="inherit"
                        aria-label="Background operations"
                        data-testid="operations-indicator"
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
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
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
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
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
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
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
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
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
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
                    visibleChallengeRequests.length === 0 &&
                    visibleCredentialGrants.length === 0 &&
                    visibleDelegationRequests.length === 0 ? (
                        <ListItemText
                            sx={{ px: 2, py: 1 }}
                            primary="No notifications"
                        />
                    ) : (
                        <>
                            {visibleDelegationRequests.map((request) => {
                                const delegator = identifiers.find(
                                    (identifier) =>
                                        identifier.prefix ===
                                        request.delegatorAid
                                );
                                const canApprove =
                                    delegator !== undefined &&
                                    delegationFetcher.state === 'idle';

                                return (
                                    <Box
                                        key={request.notificationId}
                                        data-testid="delegation-request-notification-card"
                                        sx={{
                                            border: 1,
                                            borderColor: 'primary.main',
                                            borderRadius: 1,
                                            bgcolor: 'action.selected',
                                            p: 1.25,
                                            mb: 0.75,
                                        }}
                                    >
                                        <Stack
                                            direction={{
                                                xs: 'column',
                                                sm: 'row',
                                            }}
                                            spacing={1}
                                            sx={{
                                                alignItems: {
                                                    xs: 'stretch',
                                                    sm: 'flex-start',
                                                },
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
                                                    Delegation request
                                                </Typography>
                                                <Typography
                                                    component="div"
                                                    variant="caption"
                                                    color="text.secondary"
                                                    noWrap
                                                    data-testid="delegation-request-delegator"
                                                    sx={{ display: 'block' }}
                                                >
                                                    Delegator{' '}
                                                    {delegator === undefined
                                                        ? abbreviateMiddle(
                                                              request.delegatorAid,
                                                              28
                                                          )
                                                        : `${delegator.name} / ${abbreviateMiddle(
                                                              request.delegatorAid,
                                                              18
                                                          )}`}
                                                </Typography>
                                                <Typography
                                                    component="div"
                                                    variant="caption"
                                                    color="text.secondary"
                                                    noWrap
                                                    data-testid="delegation-request-delegate"
                                                    sx={{
                                                        display: 'block',
                                                        mt: 0.25,
                                                    }}
                                                >
                                                    Delegate{' '}
                                                    {abbreviateMiddle(
                                                        request.delegateAid,
                                                        28
                                                    )}
                                                </Typography>
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
                                                    Event{' '}
                                                    {abbreviateMiddle(
                                                        request.delegateEventSaid,
                                                        28
                                                    )}{' '}
                                                    seq {request.sequence}
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
                                                spacing={0.75}
                                                sx={{
                                                    flex: '0 0 auto',
                                                    alignItems: 'center',
                                                    justifyContent: {
                                                        xs: 'flex-start',
                                                        sm: 'flex-end',
                                                    },
                                                }}
                                            >
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    startIcon={<HowToRegIcon />}
                                                    data-testid="delegation-request-notification-approve"
                                                    data-ui-sound={
                                                        UI_SOUND_HOVER_VALUE
                                                    }
                                                    disabled={!canApprove}
                                                    onClick={() =>
                                                        approveDelegationRequest(
                                                            request
                                                        )
                                                    }
                                                >
                                                    Approve
                                                </Button>
                                                <Button
                                                    component={RouterLink}
                                                    to={`/notifications/${encodeURIComponent(
                                                        request.notificationId
                                                    )}`}
                                                    size="small"
                                                    data-testid="delegation-request-notification-detail-link"
                                                    data-ui-sound={
                                                        UI_SOUND_HOVER_VALUE
                                                    }
                                                    onClick={() =>
                                                        setNotificationsAnchor(
                                                            null
                                                        )
                                                    }
                                                >
                                                    Open
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Box>
                                );
                            })}
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
                                                    data-ui-sound={
                                                        UI_SOUND_HOVER_VALUE
                                                    }
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
                                                            data-ui-sound={
                                                                UI_SOUND_HOVER_VALUE
                                                            }
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
                            {visibleCredentialGrants.map((grant) => {
                                const recipient = identifiers.find(
                                    (identifier) =>
                                        identifier.prefix === grant.holderAid
                                );
                                const recipientLabel =
                                    recipient === undefined
                                        ? abbreviateMiddle(grant.holderAid, 28)
                                        : `${recipient.name} / ${abbreviateMiddle(
                                              grant.holderAid,
                                              20
                                          )}`;
                                const canAdmit =
                                    recipient !== undefined &&
                                    credentialFetcher.state === 'idle';

                                return (
                                    <Box
                                        key={grant.notificationId}
                                        data-testid="credential-grant-notification-card"
                                        sx={{
                                            border: 1,
                                            borderColor: 'primary.main',
                                            borderRadius: 1,
                                            bgcolor: 'action.selected',
                                            p: 1.25,
                                            mb: 0.75,
                                        }}
                                    >
                                        <Stack
                                            direction={{
                                                xs: 'column',
                                                sm: 'row',
                                            }}
                                            spacing={1}
                                            sx={{
                                                alignItems: {
                                                    xs: 'stretch',
                                                    sm: 'flex-start',
                                                },
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
                                                    Credential grant
                                                </Typography>
                                                <Typography
                                                    component="div"
                                                    variant="caption"
                                                    color="text.secondary"
                                                    noWrap
                                                    data-testid="credential-grant-notification-from"
                                                    sx={{
                                                        display: 'block',
                                                        minWidth: 0,
                                                    }}
                                                >
                                                    From{' '}
                                                    {abbreviateMiddle(
                                                        grant.issuerAid,
                                                        28
                                                    )}
                                                </Typography>
                                                <Typography
                                                    component="div"
                                                    variant="caption"
                                                    color="text.secondary"
                                                    noWrap
                                                    data-testid="credential-grant-notification-recipient"
                                                    sx={{
                                                        display: 'block',
                                                        mt: 0.25,
                                                    }}
                                                >
                                                    Recipient {recipientLabel}
                                                </Typography>
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
                                                    Credential{' '}
                                                    {abbreviateMiddle(
                                                        grant.credentialSaid,
                                                        28
                                                    )}
                                                </Typography>
                                                {formatTimestamp(
                                                    grant.createdAt
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
                                                            grant.createdAt
                                                        )}
                                                    </Typography>
                                                )}
                                            </Box>
                                            <Stack
                                                direction="row"
                                                spacing={0.75}
                                                sx={{
                                                    flex: '0 0 auto',
                                                    alignItems: 'center',
                                                    justifyContent: {
                                                        xs: 'flex-start',
                                                        sm: 'flex-end',
                                                    },
                                                }}
                                            >
                                                <Button
                                                    size="small"
                                                    variant="contained"
                                                    startIcon={<HowToRegIcon />}
                                                    data-testid="credential-grant-notification-admit"
                                                    data-ui-sound={
                                                        UI_SOUND_HOVER_VALUE
                                                    }
                                                    disabled={!canAdmit}
                                                    onClick={() =>
                                                        admitCredentialGrant(
                                                            grant
                                                        )
                                                    }
                                                >
                                                    Admit
                                                </Button>
                                                <Button
                                                    component={RouterLink}
                                                    to={`/credentials/${encodeURIComponent(
                                                        grant.holderAid
                                                    )}/wallet`}
                                                    size="small"
                                                    data-testid="credential-grant-notification-wallet-link"
                                                    data-ui-sound={
                                                        UI_SOUND_HOVER_VALUE
                                                    }
                                                    onClick={() =>
                                                        setNotificationsAnchor(
                                                            null
                                                        )
                                                    }
                                                >
                                                    Wallet
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Box>
                                );
                            })}
                            {(visibleChallengeRequests.length > 0 ||
                                visibleDelegationRequests.length > 0 ||
                                visibleCredentialGrants.length > 0) &&
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
                                    data-ui-sound={UI_SOUND_HOVER_VALUE}
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
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                        sx={{ borderRadius: 1 }}
                    >
                        <ListItemText primary="All notifications" />
                    </ListItemButton>
                </List>
            </Popover>
        </AppBar>
    );
};
