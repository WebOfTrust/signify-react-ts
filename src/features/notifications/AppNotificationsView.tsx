import { useEffect } from 'react';
import {
    Box,
    Link,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material';
import { Link as RouterLink, useLoaderData } from 'react-router-dom';
import {
    ConsolePanel,
    EmptyState,
    PageHeader,
    StatusPill,
} from '../../app/Console';
import { PayloadDetails } from '../../app/PayloadDetails';
import { formatTimestamp } from '../../app/timeFormat';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { NotificationsLoaderData } from '../../app/routeData';
import { useAppDispatch, useAppSelector } from '../../state/hooks';
import { allAppNotificationsRead } from '../../state/appNotifications.slice';
import {
    selectAppNotifications,
    selectKeriaNotifications,
} from '../../state/selectors';

const APP_NOTIFICATION_READ_DELAY_MS = 1250;

/**
 * Route view that combines app notifications and KERIA protocol inbox records.
 */
export const AppNotificationsView = () => {
    const loaderData = useLoaderData() as NotificationsLoaderData;
    const dispatch = useAppDispatch();
    const notifications = useAppSelector(selectAppNotifications);
    const keriaNotifications = useAppSelector(selectKeriaNotifications);
    const unreadCount = notifications.filter(
        (notification) => notification.status === 'unread'
    ).length;

    useEffect(() => {
        if (unreadCount === 0) {
            return undefined;
        }

        const timeout = globalThis.setTimeout(() => {
            dispatch(allAppNotificationsRead());
        }, APP_NOTIFICATION_READ_DELAY_MS);

        return () => {
            globalThis.clearTimeout(timeout);
        };
    }, [dispatch, unreadCount]);

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Activity"
                title="Notifications"
                summary="App operation notices and KERIA protocol inbox items for the connected session."
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
                    <Typography component="span">
                        {loaderData.message}
                    </Typography>
                </Box>
            )}
            {notifications.length === 0 ? (
                <EmptyState
                    title="No notifications"
                    message="Completed credential, identifier, and contact operations will report outcomes here."
                />
            ) : (
                <List disablePadding>
                    {notifications.map((notification) => (
                        <ListItem
                            key={notification.id}
                            sx={{
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                mb: 1,
                                alignItems: 'flex-start',
                                bgcolor:
                                    notification.status === 'unread'
                                        ? 'action.selected'
                                        : 'action.hover',
                                opacity:
                                    notification.status === 'unread' ? 1 : 0.72,
                            }}
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
                                            {notification.title}
                                        </Typography>
                                        <StatusPill
                                            label={notification.severity}
                                            tone={
                                                notification.severity ===
                                                'error'
                                                    ? 'error'
                                                    : notification.severity ===
                                                        'success'
                                                      ? 'success'
                                                      : 'neutral'
                                            }
                                        />
                                    </Stack>
                                }
                                secondary={
                                    <Stack spacing={0.5}>
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
                                        />
                                        <Stack
                                            direction="row"
                                            spacing={1.5}
                                            sx={{ flexWrap: 'wrap' }}
                                        >
                                            {notification.links.map((link) => (
                                                <Link
                                                    key={`${notification.id}:${link.rel}`}
                                                    component={RouterLink}
                                                    to={link.path}
                                                    data-ui-sound={
                                                        UI_SOUND_HOVER_VALUE
                                                    }
                                                >
                                                    {link.label}
                                                </Link>
                                            ))}
                                        </Stack>
                                    </Stack>
                                }
                            />
                        </ListItem>
                    ))}
                </List>
            )}
            <ConsolePanel title="KERIA notification inventory" eyebrow="KERIA">
                {keriaNotifications.length === 0 ? (
                    <EmptyState
                        title="No KERIA notifications"
                        message="Protocol inbox items appear here after live session sync."
                    />
                ) : (
                    <List disablePadding>
                        {keriaNotifications.map((notification) => (
                            <ListItemButton
                                key={notification.id}
                                component={RouterLink}
                                to={`/notifications/${encodeURIComponent(
                                    notification.id
                                )}`}
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                                sx={{
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    mb: 1,
                                    alignItems: 'flex-start',
                                    bgcolor: 'rgba(5, 9, 13, 0.4)',
                                }}
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
                                                label={notification.status}
                                                tone={
                                                    notification.status ===
                                                    'error'
                                                        ? 'error'
                                                        : notification.status ===
                                                            'processed'
                                                          ? 'success'
                                                          : notification.status ===
                                                              'processing'
                                                            ? 'warning'
                                                            : 'info'
                                                }
                                            />
                                        </Stack>
                                    }
                                    secondary={
                                        <Stack spacing={0.5}>
                                            {formatTimestamp(
                                                notification.updatedAt
                                            ) !== null && (
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                >
                                                    Updated{' '}
                                                    {formatTimestamp(
                                                        notification.updatedAt
                                                    )}
                                                </Typography>
                                            )}
                                            {notification.message !== null && (
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {notification.message}
                                                </Typography>
                                            )}
                                            {notification.challengeRequest !==
                                                null &&
                                                notification.challengeRequest !==
                                                    undefined && (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        From{' '}
                                                        {
                                                            notification
                                                                .challengeRequest
                                                                .senderAlias
                                                        }
                                                    </Typography>
                                                )}
                                            {notification.delegationRequest !==
                                                null &&
                                                notification.delegationRequest !==
                                                    undefined && (
                                                    <Typography
                                                        variant="body2"
                                                        color="text.secondary"
                                                    >
                                                        Delegator{' '}
                                                        {
                                                            notification
                                                                .delegationRequest
                                                                .delegatorAid
                                                        }{' '}
                                                        / Delegate{' '}
                                                        {
                                                            notification
                                                                .delegationRequest
                                                                .delegateAid
                                                        }
                                                    </Typography>
                                                )}
                                        </Stack>
                                    }
                                />
                            </ListItemButton>
                        ))}
                    </List>
                )}
            </ConsolePanel>
        </Box>
    );
};
