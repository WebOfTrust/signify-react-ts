import { useEffect } from 'react';
import {
    Box,
    Chip,
    Link,
    List,
    ListItem,
    ListItemText,
    Stack,
    Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../state/hooks';
import { allAppNotificationsRead } from '../../state/appNotifications.slice';
import { selectAppNotifications } from '../../state/selectors';

const APP_NOTIFICATION_READ_DELAY_MS = 1250;

export const AppNotificationsView = () => {
    const dispatch = useAppDispatch();
    const notifications = useAppSelector(selectAppNotifications);
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

    return (
        <Box sx={{ display: 'grid', gap: 2 }}>
            <Typography variant="h5" component="h1">
                Notifications
            </Typography>
            {notifications.length === 0 ? (
                <Typography color="text.secondary">
                    No app notifications yet.
                </Typography>
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
                                        ? 'common.white'
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
                                        <Chip
                                            size="small"
                                            label={notification.severity}
                                            color={
                                                notification.severity === 'error'
                                                    ? 'error'
                                                    : notification.severity ===
                                                        'success'
                                                      ? 'success'
                                                      : 'default'
                                            }
                                        />
                                    </Stack>
                                }
                                secondary={
                                    <Stack spacing={0.5}>
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                        >
                                            {notification.message}
                                        </Typography>
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
        </Box>
    );
};
