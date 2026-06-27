import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    IconButton,
    Link,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import {
    Link as RouterLink,
    useFetcher,
    useLoaderData,
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
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type {
    ContactActionData,
    CredentialActionData,
    MultisigActionData,
    NotificationsLoaderData,
} from '../../app/routeData';
import { useAppSelector } from '../../state/hooks';
import {
    selectAppNotificationById,
    selectChallengeRequestNotificationById,
    selectCredentialGrantNotificationById,
    selectDelegationRequestNotificationById,
    selectIdentifiers,
    selectKeriaNotificationById,
    selectMultisigRequestNotificationById,
    selectOperationById,
    selectW3CVcGrantNotificationById,
} from '../../state/selectors';
import { PayloadDetails } from '../../app/PayloadDetails';
import { formatTimestamp } from '../../app/timeFormat';
import {
    defaultMultisigRequestGroupAlias,
    defaultMultisigRequestLocalMember,
    displayMultisigRequestGroupAlias,
    multisigRequestIntent,
    requiresMultisigJoinLabel,
} from '../multisig/multisigRequestUi';
import { NotificationProtocolPanels } from './NotificationProtocolPanels';

const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

/**
 * Route view for one KERIA protocol notification or synthetic challenge item.
 */
export const NotificationDetailView = () => {
    const loaderData = useLoaderData() as NotificationsLoaderData;
    const { notificationId = '' } = useParams();
    const navigate = useNavigate();
    const dismissFetcher = useFetcher<ContactActionData>();
    const credentialFetcher = useFetcher<CredentialActionData>();
    const delegationFetcher = useFetcher<ContactActionData>();
    const multisigFetcher = useFetcher<MultisigActionData>();
    const markReadFetcher = useFetcher<ContactActionData>();
    const [multisigAliasDrafts, setMultisigAliasDrafts] = useState<
        Record<string, string>
    >({});
    const appNotification = useAppSelector(
        selectAppNotificationById(notificationId)
    );
    const appNotificationOperation = useAppSelector(
        selectOperationById(appNotification?.operationId ?? '')
    );
    const notification = useAppSelector(
        selectKeriaNotificationById(notificationId)
    );
    const challengeRequest = useAppSelector(
        selectChallengeRequestNotificationById(notificationId)
    );
    const credentialGrant = useAppSelector(
        selectCredentialGrantNotificationById(notificationId)
    );
    const w3cVcGrant = useAppSelector(
        selectW3CVcGrantNotificationById(notificationId)
    );
    const delegationRequest = useAppSelector(
        selectDelegationRequestNotificationById(notificationId)
    );
    const multisigRequest = useAppSelector(
        selectMultisigRequestNotificationById(notificationId)
    );
    const identifiers = useAppSelector(selectIdentifiers);
    const grantRecipient =
        credentialGrant === null
            ? undefined
            : identifiers.find(
                  (identifier) =>
                      identifier.prefix === credentialGrant.holderAid
              );
    const w3cGrantHolder =
        w3cVcGrant === null
            ? undefined
            : identifiers.find(
                  (identifier) => identifier.prefix === w3cVcGrant.holderAid
              );
    const canAdmitGrant =
        credentialGrant?.status === 'actionable' &&
        grantRecipient !== undefined &&
        credentialFetcher.state === 'idle';
    const delegationApprover =
        delegationRequest === null
            ? undefined
            : identifiers.find(
                  (identifier) =>
                      identifier.prefix === delegationRequest.delegatorAid
              );
    const canApproveDelegation =
        delegationRequest?.status === 'actionable' &&
        delegationApprover !== undefined &&
        delegationFetcher.state === 'idle';
    const multisigMember =
        multisigRequest === null
            ? undefined
            : (defaultMultisigRequestLocalMember(
                  multisigRequest,
                  identifiers
              ) ?? undefined);
    const multisigDefaultGroupAlias =
        multisigRequest === null
            ? ''
            : defaultMultisigRequestGroupAlias(multisigRequest, identifiers);
    const multisigGroupAlias =
        multisigRequest === null
            ? ''
            : (multisigAliasDrafts[multisigRequest.notificationId] ??
              multisigDefaultGroupAlias);
    const multisigDisplayGroupAlias =
        multisigRequest === null
            ? 'Not available'
            : displayMultisigRequestGroupAlias(multisigRequest, identifiers);
    const multisigRequiresJoinLabel =
        multisigRequest !== null && requiresMultisigJoinLabel(multisigRequest);
    const canApproveMultisig =
        multisigRequest?.status === 'actionable' &&
        multisigMember !== undefined &&
        multisigGroupAlias.trim().length > 0 &&
        multisigFetcher.state === 'idle';

    useEffect(() => {
        if (
            dismissFetcher.data?.ok === true &&
            dismissFetcher.data.intent === 'dismissExchangeNotification'
        ) {
            navigate('/notifications');
        }
    }, [dismissFetcher.data, navigate]);

    if (appNotification !== null) {
        return (
            <Box sx={{ display: 'grid', gap: 2.5, maxWidth: 980 }}>
                <PageHeader
                    eyebrow="App notification"
                    title={appNotification.title}
                    summary={appNotification.id}
                    actions={
                        <Button
                            component={RouterLink}
                            to="/notifications"
                            startIcon={<ArrowBackIcon />}
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                        >
                            Back to notifications
                        </Button>
                    }
                />
                <ConsolePanel
                    title="Notification"
                    eyebrow={appNotification.severity}
                    actions={
                        <StatusPill
                            label={appNotification.status}
                            tone={
                                appNotification.severity === 'error'
                                    ? 'error'
                                    : appNotification.severity === 'success'
                                      ? 'success'
                                      : appNotification.severity === 'warning'
                                        ? 'warning'
                                        : 'neutral'
                            }
                        />
                    }
                >
                    <Stack spacing={1.5}>
                        <Stack spacing={0.5}>
                            <TelemetryRow
                                label="Message"
                                value={appNotification.message}
                            />
                            <TelemetryRow
                                label="Created"
                                value={timestampText(
                                    appNotification.createdAt
                                )}
                            />
                            <TelemetryRow
                                label="Read"
                                value={appNotification.readAt ?? 'Unread'}
                            />
                            <TelemetryRow
                                label="Operation"
                                value={
                                    appNotificationOperation?.requestId ??
                                    appNotification.operationId ??
                                    'Not available'
                                }
                                mono
                            />
                        </Stack>
                        <PayloadDetails
                            details={appNotification.payloadDetails}
                        />
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
                        >
                            {appNotification.links
                                .filter((link) => link.rel !== 'notification')
                                .map((link) => (
                                    <Button
                                        key={`${appNotification.id}:${link.rel}`}
                                        component={RouterLink}
                                        to={link.path}
                                        variant={
                                            link.rel === 'operation'
                                                ? 'contained'
                                                : 'outlined'
                                        }
                                    >
                                        {link.label}
                                    </Button>
                                ))}
                            {appNotificationOperation !== null && (
                                <Link
                                    component={RouterLink}
                                    to={`/operations/${encodeURIComponent(
                                        appNotificationOperation.requestId
                                    )}`}
                                >
                                    Open operation telemetry
                                </Link>
                            )}
                        </Stack>
                    </Stack>
                </ConsolePanel>
            </Box>
        );
    }

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
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
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

    const admitCredentialGrant = () => {
        if (credentialGrant === null || grantRecipient === undefined) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'admitCredentialGrant');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('holderAlias', grantRecipient.name);
        formData.set('holderAid', credentialGrant.holderAid);
        formData.set('notificationId', credentialGrant.notificationId);
        formData.set('grantSaid', credentialGrant.grantSaid);
        credentialFetcher.submit(formData, {
            method: 'post',
            action: '/credentials',
        });
    };

    const approveDelegationRequest = () => {
        if (delegationRequest === null || delegationApprover === undefined) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'approveDelegationRequest');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', delegationRequest.notificationId);
        formData.set('delegatorName', delegationApprover.name);
        formData.set('delegatorAid', delegationRequest.delegatorAid);
        formData.set('delegateAid', delegationRequest.delegateAid);
        formData.set('delegateEventSaid', delegationRequest.delegateEventSaid);
        formData.set('sequence', delegationRequest.sequence);
        formData.set('sourceAid', delegationRequest.sourceAid ?? '');
        formData.set('createdAt', delegationRequest.createdAt);
        delegationFetcher.submit(formData, {
            method: 'post',
            action: `/notifications/${encodeURIComponent(notification.id)}`,
        });
    };

    const approveMultisigRequest = () => {
        if (multisigRequest === null || multisigMember === undefined) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', multisigRequestIntent(multisigRequest));
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', multisigRequest.notificationId);
        formData.set('exnSaid', multisigRequest.exnSaid);
        formData.set('groupAlias', multisigGroupAlias.trim());
        formData.set('localMemberName', multisigMember.name);
        multisigFetcher.submit(formData, {
            method: 'post',
            action: '/multisig',
        });
    };

    const markNotificationRead = () => {
        const formData = new FormData();
        formData.set('intent', 'markNotificationRead');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', notification.id);
        markReadFetcher.submit(formData, {
            method: 'post',
            action: `/notifications/${encodeURIComponent(notification.id)}`,
        });
    };

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Notification"
                title={
                    challengeRequest !== null
                        ? 'Challenge request'
                        : credentialGrant !== null
                          ? 'Credential grant'
                          : w3cVcGrant !== null
                            ? 'W3C VC-JWT grant'
                          : delegationRequest !== null
                            ? 'Delegation request'
                            : multisigRequest !== null
                              ? 'Multisig request'
                              : notification.route
                }
                summary={notification.id}
                actions={
                    <Stack direction="row" spacing={1}>
                        {challengeRequest !== null && (
                            <Tooltip title="Dismiss challenge request">
                                <span>
                                    <IconButton
                                        color="error"
                                        aria-label="dismiss challenge request"
                                        data-testid="challenge-notification-detail-dismiss"
                                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                                        disabled={
                                            dismissFetcher.state !== 'idle'
                                        }
                                        onClick={() => {
                                            const formData = new FormData();
                                            formData.set(
                                                'intent',
                                                'dismissExchangeNotification'
                                            );
                                            formData.set(
                                                'requestId',
                                                globalThis.crypto.randomUUID()
                                            );
                                            formData.set(
                                                'notificationId',
                                                notification.id
                                            );
                                            formData.set(
                                                'exnSaid',
                                                challengeRequest.exnSaid
                                            );
                                            formData.set(
                                                'route',
                                                notification.route
                                            );
                                            dismissFetcher.submit(formData, {
                                                method: 'post',
                                                action: `/notifications/${encodeURIComponent(
                                                    notification.id
                                                )}`,
                                            });
                                        }}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        )}
                        <Button
                            component={RouterLink}
                            to="/notifications"
                            startIcon={<ArrowBackIcon />}
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                        >
                            Back to notifications
                        </Button>
                    </Stack>
                }
            />
            {loaderData.status === 'error' && (
                <Box
                    sx={{
                        border: 1,
                        borderColor: 'warning.main',
                        borderRadius: 1,
                        bgcolor: (theme) =>
                            alpha(theme.palette.warning.main, 0.08),
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
            <NotificationProtocolPanels
                notification={notification}
                challengeRequest={challengeRequest}
                credentialGrant={credentialGrant}
                w3cVcGrant={w3cVcGrant}
                delegationRequest={delegationRequest}
                multisigRequest={multisigRequest}
                identifiers={identifiers}
                grantRecipient={grantRecipient}
                w3cGrantHolder={w3cGrantHolder}
                canAdmitGrant={canAdmitGrant}
                canMarkRead={
                    !notification.read && markReadFetcher.state === 'idle'
                }
                delegationApprover={delegationApprover}
                canApproveDelegation={canApproveDelegation}
                multisigMember={multisigMember}
                multisigDisplayGroupAlias={multisigDisplayGroupAlias}
                multisigRequiresJoinLabel={multisigRequiresJoinLabel}
                multisigGroupAlias={multisigGroupAlias}
                canApproveMultisig={canApproveMultisig}
                setMultisigAliasDrafts={setMultisigAliasDrafts}
                admitCredentialGrant={admitCredentialGrant}
                markNotificationRead={markNotificationRead}
                approveDelegationRequest={approveDelegationRequest}
                approveMultisigRequest={approveMultisigRequest}
            />
        </Box>
    );
};
