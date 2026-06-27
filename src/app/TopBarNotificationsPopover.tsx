import type { Dispatch, SetStateAction } from 'react';
import {
    Box,
    Button,
    Divider,
    FormControl,
    IconButton,
    InputLabel,
    List,
    ListItemButton,
    ListItemText,
    MenuItem,
    Popover,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import { Link as RouterLink } from 'react-router-dom';
import { PayloadDetails } from './PayloadDetails';
import { formatTimestamp } from './timeFormat';
import { UI_SOUND_HOVER_VALUE } from './uiSound';
import type { AppNotificationRecord } from '../state/appNotifications.slice';
import type {
    ChallengeRequestNotification,
    DelegationRequestNotification,
    MultisigRequestNotification,
} from '../state/notifications.slice';
import type {
    CredentialGrantNotification,
    W3CVcGrantNotification,
} from '../domain/credentials/credentialTypes';
import type { IdentifierSummary } from '../domain/identifiers/identifierTypes';
import { ChallengeRequestResponseForm } from '../features/notifications/ChallengeRequestResponseForm';
import { abbreviateMiddle } from '../domain/contacts/contactHelpers';
import {
    defaultMultisigRequestGroupAlias,
    defaultMultisigRequestLocalMember,
    displayMultisigRequestGroupAlias,
    multisigRequestActionLabel,
    multisigRequestLocalMembers,
    multisigRequestTitle,
    requiresMultisigJoinLabel,
} from '../features/multisig/multisigRequestUi';

/**
 * Shell-local draft values for actionable multisig notification cards.
 */
type MultisigNotificationDrafts = Record<
    string,
    { groupAlias: string; localMemberName: string }
>;

/**
 * Notification popover state and command callbacks owned by `TopBar`.
 *
 * Route action intents, fetchers, unread bookkeeping, and protocol dispatch
 * remain in the container; this component only renders actionable cards.
 */
interface TopBarNotificationsPopoverProps {
    open: boolean;
    anchorEl: HTMLElement | null;
    /** Raw app notifications used to decide whether the popover is empty. */
    recentNotifications: readonly AppNotificationRecord[];
    visibleNotifications: readonly AppNotificationRecord[];
    visibleChallengeRequests: readonly ChallengeRequestNotification[];
    visibleCredentialGrants: readonly CredentialGrantNotification[];
    visibleW3CVcGrants: readonly W3CVcGrantNotification[];
    visibleDelegationRequests: readonly DelegationRequestNotification[];
    visibleMultisigRequests: readonly MultisigRequestNotification[];
    identifiers: readonly IdentifierSummary[];
    /** Per-notification multisig join/approval draft fields. */
    multisigDrafts: MultisigNotificationDrafts;
    setMultisigDrafts: Dispatch<SetStateAction<MultisigNotificationDrafts>>;
    multisigLocalMemberOptions: ReturnType<typeof multisigRequestLocalMembers>;
    canDismissChallengeRequests: boolean;
    canSubmitCredentialGrants: boolean;
    canMarkW3CGrantsRead: boolean;
    canSubmitDelegationRequests: boolean;
    canSubmitMultisigRequests: boolean;
    dismissChallengeRequest: (request: ChallengeRequestNotification) => void;
    admitCredentialGrant: (grant: CredentialGrantNotification) => void;
    markW3CGrantRead: (grant: W3CVcGrantNotification) => void;
    approveDelegationRequest: (request: DelegationRequestNotification) => void;
    submitMultisigRequest: (
        request: MultisigRequestNotification,
        groupAlias: string,
        localMemberName: string
    ) => void;
    onClose: () => void;
}

/**
 * Render app and KERIA protocol notifications in the shell bell popover.
 */
export const TopBarNotificationsPopover = ({
    open,
    anchorEl,
    recentNotifications,
    visibleNotifications,
    visibleChallengeRequests,
    visibleCredentialGrants,
    visibleW3CVcGrants,
    visibleDelegationRequests,
    visibleMultisigRequests,
    identifiers,
    multisigDrafts,
    setMultisigDrafts,
    multisigLocalMemberOptions,
    canDismissChallengeRequests,
    canSubmitCredentialGrants,
    canMarkW3CGrantsRead,
    canSubmitDelegationRequests,
    canSubmitMultisigRequests,
    dismissChallengeRequest,
    admitCredentialGrant,
    markW3CGrantRead,
    approveDelegationRequest,
    submitMultisigRequest,
    onClose,
}: TopBarNotificationsPopoverProps) => (
    <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => onClose()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
    >
        <List sx={{ width: 360, maxWidth: '90vw', p: 1 }}>
            {recentNotifications.length === 0 &&
            visibleChallengeRequests.length === 0 &&
            visibleCredentialGrants.length === 0 &&
            visibleW3CVcGrants.length === 0 &&
            visibleDelegationRequests.length === 0 &&
            visibleMultisigRequests.length === 0 ? (
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
                            canSubmitDelegationRequests;

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
                                                onClose()
                                            }
                                        >
                                            Open
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Box>
                        );
                    })}
                    {visibleMultisigRequests.map((request) => {
                        const localDefault =
                            defaultMultisigRequestLocalMember(
                                request,
                                identifiers
                            );
                        const defaultDraft = {
                            groupAlias:
                                defaultMultisigRequestGroupAlias(
                                    request,
                                    identifiers
                                ),
                            localMemberName: localDefault?.name ?? '',
                        };
                        const draft =
                            multisigDrafts[request.notificationId] ??
                            defaultDraft;
                        const requiresJoinLabel =
                            requiresMultisigJoinLabel(request);
                        const canSubmit =
                            request.status === 'actionable' &&
                            canSubmitMultisigRequests &&
                            draft.groupAlias.trim().length > 0 &&
                            draft.localMemberName.trim().length > 0;
                        const memberLabelId = `topbar-multisig-member-${request.notificationId}`;

                        return (
                            <Box
                                key={request.notificationId}
                                data-testid="multisig-request-notification-card"
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
                                            justifyContent:
                                                'space-between',
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
                                                {multisigRequestTitle(
                                                    request
                                                )}
                                            </Typography>
                                            <Typography
                                                component="div"
                                                variant="caption"
                                                color="text.secondary"
                                                noWrap
                                                sx={{
                                                    display: 'block',
                                                    minWidth: 0,
                                                }}
                                            >
                                                Group{' '}
                                                {displayMultisigRequestGroupAlias(
                                                    request,
                                                    identifiers
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
                                                AID{' '}
                                                {request.groupAid ===
                                                null
                                                    ? 'Not available'
                                                    : abbreviateMiddle(
                                                          request.groupAid,
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
                                                Responses{' '}
                                                {
                                                    request.progress
                                                        .completed
                                                }
                                                /
                                                {request.progress.total}
                                            </Typography>
                                        </Box>
                                        <Button
                                            component={RouterLink}
                                            to={`/notifications/${encodeURIComponent(
                                                request.notificationId
                                            )}`}
                                            size="small"
                                            data-testid="multisig-request-notification-detail-link"
                                            data-ui-sound={
                                                UI_SOUND_HOVER_VALUE
                                            }
                                            onClick={() =>
                                                onClose()
                                            }
                                        >
                                            Open
                                        </Button>
                                    </Stack>
                                    {requiresJoinLabel && (
                                        <TextField
                                            size="small"
                                            label="New group label"
                                            value={draft.groupAlias}
                                            helperText="Local label for this wallet after joining."
                                            fullWidth
                                            onChange={(event) =>
                                                setMultisigDrafts(
                                                    (current) => ({
                                                        ...current,
                                                        [request.notificationId]:
                                                            {
                                                                ...draft,
                                                                groupAlias:
                                                                    event
                                                                        .target
                                                                        .value,
                                                            },
                                                    })
                                                )
                                            }
                                            data-testid="multisig-request-notification-group-label"
                                        />
                                    )}
                                    <FormControl size="small" fullWidth>
                                        <InputLabel id={memberLabelId}>
                                            Local member
                                        </InputLabel>
                                        <Select
                                            labelId={memberLabelId}
                                            label="Local member"
                                            value={
                                                draft.localMemberName
                                            }
                                            onChange={(event) =>
                                                setMultisigDrafts(
                                                    (current) => ({
                                                        ...current,
                                                        [request.notificationId]:
                                                            {
                                                                ...draft,
                                                                localMemberName:
                                                                    event
                                                                        .target
                                                                        .value,
                                                            },
                                                    })
                                                )
                                            }
                                        >
                                            {multisigLocalMemberOptions.map(
                                                (identifier) => (
                                                    <MenuItem
                                                        key={
                                                            identifier.prefix
                                                        }
                                                        value={
                                                            identifier.name
                                                        }
                                                    >
                                                        {
                                                            identifier.name
                                                        }
                                                    </MenuItem>
                                                )
                                            )}
                                        </Select>
                                    </FormControl>
                                    <Button
                                        size="small"
                                        variant="contained"
                                        startIcon={<HowToRegIcon />}
                                        data-testid="multisig-request-notification-submit"
                                        data-ui-sound={
                                            UI_SOUND_HOVER_VALUE
                                        }
                                        disabled={!canSubmit}
                                        onClick={() =>
                                            submitMultisigRequest(
                                                request,
                                                draft.groupAlias,
                                                draft.localMemberName
                                            )
                                        }
                                    >
                                        {multisigRequestActionLabel(
                                            request
                                        )}
                                    </Button>
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
                                                onClose()
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
                                                        !canDismissChallengeRequests
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
                            canSubmitCredentialGrants;

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
                                                onClose()
                                            }
                                        >
                                            Wallet
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Box>
                        );
                    })}
                    {visibleW3CVcGrants.map((grant) => {
                        const holder = identifiers.find(
                            (identifier) => identifier.prefix === grant.holderAid
                        );
                        const holderLabel =
                            holder === undefined
                                ? abbreviateMiddle(grant.holderAid, 28)
                                : `${holder.name} / ${abbreviateMiddle(
                                      grant.holderAid,
                                      20
                                  )}`;

                        return (
                            <Box
                                key={grant.notificationId}
                                data-testid="w3c-grant-notification-card"
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
                                                W3C VC-JWT grant
                                            </Typography>
                                            <Typography
                                                component="div"
                                                variant="caption"
                                                color="text.secondary"
                                                noWrap
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
                                                sx={{
                                                    display: 'block',
                                                    mt: 0.25,
                                                }}
                                            >
                                                Holder {holderLabel}
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
                                                Status {grant.status}
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
                                                Source{' '}
                                                {abbreviateMiddle(
                                                    grant.sourceCredentialSaid,
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
                                                flexWrap: 'wrap',
                                            }}
                                        >
                                            <Button
                                                component={RouterLink}
                                                to={`/notifications/${encodeURIComponent(
                                                    grant.notificationId
                                                )}`}
                                                size="small"
                                                data-testid="w3c-grant-notification-detail-link"
                                                data-ui-sound={
                                                    UI_SOUND_HOVER_VALUE
                                                }
                                                onClick={() => onClose()}
                                            >
                                                Open
                                            </Button>
                                            <Button
                                                component={RouterLink}
                                                to={`/credentials/${encodeURIComponent(
                                                    grant.holderAid
                                                )}/wallet`}
                                                size="small"
                                                data-testid="w3c-grant-notification-wallet-link"
                                                data-ui-sound={
                                                    UI_SOUND_HOVER_VALUE
                                                }
                                                onClick={() => onClose()}
                                            >
                                                Wallet
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                data-testid="w3c-grant-notification-mark-read"
                                                data-ui-sound={
                                                    UI_SOUND_HOVER_VALUE
                                                }
                                                disabled={
                                                    !canMarkW3CGrantsRead
                                                }
                                                onClick={() =>
                                                    markW3CGrantRead(grant)
                                                }
                                            >
                                                Mark read
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Stack>
                            </Box>
                        );
                    })}
                    {(visibleChallengeRequests.length > 0 ||
                        visibleDelegationRequests.length > 0 ||
                        visibleCredentialGrants.length > 0 ||
                        visibleW3CVcGrants.length > 0 ||
                        visibleMultisigRequests.length > 0) &&
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
                            onClick={() => onClose()}
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
                                slotProps={{
                                    secondary: { component: 'div' },
                                }}
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
                onClick={() => onClose()}
                data-ui-sound={UI_SOUND_HOVER_VALUE}
                sx={{ borderRadius: 1 }}
            >
                <ListItemText primary="All notifications" />
            </ListItemButton>
        </List>
    </Popover>
);
