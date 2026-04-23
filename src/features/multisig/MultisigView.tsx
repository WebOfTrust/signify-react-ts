import { useMemo, useState } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Switch,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import GroupsIcon from '@mui/icons-material/Groups';
import HubIcon from '@mui/icons-material/Hub';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import SendIcon from '@mui/icons-material/Send';
import { useFetcher, useLoaderData } from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import {
    ConsolePanel,
    EmptyState,
    PageHeader,
    StatusPill,
    TelemetryRow,
} from '../../app/Console';
import type {
    MultisigActionData,
    MultisigGroupDetails,
    MultisigLoaderData,
} from '../../app/routeData';
import { UI_SOUND_HOVER_VALUE } from '../../app/uiSound';
import type { ContactRecord } from '../../state/contacts.slice';
import { useAppSelector } from '../../state/hooks';
import {
    selectContacts,
    selectIdentifiers,
    selectMultisigGroupIdentifiers,
    selectMultisigRequestNotifications,
} from '../../state/selectors';
import { isWitnessContact } from '../contacts/contactHelpers';
import { truncateMiddle } from '../identifiers/identifierHelpers';
import type { IdentifierSummary } from '../identifiers/identifierTypes';
import {
    sithSummary,
    thresholdSpecForMembers,
    thresholdSpecFromSith,
    thresholdSummary,
    validateThresholdSpecForMembers,
    type MultisigThresholdSpec,
} from './multisigThresholds';
import type {
    MultisigCreateDraft,
    MultisigMemberDraft,
    MultisigMemberOption,
} from './multisigTypes';
import type { MultisigRequestNotification } from '../../state/notifications.slice';
import { ThresholdEditor } from './ThresholdEditor';
import {
    defaultMultisigRequestGroupAlias,
    defaultMultisigRequestLocalMember,
    displayMultisigRequestGroupAlias,
    multisigRequestActionLabel,
    multisigRequestIntent,
    multisigRequestLocalMembers,
    multisigRequestTitle,
    requiresMultisigJoinLabel,
} from './multisigRequestUi';

const unique = (values: readonly string[]): string[] => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
        const trimmed = value.trim();
        if (trimmed.length > 0 && !seen.has(trimmed)) {
            seen.add(trimmed);
            result.push(trimmed);
        }
    }
    return result;
};

const isGroupIdentifier = (identifier: IdentifierSummary): boolean =>
    'group' in identifier;

const isGroupContact = (contact: ContactRecord): boolean =>
    contact.componentTags.includes('group') ||
    contact.oobi?.includes('groupId=') === true ||
    contact.oobi?.includes('groupName=') === true;

const hasAgentEndpoint = (contact: ContactRecord): boolean =>
    contact.endpoints.some((endpoint) => endpoint.role === 'agent');

const memberDeliveryLabel = (
    status: MultisigMemberOption['deliveryStatus']
): string => {
    switch (status) {
        case 'local':
            return 'Local';
        case 'ready':
            return 'Ready';
        case 'missingAgentOobi':
            return 'Missing agent OOBI';
        case 'unresolvedContact':
            return 'Unresolved contact';
        case 'missingKeyState':
            return 'Missing key state';
    }
};

const memberDeliveryTone = (
    status: MultisigMemberOption['deliveryStatus']
): 'neutral' | 'success' | 'warning' | 'error' | 'info' => {
    if (status === 'local') {
        return 'info';
    }
    if (status === 'ready') {
        return 'success';
    }
    return 'warning';
};

const isDeliverableMember = (option: MultisigMemberOption): boolean =>
    option.deliveryStatus === 'local' || option.deliveryStatus === 'ready';

const memberOptionsFromInventory = (
    identifiers: readonly IdentifierSummary[],
    contacts: readonly ContactRecord[]
): MultisigMemberOption[] => {
    const options: MultisigMemberOption[] = [];
    const seen = new Set<string>();

    for (const identifier of identifiers) {
        if (isGroupIdentifier(identifier) || seen.has(identifier.prefix)) {
            continue;
        }
        seen.add(identifier.prefix);
        options.push({
            aid: identifier.prefix,
            alias: `${identifier.name} (local)`,
            source: 'local',
            isGroup: false,
            isLocal: true,
            localName: identifier.name,
            deliveryStatus: 'local',
        });
    }

    for (const contact of contacts) {
        if (
            contact.aid === null ||
            seen.has(contact.aid) ||
            isWitnessContact(contact) ||
            isGroupContact(contact)
        ) {
            continue;
        }

        seen.add(contact.aid);
        const deliveryStatus =
            contact.resolutionStatus !== 'resolved'
                ? 'unresolvedContact'
                : hasAgentEndpoint(contact)
                  ? 'ready'
                  : 'missingAgentOobi';
        options.push({
            aid: contact.aid,
            alias: `${contact.alias} (contact)`,
            source: 'contact',
            isGroup: false,
            isLocal: false,
            deliveryStatus,
        });
    }

    return options.sort((left, right) => {
        if (left.isLocal !== right.isLocal) {
            return left.isLocal ? -1 : 1;
        }
        return left.alias.localeCompare(right.alias);
    });
};

const memberDrafts = (
    aids: readonly string[],
    options: readonly MultisigMemberOption[]
): MultisigMemberDraft[] =>
    aids.map((aid) => {
        const option = options.find((candidate) => candidate.aid === aid);
        return {
            aid,
            alias: option?.alias ?? aid,
            source: option?.source ?? 'manual',
            isGroup: option?.isGroup,
            deliveryStatus: option?.deliveryStatus,
        };
    });

const specForAids = (
    spec: MultisigThresholdSpec,
    aids: readonly string[]
): MultisigThresholdSpec =>
    validateThresholdSpecForMembers({ spec, memberAids: aids }) === null
        ? spec
        : thresholdSpecForMembers(aids);

const groupStateValue = (
    group: IdentifierSummary,
    key: 's' | 'd'
): string | null => {
    const value = (group.state as Record<string, unknown> | undefined)?.[key];
    return typeof value === 'string' ? value : null;
};

interface MultisigCreateDialogProps {
    open: boolean;
    actionRunning: boolean;
    identifiers: readonly IdentifierSummary[];
    contacts: readonly ContactRecord[];
    onClose: () => void;
    onCreate: (draft: MultisigCreateDraft) => void;
}

const MultisigCreateDialog = ({
    open,
    actionRunning,
    identifiers,
    contacts,
    onClose,
    onCreate,
}: MultisigCreateDialogProps) => {
    const options = useMemo(
        () => memberOptionsFromInventory(identifiers, contacts),
        [contacts, identifiers]
    );
    const localOptions = options.filter((option) => option.isLocal);
    const defaultLocal = localOptions[0];
    const [step, setStep] = useState(0);
    const [groupAlias, setGroupAlias] = useState('');
    const [localMemberAid, setLocalMemberAid] = useState(defaultLocal?.aid ?? '');
    const [candidateAids, setCandidateAids] = useState<string[]>(
        defaultLocal === undefined ? [] : [defaultLocal.aid]
    );
    const [signingAids, setSigningAids] = useState<string[]>(
        defaultLocal === undefined ? [] : [defaultLocal.aid]
    );
    const [rotationAids, setRotationAids] = useState<string[]>(
        defaultLocal === undefined ? [] : [defaultLocal.aid]
    );
    const [signingThreshold, setSigningThreshold] = useState<MultisigThresholdSpec>(
        thresholdSpecForMembers(signingAids)
    );
    const [rotationThreshold, setRotationThreshold] = useState<MultisigThresholdSpec>(
        thresholdSpecForMembers(rotationAids)
    );
    const [rotationLinked, setRotationLinked] = useState(true);
    const [memberSearch, setMemberSearch] = useState('');
    const [useDemoWitnesses, setUseDemoWitnesses] = useState(false);
    const localMember = localOptions.find((option) => option.aid === localMemberAid);
    const thresholdOptions = options.filter((option) =>
        candidateAids.includes(option.aid)
    );
    const signingError = validateThresholdSpecForMembers({
        spec: signingThreshold,
        memberAids: signingAids,
    });
    const rotationError = validateThresholdSpecForMembers({
        spec: rotationThreshold,
        memberAids: rotationAids,
    });
    const undeliverableMembers = unique([...signingAids, ...rotationAids]).flatMap(
        (aid) => {
            const option = options.find((candidate) => candidate.aid === aid);
            return option !== undefined && !isDeliverableMember(option)
                ? [option]
                : [];
        }
    );
    const deliveryError =
        undeliverableMembers.length === 0
            ? null
            : `Resolve member agent OOBIs before creating the group: ${undeliverableMembers
                  .map((member) => member.alias)
                  .join(', ')}`;
    const createDisabled =
        actionRunning ||
        groupAlias.trim().length === 0 ||
        localMember?.localName === undefined ||
        signingAids.length === 0 ||
        rotationAids.length === 0 ||
        !signingAids.includes(localMemberAid) ||
        signingError !== null ||
        rotationError !== null ||
        deliveryError !== null;
    const visibleOptions = options.filter((option) => {
        const haystack = `${option.alias} ${option.aid}`.toLowerCase();
        return haystack.includes(memberSearch.trim().toLowerCase());
    });

    const setLocalMember = (aid: string) => {
        setLocalMemberAid(aid);
        setCandidateAids((current) => unique([aid, ...current]));
        setSigningAids((current) => {
            const next = unique([aid, ...current]);
            const nextSpec = specForAids(signingThreshold, next);
            setSigningThreshold(nextSpec);
            if (rotationLinked) {
                setRotationAids(next);
                setRotationThreshold(nextSpec);
            }
            return next;
        });
    };

    const toggleMember = (aid: string, checked: boolean) => {
        if (checked) {
            const nextCandidates = unique([...candidateAids, aid]);
            const nextSigning = unique([...signingAids, aid]);
            const nextSigningSpec = thresholdSpecForMembers(nextSigning);
            setCandidateAids(nextCandidates);
            setSigningAids(nextSigning);
            setSigningThreshold(nextSigningSpec);
            if (rotationLinked) {
                setRotationAids(nextSigning);
                setRotationThreshold(nextSigningSpec);
            } else {
                const nextRotation = unique([...rotationAids, aid]);
                setRotationAids(nextRotation);
                setRotationThreshold(thresholdSpecForMembers(nextRotation));
            }
            return;
        }

        if (aid === localMemberAid) {
            return;
        }

        const nextCandidates = candidateAids.filter((item) => item !== aid);
        const nextSigning = signingAids.filter((item) => item !== aid);
        const nextRotation = rotationAids.filter((item) => item !== aid);
        setCandidateAids(nextCandidates);
        setSigningAids(nextSigning);
        setSigningThreshold(thresholdSpecForMembers(nextSigning));
        setRotationAids(nextRotation);
        setRotationThreshold(thresholdSpecForMembers(nextRotation));
    };

    const setSigningSelection = (aids: string[]) => {
        setSigningAids(aids);
        if (rotationLinked) {
            setRotationAids(aids);
        }
    };

    const setSigningSpec = (spec: MultisigThresholdSpec) => {
        setSigningThreshold(spec);
        if (rotationLinked) {
            setRotationThreshold(spec);
        }
    };

    const submit = () => {
        if (localMember?.localName === undefined || createDisabled) {
            return;
        }
        const memberAids = unique([...signingAids, ...rotationAids]);
        onCreate({
            groupAlias: groupAlias.trim(),
            localMemberName: localMember.localName,
            localMemberAid,
            members: memberDrafts(memberAids, options),
            signingMemberAids: signingAids,
            rotationMemberAids: rotationAids,
            signingThreshold,
            rotationThreshold,
            witnessMode: useDemoWitnesses ? 'demo' : 'none',
        });
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>Create Multisig Group</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Tabs value={step} onChange={(_, value: number) => setStep(value)}>
                        <Tab label="Basics" />
                        <Tab label="Members" />
                        <Tab label="Thresholds" />
                        <Tab label="Review" />
                    </Tabs>
                    {step === 0 && (
                        <Stack spacing={2}>
                            <TextField
                                label="Group alias"
                                value={groupAlias}
                                onChange={(event) =>
                                    setGroupAlias(event.target.value)
                                }
                                fullWidth
                            />
                            <FormControl fullWidth>
                                <InputLabel id="multisig-local-member-label">
                                    Local signing member
                                </InputLabel>
                                <Select
                                    labelId="multisig-local-member-label"
                                    label="Local signing member"
                                    value={localMemberAid}
                                    onChange={(event) =>
                                        setLocalMember(event.target.value)
                                    }
                                >
                                    {localOptions.map((option) => (
                                        <MenuItem key={option.aid} value={option.aid}>
                                            {option.alias}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={useDemoWitnesses}
                                        onChange={(event) =>
                                            setUseDemoWitnesses(event.target.checked)
                                        }
                                    />
                                }
                                label="Use demo witnesses"
                            />
                        </Stack>
                    )}
                    {step === 1 && (
                        <Stack spacing={1.5}>
                            <TextField
                                label="Search members"
                                value={memberSearch}
                                onChange={(event) =>
                                    setMemberSearch(event.target.value)
                                }
                                fullWidth
                            />
                            <Box
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: {
                                        xs: '1fr',
                                        md: 'repeat(2, minmax(0, 1fr))',
                                    },
                                    gap: 1,
                                }}
                            >
                                {visibleOptions.map((option) => (
                                    <Box
                                        key={option.aid}
                                        sx={{
                                            border: 1,
                                            borderColor: candidateAids.includes(
                                                option.aid
                                            )
                                                ? 'primary.main'
                                                : 'divider',
                                            borderRadius: 1,
                                            p: 1,
                                            bgcolor: 'background.paper',
                                        }}
                                    >
                                        <FormControlLabel
                                            control={
                                                <Checkbox
                                                    checked={candidateAids.includes(
                                                        option.aid
                                                    )}
                                                    disabled={
                                                        option.aid === localMemberAid
                                                    }
                                                    onChange={(event) =>
                                                        toggleMember(
                                                            option.aid,
                                                            event.target.checked
                                                        )
                                                    }
                                                />
                                            }
                                            label={
                                                <Box sx={{ minWidth: 0 }}>
                                                    <Stack
                                                        direction="row"
                                                        spacing={0.75}
                                                        sx={{
                                                            alignItems: 'center',
                                                            flexWrap: 'wrap',
                                                        }}
                                                    >
                                                        <Typography variant="body2">
                                                            {option.alias}
                                                        </Typography>
                                                        <StatusPill
                                                            label={option.source}
                                                            tone="neutral"
                                                        />
                                                        <StatusPill
                                                            label={memberDeliveryLabel(
                                                                option.deliveryStatus
                                                            )}
                                                            tone={memberDeliveryTone(
                                                                option.deliveryStatus
                                                            )}
                                                        />
                                                    </Stack>
                                                    <Typography
                                                        variant="caption"
                                                        color="text.secondary"
                                                        sx={{
                                                            fontFamily:
                                                                'var(--app-mono-font)',
                                                            letterSpacing: 0,
                                                            overflowWrap: 'anywhere',
                                                        }}
                                                    >
                                                        {truncateMiddle(option.aid)}
                                                    </Typography>
                                                </Box>
                                            }
                                        />
                                    </Box>
                                ))}
                            </Box>
                        </Stack>
                    )}
                    {step === 2 && (
                        <Stack spacing={2}>
                            <ThresholdEditor
                                title="Signing threshold"
                                memberOptions={thresholdOptions}
                                selectedAids={signingAids}
                                spec={signingThreshold}
                                disabled={actionRunning}
                                onSelectedAidsChange={setSigningSelection}
                                onSpecChange={setSigningSpec}
                            />
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={rotationLinked}
                                        onChange={(event) => {
                                            setRotationLinked(event.target.checked);
                                            if (event.target.checked) {
                                                setRotationAids(signingAids);
                                                setRotationThreshold(signingThreshold);
                                            }
                                        }}
                                    />
                                }
                                label="Mirror rotation threshold from signing"
                            />
                            <ThresholdEditor
                                title="Rotation threshold"
                                memberOptions={thresholdOptions}
                                selectedAids={rotationAids}
                                spec={rotationThreshold}
                                disabled={actionRunning || rotationLinked}
                                onSelectedAidsChange={(aids) => {
                                    setRotationLinked(false);
                                    setRotationAids(aids);
                                }}
                                onSpecChange={(spec) => {
                                    setRotationLinked(false);
                                    setRotationThreshold(spec);
                                }}
                            />
                            {deliveryError !== null && (
                                <Typography variant="body2" color="warning.main">
                                    {deliveryError}
                                </Typography>
                            )}
                        </Stack>
                    )}
                    {step === 3 && (
                        <Stack spacing={1}>
                            <TelemetryRow label="Group alias" value={groupAlias} />
                            <TelemetryRow
                                label="Local member"
                                value={localMember?.alias ?? 'Not selected'}
                            />
                            <TelemetryRow
                                label="Signing members"
                                value={signingAids.length.toString()}
                            />
                            <TelemetryRow
                                label="Signing sith"
                                value={thresholdSummary(signingThreshold)}
                                mono
                            />
                            <TelemetryRow
                                label="Rotation members"
                                value={rotationAids.length.toString()}
                            />
                            <TelemetryRow
                                label="Rotation sith"
                                value={thresholdSummary(rotationThreshold)}
                                mono
                            />
                            <TelemetryRow
                                label="Witness mode"
                                value={useDemoWitnesses ? 'demo' : 'none'}
                            />
                            <TelemetryRow
                                label="Delivery"
                                value={
                                    deliveryError ?? 'All remote members are ready'
                                }
                            />
                        </Stack>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    disabled={step === 0}
                    onClick={() => setStep((current) => Math.max(0, current - 1))}
                >
                    Back
                </Button>
                {step < 3 ? (
                    <Button
                        variant="contained"
                        onClick={() => setStep((current) => Math.min(3, current + 1))}
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                    >
                        Next
                    </Button>
                ) : (
                    <Button
                        variant="contained"
                        startIcon={<GroupsIcon />}
                        disabled={createDisabled}
                        onClick={submit}
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                    >
                        Create group
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
};

interface InteractionDialogProps {
    group: IdentifierSummary | null;
    details: MultisigGroupDetails | null;
    memberOptions: readonly MultisigMemberOption[];
    actionRunning: boolean;
    onClose: () => void;
    onSubmit: (groupAlias: string, localMemberName: string, data: string) => void;
}

const InteractionDialog = ({
    group,
    details,
    memberOptions,
    actionRunning,
    onClose,
    onSubmit,
}: InteractionDialogProps) => {
    const localOptions = memberOptions.filter(
        (option) =>
            option.isLocal &&
            (details?.signingMemberAids.length === 0 ||
                details?.signingMemberAids.includes(option.aid) === true)
    );
    const [localMemberName, setLocalMemberName] = useState(
        localOptions[0]?.localName ?? ''
    );
    const [payload, setPayload] = useState('{}');
    const parsedPreview = (() => {
        try {
            return JSON.stringify(JSON.parse(payload), null, 2);
        } catch {
            return payload;
        }
    })();

    return (
        <Dialog open={group !== null} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Interact With Multisig Group</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <TelemetryRow label="Group" value={group?.name ?? ''} />
                    <FormControl fullWidth>
                        <InputLabel id="interaction-local-member-label">
                            Local member
                        </InputLabel>
                        <Select
                            labelId="interaction-local-member-label"
                            label="Local member"
                            value={localMemberName}
                            onChange={(event) =>
                                setLocalMemberName(event.target.value)
                            }
                        >
                            {localOptions.map((option) => (
                                <MenuItem
                                    key={option.aid}
                                    value={option.localName ?? ''}
                                >
                                    {option.alias}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label="Interaction payload"
                        value={payload}
                        onChange={(event) => setPayload(event.target.value)}
                        multiline
                        minRows={4}
                        fullWidth
                    />
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                            display: 'block',
                            fontFamily: 'var(--app-mono-font)',
                            letterSpacing: 0,
                            overflowWrap: 'anywhere',
                            whiteSpace: 'pre-wrap',
                        }}
                    >
                        {parsedPreview}
                    </Typography>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    startIcon={<SendIcon />}
                    disabled={
                        actionRunning ||
                        group === null ||
                        localMemberName.trim().length === 0
                    }
                    onClick={() =>
                        group !== null &&
                        onSubmit(group.name, localMemberName.trim(), payload)
                    }
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                >
                    Interact
                </Button>
            </DialogActions>
        </Dialog>
    );
};

interface RotationDialogProps {
    group: IdentifierSummary | null;
    details: MultisigGroupDetails | null;
    memberOptions: readonly MultisigMemberOption[];
    actionRunning: boolean;
    onClose: () => void;
    onSubmit: (draft: {
        groupAlias: string;
        localMemberName: string | null;
        signingMemberAids: string[];
        rotationMemberAids: string[];
        nextThreshold: MultisigThresholdSpec;
    }) => void;
}

const RotationDialog = ({
    group,
    details,
    memberOptions,
    actionRunning,
    onClose,
    onSubmit,
}: RotationDialogProps) => {
    const initialAids =
        details?.rotationMemberAids.length === 0
            ? (details?.signingMemberAids ?? [])
            : (details?.rotationMemberAids ?? []);
    const [rotationAids, setRotationAids] = useState(initialAids);
    const [nextThreshold, setNextThreshold] = useState<MultisigThresholdSpec>(
        details?.rotationThreshold === null || details?.rotationThreshold === undefined
            ? thresholdSpecForMembers(initialAids)
            : thresholdSpecFromSith(details.rotationThreshold, initialAids)
    );
    const localOptions = memberOptions.filter((option) => option.isLocal);
    const [localMemberName, setLocalMemberName] = useState(
        localOptions.find((option) =>
            details?.signingMemberAids.includes(option.aid)
        )?.localName ??
            localOptions[0]?.localName ??
            ''
    );
    const validation = validateThresholdSpecForMembers({
        spec: nextThreshold,
        memberAids: rotationAids,
    });

    return (
        <Dialog open={group !== null} onClose={onClose} fullWidth maxWidth="lg">
            <DialogTitle>Rotate Multisig Group</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <TelemetryRow label="Group" value={group?.name ?? ''} />
                    <FormControl fullWidth>
                        <InputLabel id="rotation-local-member-label">
                            Local member
                        </InputLabel>
                        <Select
                            labelId="rotation-local-member-label"
                            label="Local member"
                            value={localMemberName}
                            onChange={(event) =>
                                setLocalMemberName(event.target.value)
                            }
                        >
                            {localOptions.map((option) => (
                                <MenuItem
                                    key={option.aid}
                                    value={option.localName ?? ''}
                                >
                                    {option.alias}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <ThresholdEditor
                        title="Next rotation threshold"
                        memberOptions={memberOptions}
                        selectedAids={rotationAids}
                        spec={nextThreshold}
                        disabled={actionRunning}
                        onSelectedAidsChange={setRotationAids}
                        onSpecChange={setNextThreshold}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button
                    variant="contained"
                    startIcon={<RotateRightIcon />}
                    disabled={
                        actionRunning ||
                        group === null ||
                        localMemberName.trim().length === 0 ||
                        validation !== null
                    }
                    onClick={() =>
                        group !== null &&
                        onSubmit({
                            groupAlias: group.name,
                            localMemberName: localMemberName.trim(),
                            signingMemberAids: details?.signingMemberAids ?? [],
                            rotationMemberAids: rotationAids,
                            nextThreshold,
                        })
                    }
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                >
                    Rotate
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export const MultisigView = () => {
    const loaderData = useLoaderData() as MultisigLoaderData;
    const fetcher = useFetcher<MultisigActionData>();
    const liveIdentifiers = useAppSelector(selectIdentifiers);
    const contacts = useAppSelector(selectContacts);
    const groupIdentifiers = useAppSelector(selectMultisigGroupIdentifiers);
    const requests = useAppSelector(selectMultisigRequestNotifications);
    const [createOpen, setCreateOpen] = useState(false);
    const [interactionGroup, setInteractionGroup] =
        useState<IdentifierSummary | null>(null);
    const [rotationGroup, setRotationGroup] = useState<IdentifierSummary | null>(
        null
    );
    const [requestDrafts, setRequestDrafts] = useState<
        Record<string, { groupAlias: string; localMemberName: string }>
    >({});
    const actionRunning = fetcher.state !== 'idle';

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const identifiers =
        liveIdentifiers.length > 0 ? liveIdentifiers : loaderData.identifiers;
    const groups = groupIdentifiers.length > 0
        ? groupIdentifiers
        : identifiers.filter(isGroupIdentifier);
    const groupDetails = new Map(
        (loaderData.status === 'ready' || loaderData.status === 'error'
            ? loaderData.groupDetails
            : []
        ).map((detail) => [detail.groupAid, detail])
    );
    const memberOptions = memberOptionsFromInventory(identifiers, contacts);
    const localMemberIdentifiers = multisigRequestLocalMembers(identifiers);

    const submitDraft = (intent: string, fields: Record<string, string>) => {
        const formData = new FormData();
        formData.set('intent', intent);
        formData.set('requestId', globalThis.crypto.randomUUID());
        for (const [key, value] of Object.entries(fields)) {
            formData.set(key, value);
        }
        fetcher.submit(formData, { method: 'post' });
    };

    const createGroup = (draft: MultisigCreateDraft) => {
        submitDraft('create', { draft: JSON.stringify(draft) });
        setCreateOpen(false);
    };

    const submitRequest = (request: MultisigRequestNotification) => {
        const defaults = {
            groupAlias: defaultMultisigRequestGroupAlias(request, identifiers),
            localMemberName:
                defaultMultisigRequestLocalMember(request, identifiers)?.name ?? '',
        };
        const draft = requestDrafts[request.notificationId] ?? defaults;
        submitDraft(multisigRequestIntent(request), {
            notificationId: request.notificationId,
            exnSaid: request.exnSaid,
            groupAlias: draft.groupAlias.trim(),
            localMemberName: draft.localMemberName,
        });
    };

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Group identity"
                title="Multisig"
                summary="Create group AIDs, approve group protocol requests, authorize member agents, interact, and rotate."
                actions={
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateOpen(true)}
                        disabled={actionRunning}
                        data-ui-sound={UI_SOUND_HOVER_VALUE}
                    >
                        New group
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
                    <Typography component="span">{loaderData.message}</Typography>
                </Box>
            )}
            {fetcher.data !== undefined && (
                <Box
                    sx={{
                        border: 1,
                        borderColor: fetcher.data.ok ? 'divider' : 'error.main',
                        borderRadius: 1,
                        bgcolor: fetcher.data.ok
                            ? 'rgba(39, 215, 255, 0.06)'
                            : 'rgba(255, 61, 79, 0.08)',
                        px: 2,
                        py: 1.25,
                    }}
                >
                    <StatusPill
                        label={fetcher.data.ok ? 'accepted' : 'error'}
                        tone={fetcher.data.ok ? 'info' : 'error'}
                    />{' '}
                    <Typography component="span">{fetcher.data.message}</Typography>
                </Box>
            )}
            <ConsolePanel
                title="Groups"
                eyebrow="Managed"
                actions={<StatusPill label={`${groups.length}`} />}
            >
                {groups.length === 0 ? (
                    <EmptyState
                        title="No multisig groups"
                        message="Create a group after resolving member OOBIs into contacts."
                    />
                ) : (
                    <Stack spacing={2}>
                        {groups.map((group) => {
                            const details = groupDetails.get(group.prefix) ?? null;
                            const sequence = groupStateValue(group, 's');
                            const digest = groupStateValue(group, 'd');
                            return (
                                <Box
                                    key={group.prefix}
                                    sx={{
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1.5,
                                    }}
                                >
                                    <Stack spacing={1.25}>
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            sx={{
                                                justifyContent: 'space-between',
                                                gap: 1,
                                            }}
                                        >
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography variant="h6">
                                                    {group.name}
                                                </Typography>
                                                <Typography
                                                    variant="caption"
                                                    color="text.secondary"
                                                    sx={{
                                                        fontFamily:
                                                            'var(--app-mono-font)',
                                                        letterSpacing: 0,
                                                    }}
                                                >
                                                    {truncateMiddle(group.prefix, 12)}
                                                </Typography>
                                            </Box>
                                            <Stack
                                                direction="row"
                                                spacing={0.75}
                                                sx={{ flexWrap: 'wrap' }}
                                            >
                                                <StatusPill label="group" tone="info" />
                                                <StatusPill
                                                    label={
                                                        details === null
                                                            ? 'activation unknown'
                                                            : 'ready for actions'
                                                    }
                                                    tone={
                                                        details === null
                                                            ? 'warning'
                                                            : 'success'
                                                    }
                                                />
                                            </Stack>
                                        </Stack>
                                        <TelemetryRow
                                            label="Sequence"
                                            value={sequence ?? 'Unavailable'}
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Digest"
                                            value={digest ?? 'Unavailable'}
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Signing members"
                                            value={
                                                details?.signingMemberAids.length.toString() ??
                                                'Unavailable'
                                            }
                                        />
                                        <TelemetryRow
                                            label="Signing threshold"
                                            value={sithSummary(
                                                details?.signingThreshold ?? null
                                            )}
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Rotation members"
                                            value={
                                                details?.rotationMemberAids.length.toString() ??
                                                'Unavailable'
                                            }
                                        />
                                        <TelemetryRow
                                            label="Next threshold"
                                            value={sithSummary(
                                                details?.rotationThreshold ?? null
                                            )}
                                            mono
                                        />
                                        <Divider />
                                        <Stack
                                            direction={{ xs: 'column', md: 'row' }}
                                            spacing={1}
                                        >
                                            <Button
                                                variant="outlined"
                                                startIcon={<HubIcon />}
                                                disabled={actionRunning}
                                                onClick={() =>
                                                    submitDraft('authorizeAgents', {
                                                        groupAlias: group.name,
                                                    })
                                                }
                                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                                            >
                                                Authorize agents
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<SendIcon />}
                                                disabled={actionRunning}
                                                onClick={() =>
                                                    setInteractionGroup(group)
                                                }
                                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                                            >
                                                Interact
                                            </Button>
                                            <Button
                                                variant="outlined"
                                                startIcon={<RotateRightIcon />}
                                                disabled={actionRunning}
                                                onClick={() => setRotationGroup(group)}
                                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                                            >
                                                Rotate
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </ConsolePanel>
            <ConsolePanel
                title="Multisig requests"
                eyebrow="Protocol inbox"
                actions={<StatusPill label={`${requests.length}`} />}
            >
                {requests.length === 0 ? (
                    <EmptyState
                        title="No multisig requests"
                        message="Incoming group inception, role, interaction, and rotation requests appear here after notification sync."
                    />
                ) : (
                    <Stack spacing={2}>
                        {requests.map((request) => {
                            const localDefault = defaultMultisigRequestLocalMember(
                                request,
                                identifiers
                            );
                            const draft = requestDrafts[request.notificationId] ?? {
                                groupAlias: defaultMultisigRequestGroupAlias(
                                    request,
                                    identifiers
                                ),
                                localMemberName: localDefault?.name ?? '',
                            };
                            const requiresJoinLabel =
                                requiresMultisigJoinLabel(request);
                            return (
                                <Box
                                    key={request.notificationId}
                                    sx={{
                                        border: 1,
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        p: 1.5,
                                    }}
                                >
                                    <Stack spacing={1.25}>
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            sx={{
                                                alignItems: {
                                                    xs: 'stretch',
                                                    sm: 'center',
                                                },
                                                justifyContent: 'space-between',
                                                gap: 1,
                                            }}
                                        >
                                            <Typography variant="h6">
                                                {multisigRequestTitle(request)}
                                            </Typography>
                                            <StatusPill
                                                label={request.status}
                                                tone={
                                                    request.status === 'actionable'
                                                        ? 'info'
                                                        : request.status === 'error'
                                                          ? 'error'
                                                          : request.status ===
                                                              'notForThisWallet'
                                                            ? 'warning'
                                                            : 'success'
                                                }
                                            />
                                        </Stack>
                                        <TelemetryRow
                                            label="Group AID"
                                            value={request.groupAid ?? 'Not available'}
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Group alias"
                                            value={displayMultisigRequestGroupAlias(
                                                request,
                                                identifiers
                                            )}
                                        />
                                        <TelemetryRow
                                            label="Sender"
                                            value={request.senderAid ?? 'Not available'}
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Responses"
                                            value={`${request.progress.completed}/${request.progress.total}`}
                                        />
                                        <TelemetryRow
                                            label="Responded"
                                            value={
                                                request.progress.respondedMemberAids
                                                    .map((aid) =>
                                                        truncateMiddle(aid, 10)
                                                    )
                                                    .join(', ') || 'None'
                                            }
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Waiting"
                                            value={
                                                request.progress.waitingMemberAids
                                                    .map((aid) =>
                                                        truncateMiddle(aid, 10)
                                                    )
                                                    .join(', ') || 'None'
                                            }
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Signing members"
                                            value={request.signingMemberAids.length}
                                        />
                                        <TelemetryRow
                                            label="Signing threshold"
                                            value={sithSummary(request.signingThreshold)}
                                            mono
                                        />
                                        <TelemetryRow
                                            label="Rotation members"
                                            value={request.rotationMemberAids.length}
                                        />
                                        <TelemetryRow
                                            label="Rotation threshold"
                                            value={sithSummary(request.rotationThreshold)}
                                            mono
                                        />
                                        {request.embeddedPayloadSummary !== null && (
                                            <TelemetryRow
                                                label="Payload"
                                                value={request.embeddedPayloadSummary}
                                                mono
                                            />
                                        )}
                                        <Divider />
                                        <Stack
                                            direction={{ xs: 'column', md: 'row' }}
                                            spacing={1}
                                        >
                                            <TextField
                                                size="small"
                                                label={
                                                    requiresJoinLabel
                                                        ? 'New group label'
                                                        : 'Group alias'
                                                }
                                                value={draft.groupAlias}
                                                helperText={
                                                    requiresJoinLabel
                                                        ? 'Local label for this wallet after joining.'
                                                        : undefined
                                                }
                                                onChange={(event) =>
                                                    setRequestDrafts((current) => ({
                                                        ...current,
                                                        [request.notificationId]: {
                                                            ...draft,
                                                            groupAlias:
                                                                event.target.value,
                                                        },
                                                    }))
                                                }
                                            />
                                            <FormControl
                                                size="small"
                                                sx={{ minWidth: 220 }}
                                            >
                                                <InputLabel
                                                    id={`request-member-${request.notificationId}`}
                                                >
                                                    Local member
                                                </InputLabel>
                                                <Select
                                                    labelId={`request-member-${request.notificationId}`}
                                                    label="Local member"
                                                    value={draft.localMemberName}
                                                    onChange={(event) =>
                                                        setRequestDrafts((current) => ({
                                                            ...current,
                                                            [request.notificationId]: {
                                                                ...draft,
                                                                localMemberName:
                                                                    event.target.value,
                                                            },
                                                        }))
                                                    }
                                                >
                                                    {localMemberIdentifiers.map(
                                                        (identifier) => (
                                                            <MenuItem
                                                                key={
                                                                    identifier.prefix
                                                                }
                                                                value={
                                                                    identifier.name
                                                                }
                                                            >
                                                                {identifier.name}
                                                            </MenuItem>
                                                        )
                                                    )}
                                                </Select>
                                            </FormControl>
                                            <Button
                                                variant="contained"
                                                startIcon={<CheckCircleIcon />}
                                                disabled={
                                                    actionRunning ||
                                                    request.status !== 'actionable' ||
                                                    draft.groupAlias.trim().length ===
                                                        0 ||
                                                    draft.localMemberName.trim()
                                                        .length === 0
                                                }
                                                onClick={() => submitRequest(request)}
                                                data-ui-sound={UI_SOUND_HOVER_VALUE}
                                            >
                                                {multisigRequestActionLabel(request)}
                                            </Button>
                                        </Stack>
                                    </Stack>
                                </Box>
                            );
                        })}
                    </Stack>
                )}
            </ConsolePanel>
            {createOpen && (
                <MultisigCreateDialog
                    open={createOpen}
                    actionRunning={actionRunning}
                    identifiers={identifiers}
                    contacts={contacts}
                    onClose={() => setCreateOpen(false)}
                    onCreate={createGroup}
                />
            )}
            <InteractionDialog
                key={interactionGroup?.prefix ?? 'interaction'}
                group={interactionGroup}
                details={
                    interactionGroup === null
                        ? null
                        : (groupDetails.get(interactionGroup.prefix) ?? null)
                }
                memberOptions={memberOptions}
                actionRunning={actionRunning}
                onClose={() => setInteractionGroup(null)}
                onSubmit={(groupAlias, localMemberName, data) => {
                    submitDraft('interact', {
                        groupAlias,
                        localMemberName,
                        data,
                    });
                    setInteractionGroup(null);
                }}
            />
            <RotationDialog
                key={rotationGroup?.prefix ?? 'rotation'}
                group={rotationGroup}
                details={
                    rotationGroup === null
                        ? null
                        : (groupDetails.get(rotationGroup.prefix) ?? null)
                }
                memberOptions={memberOptions}
                actionRunning={actionRunning}
                onClose={() => setRotationGroup(null)}
                onSubmit={(draft) => {
                    submitDraft('rotate', { draft: JSON.stringify(draft) });
                    setRotationGroup(null);
                }}
            />
        </Box>
    );
};
