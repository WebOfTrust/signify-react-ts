import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Divider,
    IconButton,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteIcon from '@mui/icons-material/Delete';
import HowToRegIcon from '@mui/icons-material/HowToReg';
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
import { formatTimestamp } from '../../app/timeFormat';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type {
    ContactActionData,
    CredentialActionData,
    MultisigActionData,
    NotificationsLoaderData,
} from '../../app/routeData';
import { useAppSelector } from '../../state/hooks';
import {
    selectChallengeRequestNotificationById,
    selectCredentialGrantNotificationById,
    selectDelegationRequestNotificationById,
    selectIdentifiers,
    selectKeriaNotificationById,
    selectMultisigRequestNotificationById,
} from '../../state/selectors';
import type {
    CredentialGrantNotification,
    DelegationRequestNotification,
    MultisigRequestNotification,
} from '../../state/notifications.slice';
import { ChallengeRequestResponseForm } from './ChallengeRequestResponseForm';
import { sithSummary } from '../multisig/multisigThresholds';
import {
    defaultMultisigRequestGroupAlias,
    defaultMultisigRequestLocalMember,
    displayMultisigRequestGroupAlias,
    multisigRequestActionLabel,
    multisigRequestIntent,
    multisigRequestTitle,
    requiresMultisigJoinLabel,
} from '../multisig/multisigRequestUi';

const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

const grantStatusTone = (
    status: CredentialGrantNotification['status']
): 'neutral' | 'success' | 'warning' | 'error' | 'info' => {
    if (status === 'error') {
        return 'error';
    }

    if (status === 'notForThisWallet') {
        return 'warning';
    }

    if (status === 'admitted') {
        return 'success';
    }

    return 'info';
};

const delegationStatusTone = (
    status: DelegationRequestNotification['status']
): 'neutral' | 'success' | 'warning' | 'error' | 'info' => {
    if (status === 'error') {
        return 'error';
    }

    if (status === 'notForThisWallet') {
        return 'warning';
    }

    if (status === 'approved') {
        return 'success';
    }

    return 'info';
};

const multisigStatusTone = (
    status: MultisigRequestNotification['status']
): 'neutral' | 'success' | 'warning' | 'error' | 'info' => {
    if (status === 'error') {
        return 'error';
    }

    if (status === 'notForThisWallet') {
        return 'warning';
    }

    if (status === 'approved') {
        return 'success';
    }

    return 'info';
};

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
    const [multisigAliasDrafts, setMultisigAliasDrafts] = useState<
        Record<string, string>
    >({});
    const notification = useAppSelector(
        selectKeriaNotificationById(notificationId)
    );
    const challengeRequest = useAppSelector(
        selectChallengeRequestNotificationById(notificationId)
    );
    const credentialGrant = useAppSelector(
        selectCredentialGrantNotificationById(notificationId)
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

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Notification"
                title={
                    challengeRequest !== null
                        ? 'Challenge request'
                        : credentialGrant !== null
                          ? 'Credential grant'
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
                                label="From"
                                value={challengeRequest.senderAlias}
                            />
                            <TelemetryRow
                                label="From AID"
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
            ) : credentialGrant !== null ? (
                <ConsolePanel
                    title="Credential admit"
                    eyebrow="Holder"
                    actions={
                        <StatusPill
                            label={credentialGrant.status}
                            tone={grantStatusTone(credentialGrant.status)}
                        />
                    }
                >
                    <Stack spacing={2}>
                        <Stack spacing={0.5}>
                            <TelemetryRow
                                label="Issuer AID"
                                value={credentialGrant.issuerAid}
                                mono
                            />
                            <TelemetryRow
                                label="Recipient"
                                value={grantRecipient?.name ?? 'Not available'}
                            />
                            <TelemetryRow
                                label="Recipient AID"
                                value={credentialGrant.holderAid}
                                mono
                            />
                            <TelemetryRow
                                label="Credential SAID"
                                value={credentialGrant.credentialSaid}
                                mono
                            />
                            <TelemetryRow
                                label="Grant SAID"
                                value={credentialGrant.grantSaid}
                                mono
                            />
                            <TelemetryRow
                                label="Created"
                                value={timestampText(credentialGrant.createdAt)}
                            />
                        </Stack>
                        <Divider />
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{
                                alignItems: { xs: 'stretch', sm: 'center' },
                            }}
                        >
                            <Button
                                variant="contained"
                                startIcon={<HowToRegIcon />}
                                data-testid="credential-notification-detail-admit"
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                                disabled={!canAdmitGrant}
                                onClick={admitCredentialGrant}
                            >
                                Admit credential
                            </Button>
                            <Button
                                component={RouterLink}
                                to={`/credentials/${encodeURIComponent(
                                    credentialGrant.holderAid
                                )}/wallet`}
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                            >
                                Open wallet
                            </Button>
                        </Stack>
                        {grantRecipient === undefined && (
                            <EmptyState
                                title="Recipient identifier unavailable"
                                message="This grant names a recipient AID that is not loaded as a local identifier in this wallet."
                            />
                        )}
                    </Stack>
                </ConsolePanel>
            ) : delegationRequest !== null ? (
                <ConsolePanel
                    title="Delegation approval"
                    eyebrow="Delegator"
                    actions={
                        <StatusPill
                            label={delegationRequest.status}
                            tone={delegationStatusTone(
                                delegationRequest.status
                            )}
                        />
                    }
                >
                    <Stack spacing={2}>
                        <Stack spacing={0.5}>
                            <TelemetryRow
                                label="Delegator"
                                value={
                                    delegationApprover?.name ?? 'Not available'
                                }
                            />
                            <TelemetryRow
                                label="Delegator AID"
                                value={delegationRequest.delegatorAid}
                                mono
                            />
                            <TelemetryRow
                                label="Delegate AID"
                                value={delegationRequest.delegateAid}
                                mono
                            />
                            <TelemetryRow
                                label="Delegate event SAID"
                                value={delegationRequest.delegateEventSaid}
                                mono
                            />
                            <TelemetryRow
                                label="Sequence"
                                value={delegationRequest.sequence}
                                mono
                            />
                            <TelemetryRow
                                label="Source AID"
                                value={
                                    delegationRequest.sourceAid ??
                                    'Not available'
                                }
                                mono
                            />
                            <TelemetryRow
                                label="Anchor i"
                                value={delegationRequest.anchor.i}
                                mono
                            />
                            <TelemetryRow
                                label="Anchor s"
                                value={delegationRequest.anchor.s}
                                mono
                            />
                            <TelemetryRow
                                label="Anchor d"
                                value={delegationRequest.anchor.d}
                                mono
                            />
                            <TelemetryRow
                                label="Requested"
                                value={timestampText(
                                    delegationRequest.createdAt
                                )}
                            />
                        </Stack>
                        <Divider />
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{
                                alignItems: { xs: 'stretch', sm: 'center' },
                            }}
                        >
                            <Button
                                variant="contained"
                                startIcon={<HowToRegIcon />}
                                data-testid="delegation-notification-detail-approve"
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                                disabled={!canApproveDelegation}
                                onClick={approveDelegationRequest}
                            >
                                Approve delegation
                            </Button>
                        </Stack>
                        {delegationApprover === undefined && (
                            <EmptyState
                                title="Delegator identifier unavailable"
                                message="This request names a delegator AID that is not loaded as a local identifier in this wallet."
                            />
                        )}
                    </Stack>
                </ConsolePanel>
            ) : multisigRequest !== null ? (
                <ConsolePanel
                    title={multisigRequestTitle(multisigRequest)}
                    eyebrow="Group"
                    actions={
                        <StatusPill
                            label={multisigRequest.status}
                            tone={multisigStatusTone(multisigRequest.status)}
                        />
                    }
                >
                    <Stack spacing={2}>
                        <Stack spacing={0.5}>
                            <TelemetryRow
                                label="Route"
                                value={multisigRequest.route}
                            />
                            <TelemetryRow
                                label="Group alias"
                                value={multisigDisplayGroupAlias}
                            />
                            <TelemetryRow
                                label="Group AID"
                                value={
                                    multisigRequest.groupAid ??
                                    'Not available'
                                }
                                mono
                            />
                            <TelemetryRow
                                label="Local member"
                                value={multisigMember?.name ?? 'Not available'}
                            />
                            <TelemetryRow
                                label="Sender AID"
                                value={
                                    multisigRequest.senderAid ??
                                    'Not available'
                                }
                                mono
                            />
                            <TelemetryRow
                                label="EXN SAID"
                                value={multisigRequest.exnSaid}
                                mono
                            />
                            <TelemetryRow
                                label="Embedded event"
                                value={
                                    multisigRequest.embeddedEventType ??
                                    'Not available'
                                }
                            />
                            <TelemetryRow
                                label="Responses"
                                value={`${multisigRequest.progress.completed}/${multisigRequest.progress.total}`}
                            />
                            <TelemetryRow
                                label="Responded"
                                value={
                                    multisigRequest.progress.respondedMemberAids
                                        .join(', ') || 'None'
                                }
                                mono
                            />
                            <TelemetryRow
                                label="Waiting"
                                value={
                                    multisigRequest.progress.waitingMemberAids
                                        .join(', ') || 'None'
                                }
                                mono
                            />
                            <TelemetryRow
                                label="Signing members"
                                value={multisigRequest.signingMemberAids.length}
                            />
                            <TelemetryRow
                                label="Rotation members"
                                value={multisigRequest.rotationMemberAids.length}
                            />
                            <TelemetryRow
                                label="Signing threshold"
                                value={sithSummary(
                                    multisigRequest.signingThreshold
                                )}
                                mono
                            />
                            <TelemetryRow
                                label="Rotation threshold"
                                value={sithSummary(
                                    multisigRequest.rotationThreshold
                                )}
                                mono
                            />
                            {multisigRequest.embeddedPayloadSummary !== null && (
                                <TelemetryRow
                                    label="Payload"
                                    value={
                                        multisigRequest.embeddedPayloadSummary
                                    }
                                    mono
                                />
                            )}
                            <TelemetryRow
                                label="Created"
                                value={timestampText(
                                    multisigRequest.createdAt
                                )}
                            />
                        </Stack>
                        <Divider />
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{
                                alignItems: { xs: 'stretch', sm: 'center' },
                            }}
                        >
                            {multisigRequiresJoinLabel && (
                                <TextField
                                    size="small"
                                    label="New group label"
                                    value={multisigGroupAlias}
                                    helperText="Local label for this wallet after joining."
                                    onChange={(event) =>
                                        setMultisigAliasDrafts((current) => ({
                                            ...current,
                                            [multisigRequest.notificationId]:
                                                event.target.value,
                                        }))
                                    }
                                    data-testid="multisig-notification-detail-group-label"
                                />
                            )}
                            <Button
                                variant="contained"
                                startIcon={<HowToRegIcon />}
                                data-testid="multisig-notification-detail-approve"
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                                disabled={!canApproveMultisig}
                                onClick={approveMultisigRequest}
                            >
                                {multisigRequestActionLabel(multisigRequest)}
                            </Button>
                            <Button
                                component={RouterLink}
                                to="/multisig"
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                            >
                                Open multisig
                            </Button>
                        </Stack>
                        {multisigMember === undefined && (
                            <EmptyState
                                title="Local member unavailable"
                                message="This request does not name a loaded local member identifier. Open Multisig to review or resolve missing members."
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
