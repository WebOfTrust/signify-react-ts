import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink, useLoaderData, useParams } from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import {
    ConsolePanel,
    EmptyState,
    PageHeader,
    StatusPill,
    TelemetryRow,
} from '../../app/Console';
import { formatTimestamp } from '../../app/timeFormat';
import type { NotificationsLoaderData } from '../../app/routeData';
import { useAppSelector } from '../../state/hooks';
import {
    selectChallengeRequestNotificationById,
    selectIdentifiers,
    selectKeriaNotificationById,
} from '../../state/selectors';
import { ChallengeRequestResponseForm } from './ChallengeRequestResponseForm';

const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

export const NotificationDetailView = () => {
    const loaderData = useLoaderData() as NotificationsLoaderData;
    const { notificationId = '' } = useParams();
    const notification = useAppSelector(
        selectKeriaNotificationById(notificationId)
    );
    const challengeRequest = useAppSelector(
        selectChallengeRequestNotificationById(notificationId)
    );
    const identifiers = useAppSelector(selectIdentifiers);

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    if (notification === null) {
        return (
            <Box sx={{ display: 'grid', gap: 2.5 }}>
                <PageHeader
                    eyebrow="Notification"
                    title="Notification not found"
                    actions={
                        <Button
                            component={RouterLink}
                            to="/notifications"
                            startIcon={<ArrowBackIcon />}
                        >
                            Back to notifications
                        </Button>
                    }
                />
                <EmptyState
                    title="No notification record"
                    message="The notification may have been marked read, deleted, or not synced into this session yet."
                />
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Notification"
                title={
                    challengeRequest === null
                        ? notification.route
                        : 'Challenge request'
                }
                summary={notification.id}
                actions={
                    <Button
                        component={RouterLink}
                        to="/notifications"
                        startIcon={<ArrowBackIcon />}
                    >
                        Back to notifications
                    </Button>
                }
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
            {challengeRequest !== null ? (
                <ConsolePanel
                    title="Challenge response"
                    eyebrow="Responder"
                    actions={
                        <StatusPill
                            label={challengeRequest.status}
                            tone={
                                challengeRequest.status === 'actionable'
                                    ? 'info'
                                    : challengeRequest.status === 'error'
                                      ? 'error'
                                      : challengeRequest.status ===
                                          'senderUnknown'
                                        ? 'warning'
                                        : 'success'
                            }
                        />
                    }
                >
                    <Stack spacing={2}>
                        <Stack spacing={0.5}>
                            <TelemetryRow
                                label="Sender"
                                value={challengeRequest.senderAlias}
                            />
                            <TelemetryRow
                                label="Sender AID"
                                value={challengeRequest.senderAid}
                                mono
                            />
                            <TelemetryRow
                                label="Responder AID"
                                value={
                                    challengeRequest.recipientAid ??
                                    'Not available'
                                }
                                mono
                            />
                            <TelemetryRow
                                label="Challenge id"
                                value={challengeRequest.challengeId}
                                mono
                            />
                            <TelemetryRow
                                label="EXN SAID"
                                value={challengeRequest.exnSaid}
                                mono
                            />
                            <TelemetryRow
                                label="Created"
                                value={timestampText(
                                    challengeRequest.createdAt
                                )}
                            />
                        </Stack>
                        <Divider />
                        {challengeRequest.status === 'senderUnknown' ? (
                            <EmptyState
                                title="Sender is not a contact"
                                message="Resolve the sender contact before responding to this challenge request."
                            />
                        ) : (
                            <ChallengeRequestResponseForm
                                request={challengeRequest}
                                identifiers={identifiers}
                                action={`/notifications/${encodeURIComponent(
                                    notification.id
                                )}`}
                            />
                        )}
                    </Stack>
                </ConsolePanel>
            ) : (
                <ConsolePanel title="Protocol metadata" eyebrow="KERIA">
                    <Stack spacing={0.5}>
                        <TelemetryRow
                            label="Route"
                            value={notification.route}
                        />
                        <TelemetryRow
                            label="Status"
                            value={notification.status}
                        />
                        <TelemetryRow
                            label="Read"
                            value={notification.read ? 'yes' : 'no'}
                        />
                        <TelemetryRow
                            label="Anchor SAID"
                            value={notification.anchorSaid ?? 'Not available'}
                            mono
                        />
                        <TelemetryRow
                            label="Updated"
                            value={timestampText(notification.updatedAt)}
                        />
                        {notification.message !== null && (
                            <TelemetryRow
                                label="Message"
                                value={notification.message}
                            />
                        )}
                    </Stack>
                </ConsolePanel>
            )}
        </Box>
    );
};
