import { useMemo, useState } from 'react';
import {
    Box,
    Button,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import { useFetcher } from 'react-router-dom';
import type { ContactActionData } from '../../app/routeData';
import type { IdentifierSummary } from '../identifiers/identifierTypes';
import type { ChallengeRequestNotification } from '../../state/notifications.slice';
import {
    parseChallengeWords,
    validateChallengeWords,
} from '../contacts/challengeWords';
import { defaultChallengeResponseIdentifierName } from './challengeRequestFormHelpers';

const createRequestId = (): string =>
    globalThis.crypto?.randomUUID?.() ??
    `challenge-response-${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Props for responding to a hydrated challenge request notification.
 */
export interface ChallengeRequestResponseFormProps {
    request: ChallengeRequestNotification;
    identifiers: readonly IdentifierSummary[];
    action?: string;
    dense?: boolean;
}

/**
 * Form that signs pasted challenge words with a selected local identifier.
 */
export const ChallengeRequestResponseForm = ({
    request,
    identifiers,
    action = '/notifications',
    dense = false,
}: ChallengeRequestResponseFormProps) => {
    const fetcher = useFetcher<ContactActionData>();
    const [requestId] = useState(createRequestId);
    const [selectedIdentifier, setSelectedIdentifier] = useState('');
    const [wordsDraft, setWordsDraft] = useState('');
    const defaultIdentifier = defaultChallengeResponseIdentifierName(
        { recipientAid: request.recipientAid },
        identifiers
    );
    const activeIdentifier = selectedIdentifier || defaultIdentifier;
    const activeIdentifierSummary =
        identifiers.find(
            (identifier) => identifier.name === activeIdentifier
        ) ?? null;
    const words = useMemo(() => parseChallengeWords(wordsDraft), [wordsDraft]);
    const wordsError =
        wordsDraft.trim().length === 0 ? null : validateChallengeWords(words);
    const wordsInvalid = validateChallengeWords(words) !== null;
    const running = fetcher.state !== 'idle';
    const actionable = request.status === 'actionable';
    const disabled =
        !actionable ||
        running ||
        activeIdentifierSummary === null ||
        wordsInvalid;

    return (
        <fetcher.Form method="post" action={action}>
            <Stack spacing={dense ? 1 : 1.5}>
                <input type="hidden" name="intent" value="respondChallenge" />
                <input type="hidden" name="requestId" value={requestId} />
                <input
                    type="hidden"
                    name="notificationId"
                    value={request.notificationId}
                />
                <input
                    type="hidden"
                    name="challengeId"
                    value={request.challengeId}
                />
                <input
                    type="hidden"
                    name="wordsHash"
                    value={request.wordsHash}
                />
                <input
                    type="hidden"
                    name="contactId"
                    value={request.senderAid}
                />
                <input
                    type="hidden"
                    name="contactAlias"
                    value={request.senderAlias}
                />
                <input
                    type="hidden"
                    name="localIdentifier"
                    value={activeIdentifierSummary?.name ?? ''}
                />
                <input
                    type="hidden"
                    name="localAid"
                    value={activeIdentifierSummary?.prefix ?? ''}
                />
                <FormControl
                    fullWidth
                    size={dense ? 'small' : 'medium'}
                    disabled={!actionable || identifiers.length === 0}
                >
                    <InputLabel
                        id={`challenge-request-identifier-${request.notificationId}`}
                    >
                        Identifier
                    </InputLabel>
                    <Select
                        labelId={`challenge-request-identifier-${request.notificationId}`}
                        label="Identifier"
                        value={activeIdentifier}
                        onChange={(event) => {
                            setSelectedIdentifier(event.target.value);
                        }}
                    >
                        {identifiers.map((identifier) => (
                            <MenuItem
                                key={identifier.name}
                                value={identifier.name}
                            >
                                {identifier.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: dense
                            ? 'minmax(0, 1fr) auto'
                            : 'minmax(0, 1fr)',
                        gap: 1,
                        alignItems: 'start',
                    }}
                >
                    <TextField
                        name="words"
                        label="Challenge words"
                        value={wordsDraft}
                        onChange={(event) => {
                            setWordsDraft(event.target.value);
                        }}
                        minRows={dense ? 2 : 6}
                        multiline
                        fullWidth
                        error={wordsError !== null}
                        helperText={wordsError ?? `${words.length} words`}
                        disabled={!actionable || running}
                        data-testid="challenge-notification-response-input"
                    />
                    {dense ? (
                        <Tooltip title="Send response">
                            <span>
                                <IconButton
                                    type="submit"
                                    color="primary"
                                    aria-label="send challenge response"
                                    disabled={disabled}
                                    data-testid="challenge-notification-response-submit"
                                    sx={{
                                        width: 40,
                                        height: 40,
                                        border: 1,
                                        borderColor: 'divider',
                                    }}
                                >
                                    <SendIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    ) : (
                        <Button
                            type="submit"
                            variant="contained"
                            startIcon={<SendIcon />}
                            disabled={disabled}
                            data-testid="challenge-notification-response-submit"
                        >
                            Send response
                        </Button>
                    )}
                </Box>
                {fetcher.data !== undefined && (
                    <Typography
                        variant="body2"
                        color={fetcher.data.ok ? 'success.main' : 'error.main'}
                    >
                        {fetcher.data.message}
                    </Typography>
                )}
            </Stack>
        </fetcher.Form>
    );
};
