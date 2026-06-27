import type { Dispatch, SetStateAction } from 'react';
import { Button, Divider, Stack, TextField } from '@mui/material';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import { Link as RouterLink } from 'react-router-dom';
import { ConsolePanel, EmptyState, StatusPill, TelemetryRow } from '../../app/Console';
import { formatTimestamp } from '../../app/timeFormat';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type {
    ChallengeRequestNotification,
    DelegationRequestNotification,
    MultisigRequestNotification,
    NotificationRecord,
} from '../../state/notifications.slice';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import type {
    CredentialGrantNotification,
    W3CVcGrantNotification,
} from '../../domain/credentials/credentialTypes';
import { ChallengeRequestResponseForm } from './ChallengeRequestResponseForm';
import { sithSummary } from '../../domain/multisig/multisigThresholds';
import {
    multisigRequestActionLabel,
    multisigRequestTitle,
} from '../multisig/multisigRequestUi';
import { W3CJwtArtifactDetails } from '../../app/W3CArtifactDetails';

const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

/**
 * Map credential grant readiness to the notification detail status tone.
 */
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

const w3cGrantStatusTone = (
    status: W3CVcGrantNotification['status']
): 'neutral' | 'success' | 'warning' | 'error' | 'info' => {
    if (status === 'error') {
        return 'error';
    }
    if (status === 'notForThisWallet') {
        return 'warning';
    }
    if (status === 'materialized') {
        return 'success';
    }
    return 'info';
};

/**
 * Map delegation approval readiness to the notification detail status tone.
 */
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

/**
 * Map multisig request readiness to the notification detail status tone.
 */
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
 * Protocol-specific notification detail state owned by `NotificationDetailView`.
 *
 * Fetchers, form actions, request matching, and multisig alias drafts stay in
 * the route container; this component renders exactly one protocol panel.
 */
interface NotificationProtocolPanelsProps {
    notification: NotificationRecord;
    /** Matched challenge response request for this notification, when present. */
    challengeRequest: ChallengeRequestNotification | null;
    /** Matched credential grant/admit request for this notification, when present. */
    credentialGrant: CredentialGrantNotification | null;
    /** Matched W3C VC-JWT grant notification, when present. */
    w3cVcGrant: W3CVcGrantNotification | null;
    /** Matched delegation approval request for this notification, when present. */
    delegationRequest: DelegationRequestNotification | null;
    /** Matched multisig protocol request for this notification, when present. */
    multisigRequest: MultisigRequestNotification | null;
    identifiers: readonly IdentifierSummary[];
    /** Local holder AID that can admit the grant, if the wallet owns it. */
    grantRecipient: IdentifierSummary | undefined;
    /** Local holder AID named by a W3C VC-JWT grant, if loaded. */
    w3cGrantHolder: IdentifierSummary | undefined;
    canAdmitGrant: boolean;
    canMarkRead: boolean;
    /** Local delegator AID that can approve the delegation, if available. */
    delegationApprover: IdentifierSummary | undefined;
    canApproveDelegation: boolean;
    /** Local multisig member AID that can answer the request, if available. */
    multisigMember: IdentifierSummary | undefined;
    multisigDisplayGroupAlias: string;
    multisigRequiresJoinLabel: boolean;
    /** Route-owned editable group alias draft for join-like multisig requests. */
    multisigGroupAlias: string;
    canApproveMultisig: boolean;
    setMultisigAliasDrafts: Dispatch<SetStateAction<Record<string, string>>>;
    /** Route-owned protocol commands that preserve notification action semantics. */
    admitCredentialGrant: () => void;
    markNotificationRead: () => void;
    approveDelegationRequest: () => void;
    approveMultisigRequest: () => void;
}

/**
 * Render challenge, credential, delegation, multisig, or fallback protocol details.
 */
export const NotificationProtocolPanels = ({
    notification,
    challengeRequest,
    credentialGrant,
    w3cVcGrant,
    delegationRequest,
    multisigRequest,
    identifiers,
    grantRecipient,
    w3cGrantHolder,
    canAdmitGrant,
    canMarkRead,
    delegationApprover,
    canApproveDelegation,
    multisigMember,
    multisigDisplayGroupAlias,
    multisigRequiresJoinLabel,
    multisigGroupAlias,
    canApproveMultisig,
    setMultisigAliasDrafts,
    admitCredentialGrant,
    approveDelegationRequest,
    approveMultisigRequest,
    markNotificationRead,
}: NotificationProtocolPanelsProps) => (
<>
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
            ) : w3cVcGrant !== null ? (
                <ConsolePanel
                    title="W3C VC-JWT grant"
                    eyebrow="Holder"
                    actions={
                        <StatusPill
                            label={w3cVcGrant.status}
                            tone={w3cGrantStatusTone(w3cVcGrant.status)}
                        />
                    }
                >
                    <Stack spacing={2}>
                        <Stack spacing={0.5}>
                            <TelemetryRow
                                label="Issuer AID"
                                value={w3cVcGrant.issuerAid}
                                mono
                            />
                            <TelemetryRow
                                label="Issuer DID"
                                value={w3cVcGrant.issuerDid}
                                mono
                            />
                            <TelemetryRow
                                label="Holder"
                                value={w3cGrantHolder?.name ?? 'Not available'}
                            />
                            <TelemetryRow
                                label="Holder AID"
                                value={w3cVcGrant.holderAid}
                                mono
                            />
                            <TelemetryRow
                                label="Holder DID"
                                value={w3cVcGrant.holderDid}
                                mono
                            />
                            <TelemetryRow
                                label="Source credential SAID"
                                value={w3cVcGrant.sourceCredentialSaid}
                                mono
                            />
                            <TelemetryRow
                                label="Held W3C credential"
                                value={
                                    w3cVcGrant.heldCredentialId ??
                                    'Not available'
                                }
                                mono
                            />
                            <TelemetryRow
                                label="Schema SAID"
                                value={w3cVcGrant.schemaSaid}
                                mono
                            />
                            <TelemetryRow
                                label="Issuance ID"
                                value={w3cVcGrant.issuanceId}
                                mono
                            />
                            <TelemetryRow
                                label="Grant SAID"
                                value={w3cVcGrant.grantSaid}
                                mono
                            />
                            <TelemetryRow
                                label="Profile"
                                value={w3cVcGrant.profile}
                            />
                            <TelemetryRow
                                label="Status URL"
                                value={w3cVcGrant.statusUrl}
                                mono
                            />
                            <TelemetryRow
                                label="Created"
                                value={timestampText(w3cVcGrant.createdAt)}
                            />
                            {w3cVcGrant.error !== null && (
                                <TelemetryRow
                                    label="Error"
                                    value={w3cVcGrant.error}
                                />
                            )}
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
                                data-testid="w3c-grant-notification-detail-mark-read"
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                                disabled={!canMarkRead}
                                onClick={markNotificationRead}
                            >
                                Mark read
                            </Button>
                            <Button
                                component={RouterLink}
                                to={`/credentials/${encodeURIComponent(
                                    w3cVcGrant.holderAid
                                )}/wallet`}
                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                            >
                                Open wallet
                            </Button>
                        </Stack>
                        {w3cGrantHolder === undefined && (
                            <EmptyState
                                title="Holder identifier unavailable"
                                message="This W3C grant names a holder AID that is not loaded as a local identifier in this wallet."
                            />
                        )}
                        {w3cVcGrant.vcJwt.length > 0 && (
                            <>
                                <Divider />
                                <W3CJwtArtifactDetails
                                    label="Granted VC-JWT"
                                    token={w3cVcGrant.vcJwt}
                                />
                            </>
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

</>
);
