import {
    useMemo,
    useState,
    type ChangeEvent,
} from 'react';
import {
    Button,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import type { SelectChangeEvent } from '@mui/material/Select';
import { appConfig } from '../../config';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import {
    isW3CPresentableVrdCredential,
    selectW3CPresenter,
} from '../../domain/credentials/credentialPresentation';
import type { CredentialSummaryRecord } from '../../domain/credentials/credentialTypes';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';
import type { CredentialActionData } from '../../app/routeData';
import {
    buildW3CVerifierRequestJson,
    verifierPresetForSelection,
    type W3CVerifierRequestPreset,
} from '../../domain/credentials/w3cVerifierPresets';

interface W3CPresentCtrlsProps {
    credential: CredentialSummaryRecord;
    identifiers: readonly IdentifierSummary[];
    didWebsReadyByAid: ReadonlyMap<string, boolean>;
    verifiers?: readonly W3CVerifierRequestPreset[];
    selectedVerifierId: string;
    actionRunning: boolean;
    presentationAction?: CredentialActionData | null;
    onVerifierChange: (verifierId: string) => void;
    onPresent: (
        credential: CredentialSummaryRecord,
        presenter: IdentifierSummary,
        verifierRequestJson: string
    ) => void;
}

const controlId = (credentialSaid: string): string =>
    `w3c-verifier-request-${credentialSaid.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

const parseVerifierRequest = (
    value: string
): Record<string, unknown> | null => {
    try {
        const parsed = JSON.parse(value);
        return typeof parsed === 'object' &&
            parsed !== null &&
            !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
};

type VerifierRequestOverride = {
    key: string;
    value: string;
    manual: boolean;
};

/**
 * Shared W3C presentation controls for admitted VRD credentials.
 *
 * KERIA owns the presentation transaction and verifier submission workflow.
 * This component accepts a runtime verifier request descriptor instead of a
 * deployment-time verifier allowlist entry.
 */
export const W3CPresentCtrls = ({
    credential,
    identifiers,
    didWebsReadyByAid,
    verifiers = appConfig.w3cVerifiers,
    selectedVerifierId,
    actionRunning,
    presentationAction = null,
    onVerifierChange,
    onPresent,
}: W3CPresentCtrlsProps) => {
    const presenter = selectW3CPresenter(credential, identifiers);
    const availableVerifiers =
        verifiers.length > 0 ? verifiers : appConfig.w3cVerifiers;
    const selectedVerifier = verifierPresetForSelection(
        selectedVerifierId,
        availableVerifiers
    );
    const verifierRequestKey = [
        credential.said,
        selectedVerifier.id,
        selectedVerifier.publicBaseUrl,
        selectedVerifier.submissionBaseUrl,
        selectedVerifier.verifyVpPath,
    ].join('|');
    const defaultVerifierRequestJson = useMemo(
        () =>
            buildW3CVerifierRequestJson({
                preset: selectedVerifier,
                credentialSaid: credential.said,
            }),
        [credential.said, selectedVerifier]
    );
    const [verifierRequestOverride, setVerifierRequestOverride] =
        useState<VerifierRequestOverride | null>(null);
    const activeVerifierRequestOverride =
        verifierRequestOverride?.key === verifierRequestKey
            ? verifierRequestOverride
            : null;
    const verifierRequestJson =
        activeVerifierRequestOverride?.value ?? defaultVerifierRequestJson;
    const manualVerifierRequest =
        activeVerifierRequestOverride?.manual === true;
    const verifierRequest = parseVerifierRequest(verifierRequestJson);
    const buildSelectedVerifierRequestJson = () =>
        buildW3CVerifierRequestJson({
            preset: selectedVerifier,
            credentialSaid: credential.said,
        });
    const verifierLabelId = controlId(credential.said);
    const verifierSelectorLabelId = `${verifierLabelId}-selector-label`;
    const schemaSupported = isW3CPresentableVrdCredential(credential);
    const statusPresentable =
        credential.status === 'admitted' ||
        credential.status === 'issued' ||
        credential.status === 'grantSent';
    const didWebsReady =
        presenter !== null && didWebsReadyByAid.get(presenter.prefix) === true;
    const presentationActionResult =
        presentationAction?.intent === 'presentCredential'
            ? presentationAction
            : null;

    function getW3CPresentBlockerMsg(): string | null {
        if (!statusPresentable) {
            return `Credential status is ${credential.status}; W3C Present requires an active issued or admitted VRD credential.`;
        }
        if (!schemaSupported) {
            return 'Only supported VRD credentials can be presented through W3C.';
        }
        if (presenter === null) {
            return 'This wallet does not control the credential holder AID required for W3C Present.';
        }
        if (verifierRequest === null) {
            return 'Enter a valid runtime verifier request JSON object.';
        }
        if (actionRunning) {
            return 'A credential command is already running.';
        }
        return null;
    }

    const blockerMsg = getW3CPresentBlockerMsg();
    const readyMessage = didWebsReady
        ? 'Ready to create a KERIA W3C presentation transaction from this verifier request.'
        : 'DID/webs setup will run before W3C presentation.';

    function selectVerifier(
        event: SelectChangeEvent<string>
    ): void {
        const nextVerifier = verifierPresetForSelection(
            event.target.value,
            availableVerifiers
        );
        onVerifierChange(nextVerifier.id);
        setVerifierRequestOverride(null);
    }

    function verifierRequestChange(
        event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
    ): void {
        setVerifierRequestOverride({
            key: verifierRequestKey,
            value: event.target.value,
            manual: true,
        });
    }

    function presentW3C(): void {
        if (
            blockerMsg !== null ||
            presenter === null ||
            verifierRequest === null
        ) {
            return;
        }

        const requestJson = manualVerifierRequest
            ? verifierRequestJson
            : buildSelectedVerifierRequestJson();
        if (!manualVerifierRequest) {
            setVerifierRequestOverride({
                key: verifierRequestKey,
                value: requestJson,
                manual: false,
            });
        }
        onPresent(credential, presenter, requestJson);
    }

    return (
        <Stack
            spacing={0.75}
            data-testid={`w3c-presentation-controls-${credential.said}`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
        >
            <Stack spacing={1}>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel id={verifierSelectorLabelId}>
                        Verifier
                    </InputLabel>
                    <Select
                        labelId={verifierSelectorLabelId}
                        label="Verifier"
                        value={selectedVerifier.id}
                        disabled={actionRunning}
                        data-testid="w3c-verifier-selector"
                        onChange={selectVerifier}
                    >
                        {availableVerifiers.map((verifier) => (
                            <MenuItem
                                key={verifier.id}
                                value={verifier.id}
                                data-testid={`w3c-verifier-option-${verifier.id}`}
                            >
                                {verifier.label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <TextField
                    id={verifierLabelId}
                    label="Verifier request"
                    size="small"
                    data-testid="w3c-verifier-request-input"
                    value={verifierRequestJson}
                    onChange={verifierRequestChange}
                    disabled={actionRunning}
                    multiline
                    minRows={3}
                    sx={{ minWidth: { xs: '100%', sm: 320 } }}
                />
                <Button
                    variant="outlined"
                    startIcon={<SendIcon />}
                    disabled={blockerMsg !== null}
                    data-testid="w3c-present-button"
                    data-credential-said={credential.said}
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                    onClick={presentW3C}
                >
                    Present
                </Button>
            </Stack>
            <Typography
                data-testid="w3c-presentation-status"
                data-credential-said={credential.said}
                data-state={blockerMsg === null ? 'ready' : 'blocked'}
                data-presenter-aid={presenter?.prefix ?? ''}
                variant="caption"
                color={blockerMsg === null ? 'text.secondary' : 'warning.main'}
                sx={{ overflowWrap: 'anywhere' }}
            >
                {blockerMsg ?? readyMessage}
            </Typography>
            {presentationActionResult !== null && (
                <Typography
                    data-testid="w3c-presentation-action-result"
                    data-credential-said={credential.said}
                    data-state={
                        presentationActionResult.ok ? 'accepted' : 'error'
                    }
                    data-request-id={presentationActionResult.requestId ?? ''}
                    data-operation-route={
                        presentationActionResult.operationRoute ?? ''
                    }
                    variant="caption"
                    color={
                        presentationActionResult.ok
                            ? 'success.main'
                            : 'error.main'
                    }
                    sx={{ overflowWrap: 'anywhere' }}
                >
                    {presentationActionResult.message}
                </Typography>
            )}
        </Stack>
    );
};
