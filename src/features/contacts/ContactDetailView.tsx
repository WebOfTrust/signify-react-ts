import { useEffect, useState } from 'react';
import {
    Box,
    Button,
    Divider,
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import ShieldIcon from '@mui/icons-material/Shield';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
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
import { monoValueSx } from '../../app/consoleStyles';
import { formatTimestamp } from '../../app/timeFormat';
import type {
    ContactActionData,
    ContactsLoaderData,
} from '../../app/routeData';
import type { ContactRecord } from '../../state/contacts.slice';
import type { ChallengeRecord } from '../../state/challenges.slice';
import { useAppSelector } from '../../state/hooks';
import {
    selectChallengesForContact,
    selectContactById,
    selectIdentifiers,
    selectStoredChallengeWordsForContact,
} from '../../state/selectors';
import {
    contactChallengeStatus,
    contactOobiGroups,
    contactOobiRoleSummary,
} from './contactHelpers';
import type { ContactOobiGroup } from './contactHelpers';
import { parseChallengeWords, validateChallengeWords } from './challengeWords';

const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

const copyText = (value: string): void => {
    void globalThis.navigator?.clipboard?.writeText(value);
};

const resolutionTone = (
    status: ContactRecord['resolutionStatus']
): 'success' | 'warning' | 'error' | 'neutral' =>
    status === 'error'
        ? 'error'
        : status === 'resolving'
          ? 'warning'
          : status === 'resolved'
            ? 'success'
            : 'neutral';

export const ContactDetailView = () => {
    const loaderData = useLoaderData() as ContactsLoaderData;
    const { contactId = '' } = useParams();
    const navigate = useNavigate();
    const fetcher = useFetcher<ContactActionData>();
    const challengeFetcher = useFetcher<ContactActionData>();
    const responseFetcher = useFetcher<ContactActionData>();
    const contact = useAppSelector(selectContactById(contactId));
    const challenges = useAppSelector(selectChallengesForContact(contactId));
    const storedChallengeWords = useAppSelector(
        selectStoredChallengeWordsForContact(contactId)
    );
    const identifiers = useAppSelector(selectIdentifiers);
    const [aliasDraft, setAliasDraft] = useState({
        contactId,
        value: contact?.alias ?? '',
    });
    const [selectedIdentifier, setSelectedIdentifier] = useState('');
    const [responseWordsDraft, setResponseWordsDraft] = useState('');
    const actionRunning = fetcher.state !== 'idle';
    const challengeRunning = challengeFetcher.state !== 'idle';
    const responseRunning = responseFetcher.state !== 'idle';
    const activeIdentifier = selectedIdentifier || identifiers[0]?.name || '';
    const activeIdentifierSummary =
        identifiers.find(
            (identifier) => identifier.name === activeIdentifier
        ) ?? null;
    const responseWords = parseChallengeWords(responseWordsDraft);
    const responseWordsError =
        responseWordsDraft.trim().length === 0
            ? null
            : validateChallengeWords(responseWords);
    const responseWordsInvalid = validateChallengeWords(responseWords) !== null;

    useEffect(() => {
        if (fetcher.data?.ok === true && fetcher.data.intent === 'delete') {
            navigate('/contacts');
        }
    }, [fetcher.data, navigate]);

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const submitAliasUpdate = () => {
        if (contact === null) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'updateAlias');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('contactId', contact.id);
        formData.set('alias', draftAlias);
        fetcher.submit(formData, { method: 'post' });
    };

    const submitDelete = () => {
        if (contact === null) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'delete');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('contactId', contact.id);
        fetcher.submit(formData, { method: 'post' });
    };

    const submitGenerateChallenge = () => {
        if (contact === null || activeIdentifierSummary === null) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'generateChallenge');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('contactId', contact.aid ?? contact.id);
        formData.set('contactAlias', contact.alias);
        formData.set('localIdentifier', activeIdentifierSummary.name);
        formData.set('localAid', activeIdentifierSummary.prefix);
        challengeFetcher.submit(formData, { method: 'post' });
    };

    const submitRetryVerifyChallenge = (challenge: {
        challengeId: string;
        counterpartyAid: string;
        counterpartyAlias?: string | null;
        localIdentifier: string;
        localAid?: string | null;
        words: readonly string[];
        wordsHash: string;
        generatedAt: string;
    }) => {
        const formData = new FormData();
        formData.set('intent', 'verifyChallenge');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('challengeId', challenge.challengeId);
        formData.set('contactId', challenge.counterpartyAid);
        formData.set('contactAlias', challenge.counterpartyAlias ?? '');
        formData.set('localIdentifier', challenge.localIdentifier);
        formData.set('localAid', challenge.localAid ?? '');
        formData.set('words', challenge.words.join(' '));
        formData.set('wordsHash', challenge.wordsHash);
        formData.set('generatedAt', challenge.generatedAt);
        challengeFetcher.submit(formData, { method: 'post' });
    };

    const submitRespondChallenge = () => {
        if (contact === null || activeIdentifierSummary === null) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'respondChallenge');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('contactId', contact.aid ?? contact.id);
        formData.set('contactAlias', contact.alias);
        formData.set('localIdentifier', activeIdentifierSummary.name);
        formData.set('localAid', activeIdentifierSummary.prefix);
        formData.set('words', responseWordsDraft);
        responseFetcher.submit(formData, { method: 'post' });
    };

    if (contact === null) {
        return (
            <Box
                sx={{ display: 'grid', gap: 2.5 }}
                data-testid="contact-detail"
            >
                <PageHeader
                    eyebrow="Contact"
                    title="Contact not found"
                    actions={
                        <Button
                            component={RouterLink}
                            to="/contacts"
                            startIcon={<ArrowBackIcon />}
                        >
                            Back to contacts
                        </Button>
                    }
                />
                <EmptyState
                    title="No contact record"
                    message="The contact may have been deleted or has not synced into this session yet."
                />
            </Box>
        );
    }

    const roleSummary = contactOobiRoleSummary(contact);
    const oobiGroups = contactOobiGroups(contact);
    const challengeStatus = contactChallengeStatus(contact);
    const Shield =
        challengeStatus.status === 'verified' ? ShieldIcon : ShieldOutlinedIcon;
    const shieldColor =
        challengeStatus.status === 'verified'
            ? 'success.main'
            : challengeStatus.status === 'pending'
              ? 'warning.main'
              : 'text.disabled';
    const aid = contact.aid ?? contact.id;
    const draftAlias =
        aliasDraft.contactId === contact.id ? aliasDraft.value : contact.alias;
    const generatedChallengeCandidate =
        challengeFetcher.data?.ok === true &&
        challengeFetcher.data.intent === 'generateChallenge'
            ? challengeFetcher.data.challenge
            : null;
    const generatedChallengeVerified =
        generatedChallengeCandidate !== null &&
        challenges.some(
            (challenge) =>
                (challenge.id === generatedChallengeCandidate.challengeId ||
                    challenge.wordsHash ===
                        generatedChallengeCandidate.wordsHash) &&
                (challenge.authenticated || challenge.status === 'verified')
        );
    const generatedChallenge = generatedChallengeVerified
        ? null
        : generatedChallengeCandidate;
    const generatedChallengePhrase =
        generatedChallenge === null ? null : generatedChallenge.words.join(' ');
    const savedChallengeWords = storedChallengeWords.filter(
        (record) => record.challengeId !== generatedChallenge?.challengeId
    );
    const canUseChallenge = activeIdentifierSummary !== null && aid.length > 0;

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }} data-testid="contact-detail">
            <PageHeader
                eyebrow={roleSummary.label}
                title={contact.alias}
                summary={aid}
                actions={
                    <Button
                        component={RouterLink}
                        to="/contacts"
                        startIcon={<ArrowBackIcon />}
                    >
                        Back to contacts
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
            {fetcher.data !== undefined && <ActionNotice data={fetcher.data} />}
            {challengeFetcher.data !== undefined && (
                <ActionNotice data={challengeFetcher.data} />
            )}
            {responseFetcher.data !== undefined && (
                <ActionNotice data={responseFetcher.data} />
            )}
            <ConsolePanel
                title="Contact details"
                eyebrow="KERIA"
                actions={
                    <Stack direction="row" spacing={1}>
                        <Tooltip title={challengeStatus.tooltip}>
                            <Box
                                sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 0.75,
                                }}
                            >
                                <Shield
                                    aria-label={challengeStatus.label}
                                    sx={{ color: shieldColor }}
                                />
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {challengeStatus.label}
                                </Typography>
                            </Box>
                        </Tooltip>
                        <StatusPill
                            label={contact.resolutionStatus}
                            tone={resolutionTone(contact.resolutionStatus)}
                        />
                    </Stack>
                }
            >
                <Stack spacing={2}>
                    <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{ alignItems: { xs: 'stretch', sm: 'center' } }}
                    >
                        <TextField
                            label="Alias"
                            value={draftAlias}
                            onChange={(event) => {
                                setAliasDraft({
                                    contactId: contact.id,
                                    value: event.target.value,
                                });
                            }}
                            fullWidth
                            size="small"
                        />
                        <Tooltip title="Save alias">
                            <span>
                                <IconButton
                                    aria-label="save alias"
                                    disabled={
                                        actionRunning ||
                                        draftAlias.trim().length === 0 ||
                                        draftAlias === contact.alias
                                    }
                                    onClick={submitAliasUpdate}
                                >
                                    <SaveIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Delete contact">
                            <span>
                                <IconButton
                                    aria-label="delete contact"
                                    color="error"
                                    disabled={actionRunning}
                                    onClick={submitDelete}
                                >
                                    <DeleteIcon />
                                </IconButton>
                            </span>
                        </Tooltip>
                    </Stack>
                    <TelemetryRow label="AID" value={aid} mono />
                    <TelemetryRow label="OOBI type" value={roleSummary.label} />
                    <TelemetryRow
                        label="Updated"
                        value={timestampText(contact.updatedAt)}
                    />
                    <TelemetryRow
                        label="Challenges"
                        value={`${contact.authenticatedChallengeCount}/${contact.challengeCount} authenticated`}
                    />
                    {contact.error !== null && (
                        <Typography color="error" variant="body2">
                            {contact.error}
                        </Typography>
                    )}
                    {oobiGroups.length > 0 && (
                        <FullOobiBlock groups={oobiGroups} />
                    )}
                </Stack>
            </ConsolePanel>
            <ConsolePanel
                title="Challenge and response"
                eyebrow="Trust"
                actions={
                    <Tooltip title={challengeStatus.tooltip}>
                        <Box
                            sx={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 0.75,
                            }}
                        >
                            <Shield
                                aria-label={challengeStatus.label}
                                sx={{ color: shieldColor }}
                            />
                            <Typography
                                variant="caption"
                                color="text.secondary"
                            >
                                {challengeStatus.label}
                            </Typography>
                        </Box>
                    </Tooltip>
                }
            >
                <Stack spacing={2}>
                    <FormControl fullWidth disabled={identifiers.length === 0}>
                        <InputLabel id="challenge-identifier-label">
                            Identifier
                        </InputLabel>
                        <Select
                            labelId="challenge-identifier-label"
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
                            gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                            gap: 2,
                        }}
                    >
                        <Box
                            sx={{
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                p: 1.5,
                                minWidth: 0,
                            }}
                        >
                            <Stack spacing={1.5}>
                                <Typography
                                    variant="caption"
                                    color="primary.main"
                                    sx={{
                                        display: 'block',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Generate challenge
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<ShieldOutlinedIcon />}
                                    disabled={
                                        !canUseChallenge || challengeRunning
                                    }
                                    onClick={submitGenerateChallenge}
                                    data-testid="challenge-generate-submit"
                                >
                                    Generate challenge
                                </Button>
                                {generatedChallengePhrase !== null && (
                                    <CopyBlock
                                        label="Challenge words"
                                        value={generatedChallengePhrase}
                                        valueTestId="challenge-generated-words"
                                    />
                                )}
                                {generatedChallenge !== null && (
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        Waiting operation{' '}
                                        {generatedChallenge.challengeId}
                                    </Typography>
                                )}
                                {savedChallengeWords.length > 0 && (
                                    <Stack spacing={1}>
                                        <Divider />
                                        <Typography
                                            variant="caption"
                                            color="primary.main"
                                            sx={{
                                                display: 'block',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                            }}
                                        >
                                            Saved challenge words
                                        </Typography>
                                        {savedChallengeWords.map((record) => (
                                            <Box
                                                key={record.challengeId}
                                                data-testid="saved-challenge-words"
                                                sx={{
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    borderRadius: 1,
                                                    p: 1,
                                                }}
                                            >
                                                <Stack spacing={1}>
                                                    <Stack
                                                        direction="row"
                                                        spacing={1}
                                                        sx={{
                                                            alignItems:
                                                                'center',
                                                            justifyContent:
                                                                'space-between',
                                                            gap: 1,
                                                        }}
                                                    >
                                                        <StatusPill
                                                            label={
                                                                record.status
                                                            }
                                                            tone={
                                                                record.status ===
                                                                'failed'
                                                                    ? 'warning'
                                                                    : 'info'
                                                            }
                                                        />
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                        >
                                                            {timestampText(
                                                                record.updatedAt
                                                            )}
                                                        </Typography>
                                                    </Stack>
                                                    <CopyBlock
                                                        label="Challenge words"
                                                        value={record.words.join(
                                                            ' '
                                                        )}
                                                        valueTestId="saved-challenge-generated-words"
                                                    />
                                                    <Button
                                                        variant="outlined"
                                                        startIcon={
                                                            <ShieldOutlinedIcon />
                                                        }
                                                        disabled={
                                                            challengeRunning
                                                        }
                                                        data-testid="saved-challenge-retry-verify"
                                                        onClick={() =>
                                                            submitRetryVerifyChallenge(
                                                                record
                                                            )
                                                        }
                                                    >
                                                        Retry verification
                                                    </Button>
                                                </Stack>
                                            </Box>
                                        ))}
                                    </Stack>
                                )}
                            </Stack>
                        </Box>
                        <Box
                            sx={{
                                border: 1,
                                borderColor: 'divider',
                                borderRadius: 1,
                                p: 1.5,
                                minWidth: 0,
                            }}
                        >
                            <Stack spacing={1.5}>
                                <Typography
                                    variant="caption"
                                    color="primary.main"
                                    sx={{
                                        display: 'block',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Respond to challenge
                                </Typography>
                                <TextField
                                    label="Challenge words"
                                    value={responseWordsDraft}
                                    onChange={(event) => {
                                        setResponseWordsDraft(
                                            event.target.value
                                        );
                                    }}
                                    minRows={3}
                                    multiline
                                    fullWidth
                                    error={responseWordsError !== null}
                                    helperText={
                                        responseWordsError ??
                                        `${responseWords.length} words`
                                    }
                                    data-testid="challenge-response-input"
                                />
                                <Button
                                    variant="contained"
                                    startIcon={<SendIcon />}
                                    disabled={
                                        !canUseChallenge ||
                                        responseRunning ||
                                        responseWordsInvalid
                                    }
                                    onClick={submitRespondChallenge}
                                    data-testid="challenge-response-submit"
                                >
                                    Respond to challenge
                                </Button>
                            </Stack>
                        </Box>
                    </Box>
                </Stack>
            </ConsolePanel>
            <ConsolePanel title="Endpoints" eyebrow="Roles">
                {contact.endpoints.length === 0 ? (
                    <EmptyState
                        title="No endpoints"
                        message="This contact does not expose endpoint role records yet."
                    />
                ) : (
                    <Stack spacing={1}>
                        {contact.endpoints.map((endpoint) => (
                            <Box
                                key={`${endpoint.role}:${endpoint.eid}:${endpoint.url}`}
                                sx={{
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    px: 1.25,
                                    py: 1,
                                }}
                            >
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        mb: 0.75,
                                    }}
                                >
                                    <StatusPill
                                        label={endpoint.role}
                                        tone="info"
                                    />
                                    <Typography variant="body2">
                                        {endpoint.scheme}
                                    </Typography>
                                </Stack>
                                <CopyBlock
                                    label="Endpoint URL"
                                    value={endpoint.url}
                                />
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={monoValueSx}
                                >
                                    {endpoint.eid}
                                </Typography>
                            </Box>
                        ))}
                    </Stack>
                )}
            </ConsolePanel>
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                    gap: 2,
                }}
            >
                <ConsolePanel title="Well-knowns" eyebrow="OOBI">
                    {contact.wellKnowns.length === 0 ? (
                        <EmptyState
                            title="No well-knowns"
                            message="No well-known OOBI records are attached to this contact."
                        />
                    ) : (
                        <Stack spacing={1}>
                            {contact.wellKnowns.map((wellKnown) => (
                                <Box
                                    key={`${contact.id}:${wellKnown.url}`}
                                    sx={{
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        px: 1.25,
                                        py: 1,
                                    }}
                                >
                                    <CopyBlock
                                        label="Well-known URL"
                                        value={wellKnown.url}
                                    />
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        {timestampText(wellKnown.dt)}
                                    </Typography>
                                </Box>
                            ))}
                        </Stack>
                    )}
                </ConsolePanel>
                <ConsolePanel title="Challenges" eyebrow="Verification">
                    {challenges.length === 0 ? (
                        <EmptyState
                            title="No challenges"
                            message="No challenge responses are known for this contact."
                        />
                    ) : (
                        <Stack spacing={1}>
                            {challenges.map((challenge) => (
                                <ChallengeBlock
                                    key={challenge.id}
                                    challenge={challenge}
                                />
                            ))}
                        </Stack>
                    )}
                </ConsolePanel>
            </Box>
        </Box>
    );
};

const ActionNotice = ({ data }: { data: ContactActionData }) => (
    <Box
        sx={{
            border: 1,
            borderColor: data.ok ? 'divider' : 'error.main',
            borderRadius: 1,
            bgcolor: data.ok
                ? 'rgba(39, 215, 255, 0.06)'
                : 'rgba(255, 61, 79, 0.08)',
            px: 2,
            py: 1.25,
        }}
    >
        <StatusPill
            label={data.ok ? 'accepted' : 'error'}
            tone={data.ok ? 'success' : 'error'}
        />{' '}
        <Typography component="span">{data.message}</Typography>
    </Box>
);

const CopyBlock = ({
    label,
    value,
    valueTestId,
}: {
    label: string;
    value: string;
    valueTestId?: string;
}) => (
    <Box
        sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 1,
            alignItems: 'start',
            minWidth: 0,
        }}
    >
        <Box sx={{ minWidth: 0 }}>
            <Typography
                variant="caption"
                color="primary.main"
                sx={{
                    display: 'block',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                }}
            >
                {label}
            </Typography>
            <Typography
                variant="body2"
                sx={monoValueSx}
                data-testid={valueTestId}
            >
                {value}
            </Typography>
        </Box>
        <Tooltip title={`Copy ${label}`}>
            <IconButton
                size="small"
                aria-label={`copy ${label}`}
                onClick={() => {
                    copyText(value);
                }}
            >
                <ContentCopyIcon fontSize="small" />
            </IconButton>
        </Tooltip>
    </Box>
);

const FullOobiBlock = ({ groups }: { groups: readonly ContactOobiGroup[] }) => (
    <Box sx={{ display: 'grid', gap: 1 }}>
        <Typography
            variant="caption"
            color="primary.main"
            sx={{
                display: 'block',
                fontWeight: 700,
                textTransform: 'uppercase',
            }}
        >
            Full OOBI
        </Typography>
        <Stack spacing={1.25}>
            {groups.map((group) => (
                <Box
                    key={group.role}
                    sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        px: 1.25,
                        py: 1,
                    }}
                >
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: 'block',
                            fontWeight: 700,
                            mb: 0.75,
                            textTransform: 'uppercase',
                        }}
                    >
                        {group.label}
                    </Typography>
                    <Stack spacing={1}>
                        {group.oobis.map((oobi) => (
                            <CopyBlock
                                key={`${group.role}:${oobi}`}
                                label="OOBI URL"
                                value={oobi}
                            />
                        ))}
                    </Stack>
                </Box>
            ))}
        </Stack>
    </Box>
);

const ChallengeBlock = ({ challenge }: { challenge: ChallengeRecord }) => (
    <Box
        sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 1,
            px: 1.25,
            py: 1,
        }}
    >
        <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center', flexWrap: 'wrap' }}
        >
            <StatusPill
                label={challenge.status}
                tone={challenge.authenticated ? 'success' : 'warning'}
            />
            <Typography variant="caption" color="text.secondary">
                {timestampText(challenge.updatedAt)}
            </Typography>
        </Stack>
        <Divider sx={{ my: 1 }} />
        <TelemetryRow label="Words" value={`${challenge.words.length} words`} />
        <TelemetryRow
            label="Result"
            value={challenge.result ?? 'Not available'}
            mono
        />
    </Box>
);
