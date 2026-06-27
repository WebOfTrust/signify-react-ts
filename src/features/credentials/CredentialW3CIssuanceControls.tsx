import { Button, Stack, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { CredentialActionData } from '../../app/routeData';
import {
    isW3CIssuableVrdCredential,
    selectCredentialW3CIssuer,
} from '../../domain/credentials/credentialPresentation';
import type { CredentialSummaryRecord } from '../../domain/credentials/credentialTypes';
import type { IdentifierSummary } from '../../domain/identifiers/identifierTypes';

interface CredentialW3CIssuanceControlsProps {
    credential: CredentialSummaryRecord;
    identifiers: readonly IdentifierSummary[];
    didWebsReadyByAid: ReadonlyMap<string, boolean>;
    actionRunning: boolean;
    issuanceAction?: CredentialActionData | null;
    onStartIssuance: (
        credential: CredentialSummaryRecord,
        issuer: IdentifierSummary
    ) => void;
}

/**
 * Issuer-side manual fallback for creating the W3C VRD VC-JWT twin.
 *
 * This control is intentionally shown on the QVI-held issuer record, not on
 * the LE-held credential. The LE can present only after the QVI starts W3C
 * issuance, KERIA delivers the W3C grant, and the holder edge imports/admites
 * exactly one eligible held W3C credential.
 */
export const CredentialW3CIssuanceControls = ({
    credential,
    identifiers,
    didWebsReadyByAid,
    actionRunning,
    issuanceAction = null,
    onStartIssuance,
}: CredentialW3CIssuanceControlsProps) => {
    const issuer = selectCredentialW3CIssuer(credential, identifiers);
    const schemaSupported = isW3CIssuableVrdCredential(credential);
    const statusIssuable =
        credential.status === 'issued' || credential.status === 'grantSent';
    const didWebsReady =
        issuer !== null && didWebsReadyByAid.get(issuer.prefix) === true;
    const issuanceActionResult =
        issuanceAction?.intent === 'startW3CIssuance'
            ? issuanceAction
            : null;

    // Keep the fallback narrow: W3C issuance needs the active native VRD and
    // the local issuer AID. DID/webs setup is performed as part of the action.
    const blocker = !schemaSupported
        ? 'Only issuer-side VRD credentials can start W3C issuance.'
        : !statusIssuable
          ? `Credential status is ${credential.status}; W3C issuance requires an active issuer-side VRD credential.`
          : issuer === null
            ? 'This wallet does not control the credential issuer AID.'
            : actionRunning
              ? 'A credential command is already running.'
              : null;
    const readyMessage = didWebsReady
        ? 'Ready to start QVI-side W3C VC-JWT issuance from this native VRD.'
        : 'DID/webs setup will run before QVI-side W3C VC-JWT issuance.';

    return (
        <Stack
            spacing={0.75}
            data-testid={`w3c-issuance-controls-${credential.said}`}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
        >
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
            >
                <Button
                    variant="outlined"
                    startIcon={<PlayArrowIcon />}
                    disabled={blocker !== null}
                    data-testid="w3c-start-issuance-button"
                    data-credential-said={credential.said}
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                    onClick={() => {
                        if (blocker === null && issuer !== null) {
                            onStartIssuance(credential, issuer);
                        }
                    }}
                >
                    Start W3C issuance
                </Button>
            </Stack>
            <Typography
                data-testid="w3c-issuance-status"
                data-credential-said={credential.said}
                data-state={blocker === null ? 'ready' : 'blocked'}
                data-issuer-aid={issuer?.prefix ?? ''}
                variant="caption"
                color={blocker === null ? 'text.secondary' : 'warning.main'}
                sx={{ overflowWrap: 'anywhere' }}
            >
                {blocker ?? readyMessage}
            </Typography>
            {issuanceActionResult !== null && (
                <Typography
                    data-testid="w3c-issuance-action-result"
                    data-credential-said={credential.said}
                    data-state={issuanceActionResult.ok ? 'accepted' : 'error'}
                    data-request-id={issuanceActionResult.requestId ?? ''}
                    data-operation-route={
                        issuanceActionResult.operationRoute ?? ''
                    }
                    variant="caption"
                    color={
                        issuanceActionResult.ok
                            ? 'success.main'
                            : 'error.main'
                    }
                    sx={{ overflowWrap: 'anywhere' }}
                >
                    {issuanceActionResult.message}
                </Typography>
            )}
        </Stack>
    );
};
