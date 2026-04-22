import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    FormControl,
    IconButton,
    InputLabel,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Select,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import LinkIcon from '@mui/icons-material/Link';
import ShieldIcon from '@mui/icons-material/Shield';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import {
    Link as RouterLink,
    useFetcher,
    useLoaderData,
} from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import {
    ConsolePanel,
    EmptyState,
    PageHeader,
    StatusPill,
} from '../../app/Console';
import { clickablePanelSx, monoValueSx } from '../../app/consoleStyles';
import { formatTimestamp } from '../../app/timeFormat';
import type {
    ContactActionData,
    ContactsLoaderData,
} from '../../app/routeData';
import type { ContactRecord } from '../../state/contacts.slice';
import { useAppSelector } from '../../state/hooks';
import {
    selectContacts,
    selectGeneratedOobis,
    selectIdentifiers,
} from '../../state/selectors';
import {
    abbreviateMiddle,
    aliasFromOobi,
    contactChallengeStatus,
    contactOobiRoleSummary,
    identifierAvailableOobiRoles,
    isWitnessContact,
    type OobiGenerationRole,
} from './contactHelpers';

const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

const copyText = (value: string): void => {
    void globalThis.navigator?.clipboard?.writeText(value);
};

const contactDetailPath = (contactId: string): string =>
    `/contacts/${encodeURIComponent(contactId)}`;

const byAlias = (left: ContactRecord, right: ContactRecord): number =>
    left.alias.localeCompare(right.alias, undefined, {
        sensitivity: 'base',
        numeric: true,
    }) ||
    (left.aid ?? left.id).localeCompare(right.aid ?? right.id, undefined, {
        sensitivity: 'base',
        numeric: true,
    });

const roleOptionLabel = (role: OobiGenerationRole): string =>
    role === 'agent' ? 'Agent' : 'Witness';

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

export const ContactsView = () => {
    const loaderData = useLoaderData() as ContactsLoaderData;
    const fetcher = useFetcher<ContactActionData>();
    const identifiers = useAppSelector(selectIdentifiers);
    const contacts = useAppSelector(selectContacts);
    const generatedOobis = useAppSelector(selectGeneratedOobis);
    const [oobi, setOobi] = useState('');
    const [alias, setAlias] = useState('');
    const [aliasTouched, setAliasTouched] = useState(false);
    const [selectedIdentifier, setSelectedIdentifier] = useState('');
    const [selectedRole, setSelectedRole] =
        useState<OobiGenerationRole>('agent');
    const [pendingGenerateCopy, setPendingGenerateCopy] = useState<{
        id: string;
        submittedAt: string;
    } | null>(null);
    const [pendingResolveClear, setPendingResolveClear] = useState<{
        oobi: string;
        alias: string;
        submittedAt: string;
    } | null>(null);
    const autoCopiedGeneratedOobis = useRef(new Set<string>());
    const actionRunning = fetcher.state !== 'idle';
    const activeIdentifier = selectedIdentifier || identifiers[0]?.name || '';
    const activeIdentifierSummary =
        identifiers.find((identifier) => identifier.name === activeIdentifier) ??
        null;
    const roleOptions = useMemo(
        () => identifierAvailableOobiRoles(activeIdentifierSummary),
        [activeIdentifierSummary]
    );
    const effectiveRole = roleOptions.includes(selectedRole)
        ? selectedRole
        : (roleOptions[0] ?? 'agent');
    const roleSelectValue = roleOptions.length === 0 ? '' : effectiveRole;
    const effectiveAlias = aliasTouched ? alias : (aliasFromOobi(oobi) ?? '');
    const sortedContacts = useMemo(
        () => [...contacts].sort(byAlias),
        [contacts]
    );
    const regularContacts = sortedContacts.filter(
        (contact) => !isWitnessContact(contact)
    );
    const witnessContacts = sortedContacts.filter(isWitnessContact);

    useEffect(() => {
        if (pendingGenerateCopy === null) {
            return undefined;
        }

        const record = generatedOobis.find(
            (candidate) =>
                candidate.id === pendingGenerateCopy.id &&
                candidate.generatedAt >= pendingGenerateCopy.submittedAt
        );
        const firstOobi = record?.oobis[0];
        if (record === undefined || firstOobi === undefined) {
            return undefined;
        }

        const copyKey = `${record.id}:${record.generatedAt}:${firstOobi}`;
        if (autoCopiedGeneratedOobis.current.has(copyKey)) {
            return undefined;
        }

        autoCopiedGeneratedOobis.current.add(copyKey);
        copyText(firstOobi);
        const clearPending = globalThis.setTimeout(() => {
            setPendingGenerateCopy(null);
        }, 0);

        return () => {
            globalThis.clearTimeout(clearPending);
        };
    }, [generatedOobis, pendingGenerateCopy]);

    useEffect(() => {
        if (pendingResolveClear === null) {
            return undefined;
        }

        const resolved = contacts.some(
            (contact) =>
                contact.resolutionStatus === 'resolved' &&
                (contact.oobi === pendingResolveClear.oobi ||
                    (pendingResolveClear.alias.length > 0 &&
                        contact.alias === pendingResolveClear.alias)) &&
                (contact.updatedAt ?? '') >= pendingResolveClear.submittedAt
        );
        if (!resolved) {
            return undefined;
        }

        const clearForm = globalThis.setTimeout(() => {
            setOobi('');
            setAlias('');
            setAliasTouched(false);
            setPendingResolveClear(null);
        }, 0);

        return () => {
            globalThis.clearTimeout(clearForm);
        };
    }, [contacts, pendingResolveClear]);

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const actionStatus =
        fetcher.data === undefined
            ? loaderData.status === 'error'
                ? { ok: false, message: loaderData.message }
                : null
            : fetcher.data;

    const submitResolve = () => {
        const submittedAt = new Date().toISOString();
        const requestId = globalThis.crypto.randomUUID();
        const formData = new FormData();
        formData.set('intent', 'resolve');
        formData.set('requestId', requestId);
        formData.set('oobi', oobi);
        formData.set('alias', effectiveAlias);
        setPendingResolveClear({
            oobi: oobi.trim(),
            alias: effectiveAlias.trim(),
            submittedAt,
        });
        fetcher.submit(formData, { method: 'post' });
    };

    const submitGenerate = () => {
        const submittedAt = new Date().toISOString();
        const requestId = globalThis.crypto.randomUUID();
        const formData = new FormData();
        formData.set('intent', 'generateOobi');
        formData.set('requestId', requestId);
        formData.set('identifier', activeIdentifier);
        formData.set('role', effectiveRole);
        setPendingGenerateCopy({
            id: `${activeIdentifier}:${effectiveRole}`,
            submittedAt,
        });
        fetcher.submit(formData, { method: 'post' });
    };

    const submitDelete = (contactId: string) => {
        const formData = new FormData();
        formData.set('intent', 'delete');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('contactId', contactId);
        fetcher.submit(formData, { method: 'post' });
    };

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }} data-testid="contacts-view">
            <PageHeader
                eyebrow="OOBI"
                title="Contacts"
                summary="Generate local identifier OOBIs, resolve remote OOBIs, and manage KERIA contacts."
            />
            {actionStatus !== null && (
                <Box
                    sx={{
                        border: 1,
                        borderColor: actionStatus.ok ? 'divider' : 'error.main',
                        borderRadius: 1,
                        bgcolor: actionStatus.ok
                            ? 'rgba(39, 215, 255, 0.06)'
                            : 'rgba(255, 61, 79, 0.08)',
                        px: 2,
                        py: 1.25,
                    }}
                >
                    <StatusPill
                        label={actionStatus.ok ? 'accepted' : 'error'}
                        tone={actionStatus.ok ? 'success' : 'error'}
                    />{' '}
                    <Typography component="span">{actionStatus.message}</Typography>
                </Box>
            )}
            <Box
                sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
                    gap: 2,
                }}
            >
                <ConsolePanel title="Resolve OOBI" eyebrow="Remote">
                    <Stack spacing={2}>
                        <TextField
                            label="OOBI URL"
                            value={oobi}
                            onChange={(event) => {
                                setOobi(event.target.value);
                            }}
                            fullWidth
                            multiline
                            minRows={2}
                            data-testid="contact-oobi-input"
                        />
                        <TextField
                            label="Alias"
                            value={effectiveAlias}
                            onChange={(event) => {
                                setAliasTouched(true);
                                setAlias(event.target.value);
                            }}
                            fullWidth
                            data-testid="contact-alias-input"
                        />
                        <Button
                            variant="contained"
                            startIcon={<LinkIcon />}
                            onClick={submitResolve}
                            disabled={actionRunning || oobi.trim().length === 0}
                            data-testid="contact-resolve-submit"
                        >
                            Resolve OOBI
                        </Button>
                    </Stack>
                </ConsolePanel>
                <ConsolePanel title="Generate OOBI" eyebrow="Local">
                    <Stack spacing={2}>
                        <FormControl fullWidth disabled={identifiers.length === 0}>
                            <InputLabel id="identifier-oobi-label">
                                Identifier
                            </InputLabel>
                            <Select
                                labelId="identifier-oobi-label"
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
                        <FormControl
                            fullWidth
                            disabled={roleOptions.length <= 1}
                        >
                            <InputLabel id="oobi-role-label">Role</InputLabel>
                            <Select
                                labelId="oobi-role-label"
                                label="Role"
                                value={roleSelectValue}
                                onChange={(event) => {
                                    const nextRole =
                                        event.target.value === 'witness'
                                            ? 'witness'
                                            : 'agent';
                                    setSelectedRole(nextRole);
                                }}
                            >
                                {roleOptions.map((role) => (
                                    <MenuItem key={role} value={role}>
                                        {roleOptionLabel(role)}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <Button
                            variant="contained"
                            startIcon={<LinkIcon />}
                            onClick={submitGenerate}
                            disabled={
                                actionRunning ||
                                activeIdentifier.length === 0 ||
                                roleOptions.length === 0
                            }
                        >
                            Generate OOBI
                        </Button>
                        {generatedOobis.length > 0 && (
                            <List disablePadding>
                                {generatedOobis.map((record) => (
                                    <ListItem
                                        key={record.id}
                                        disableGutters
                                        sx={{ alignItems: 'flex-start' }}
                                        data-testid="generated-oobi"
                                    >
                                        <ListItemText
                                            primary={`${record.identifier} ${record.role}`}
                                            secondary={
                                                <Stack spacing={0.75}>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                    >
                                                        {timestampText(
                                                            record.generatedAt
                                                        )}
                                                    </Typography>
                                                    {record.oobis.map(
                                                        (generated) => (
                                                            <Stack
                                                                key={generated}
                                                                direction="row"
                                                                spacing={1}
                                                                sx={{
                                                                    alignItems:
                                                                        'flex-start',
                                                                }}
                                                            >
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{
                                                                        ...monoValueSx,
                                                                        flex: 1,
                                                                    }}
                                                                >
                                                                    {generated}
                                                                </Typography>
                                                                <Tooltip title="Copy">
                                                                    <IconButton
                                                                        size="small"
                                                                        aria-label="copy OOBI"
                                                                        onClick={() => {
                                                                            copyText(
                                                                                generated
                                                                            );
                                                                        }}
                                                                    >
                                                                        <ContentCopyIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Stack>
                                                        )
                                                    )}
                                                </Stack>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </Stack>
                </ConsolePanel>
            </Box>
            <ConsolePanel title="Contact inventory" eyebrow="KERIA">
                {contacts.length === 0 ? (
                    <EmptyState
                        title="No contacts"
                        message="Resolved OOBIs and known components appear here."
                    />
                ) : (
                    <Stack spacing={2}>
                        {regularContacts.length === 0 ? (
                            <Typography color="text.secondary">
                                Only witness contacts are currently known. Expand
                                the witnesses section below to inspect them.
                            </Typography>
                        ) : (
                            <ContactGrid
                                contacts={regularContacts}
                                actionRunning={actionRunning}
                                onDelete={submitDelete}
                            />
                        )}
                        {witnessContacts.length > 0 && (
                            <Accordion
                                disableGutters
                                data-testid="witness-contacts-accordion"
                                sx={{
                                    border: 1,
                                    borderColor: 'divider',
                                    borderRadius: 1,
                                    bgcolor: 'rgba(5, 9, 13, 0.34)',
                                    '&:before': { display: 'none' },
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    aria-controls="witness-contacts-content"
                                    id="witness-contacts-header"
                                >
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="subtitle1">
                                            Witnesses
                                        </Typography>
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                        >
                                            {witnessContacts.length} known witness
                                            {witnessContacts.length === 1
                                                ? ''
                                                : 'es'}
                                        </Typography>
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails
                                    id="witness-contacts-content"
                                    sx={{ pt: 0 }}
                                >
                                    <ContactGrid
                                        contacts={witnessContacts}
                                        actionRunning={actionRunning}
                                        onDelete={submitDelete}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        )}
                    </Stack>
                )}
            </ConsolePanel>
        </Box>
    );
};

const ContactGrid = ({
    contacts,
    actionRunning,
    onDelete,
}: {
    contacts: readonly ContactRecord[];
    actionRunning: boolean;
    onDelete: (contactId: string) => void;
}) => (
    <Box
        sx={{
            display: 'grid',
            gridTemplateColumns: {
                xs: '1fr',
                lg: 'repeat(2, minmax(0, 1fr))',
                xl: 'repeat(3, minmax(0, 1fr))',
            },
            gap: 1,
        }}
        data-testid="contact-list"
    >
        {contacts.map((contact) => (
            <ContactCard
                key={`${contact.id}:${contact.alias}`}
                contact={contact}
                actionRunning={actionRunning}
                onDelete={onDelete}
            />
        ))}
    </Box>
);

const ContactCard = ({
    contact,
    actionRunning,
    onDelete,
}: {
    contact: ContactRecord;
    actionRunning: boolean;
    onDelete: (contactId: string) => void;
}) => {
    const roleSummary = contactOobiRoleSummary(contact);
    const challengeStatus = contactChallengeStatus(contact);
    const Shield = challengeStatus.status === 'verified' ? ShieldIcon : ShieldOutlinedIcon;
    const shieldColor =
        challengeStatus.status === 'verified'
            ? 'success.main'
            : challengeStatus.status === 'pending'
              ? 'warning.main'
              : 'text.disabled';
    const aid = contact.aid ?? contact.id;

    return (
        <Box
            sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'minmax(0, 1fr) auto' },
                minWidth: 0,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'rgba(5, 9, 13, 0.34)',
                overflow: 'hidden',
            }}
            data-testid="contact-card"
        >
            <Box
                component={RouterLink}
                to={contactDetailPath(contact.id)}
                data-testid="contact-card-link"
                sx={[
                    {
                        display: 'grid',
                        gap: 0.75,
                        minWidth: 0,
                        p: 1.25,
                        border: 1,
                        borderColor: 'transparent',
                        borderRadius: 0,
                    },
                    clickablePanelSx,
                    {
                        '&:hover': {
                            ...clickablePanelSx['&:hover'],
                            transform: 'none',
                        },
                    },
                ]}
            >
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        minWidth: 0,
                    }}
                >
                    <Box sx={{ minWidth: 0 }}>
                        <Typography
                            variant="subtitle1"
                            sx={{ overflowWrap: 'anywhere', lineHeight: 1.2 }}
                        >
                            {contact.alias}
                        </Typography>
                        <Typography
                            variant="caption"
                            color="primary.main"
                            sx={{ fontWeight: 700, textTransform: 'uppercase' }}
                        >
                            {roleSummary.label}
                        </Typography>
                    </Box>
                    <Tooltip title={challengeStatus.tooltip}>
                        <Shield
                            aria-label={challengeStatus.label}
                            fontSize="small"
                            sx={{ color: shieldColor, flex: '0 0 auto', mt: 0.25 }}
                        />
                    </Tooltip>
                </Stack>
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={monoValueSx}
                >
                    {abbreviateMiddle(aid, 36)}
                </Typography>
                {contact.oobi !== null && (
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={monoValueSx}
                    >
                        {abbreviateMiddle(contact.oobi, 44)}
                    </Typography>
                )}
                <Stack
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: 'center', flexWrap: 'wrap' }}
                >
                    <StatusPill
                        label={contact.resolutionStatus}
                        tone={resolutionTone(contact.resolutionStatus)}
                    />
                    <Typography variant="caption" color="text.secondary">
                        {contact.endpoints.length} endpoints ·{' '}
                        {contact.wellKnowns.length} well-knowns
                    </Typography>
                </Stack>
            </Box>
            <Stack
                direction={{ xs: 'row', sm: 'column' }}
                spacing={0.5}
                sx={{
                    justifyContent: 'center',
                    borderTop: { xs: 1, sm: 0 },
                    borderLeft: { xs: 0, sm: 1 },
                    borderColor: 'divider',
                    p: 0.75,
                }}
            >
                {contact.oobi !== null && (
                    <Tooltip title="Copy OOBI">
                        <IconButton
                            size="small"
                            aria-label="copy contact OOBI"
                            onClick={() => {
                                copyText(contact.oobi ?? '');
                            }}
                        >
                            <ContentCopyIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                <Tooltip title="Delete contact">
                    <span>
                        <IconButton
                            size="small"
                            aria-label="delete contact"
                            color="error"
                            disabled={actionRunning}
                            onClick={() => {
                                onDelete(contact.id);
                            }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </Stack>
        </Box>
    );
};
