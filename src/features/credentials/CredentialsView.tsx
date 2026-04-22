import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    Box,
    Button,
    Checkbox,
    Collapse,
    FormControl,
    FormControlLabel,
    FormHelperText,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutlineOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import InventoryIcon from '@mui/icons-material/Inventory';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import {
    Link as RouterLink,
    useFetcher,
    useLoaderData,
    useLocation,
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
import { clickablePanelSx, monoValueSx } from '../../app/consoleStyles';
import { formatTimestamp } from '../../app/timeFormat';
import type {
    CredentialActionData,
    CredentialsLoaderData,
} from '../../app/routeData';
import type { CredentialSummaryRecord } from '../../state/credentials.slice';
import type { IssueableCredentialTypeView } from '../../state/issueableCredentialTypes';
import { useAppDispatch, useAppSelector } from '../../state/hooks';
import {
    selectContacts,
    selectCredentialGrantNotifications,
    selectCredentialRegistries,
    selectHeldCredentials,
    selectIdentifiers,
    selectIssueableCredentialTypeViews,
    selectIssuedCredentials,
    selectSelectedWalletAid,
    selectSelectedWalletRegistry,
} from '../../state/selectors';
import {
    walletAidCleared,
    walletAidSelected,
    walletRegistrySelected,
} from '../../state/walletSelection.slice';
import { abbreviateMiddle } from '../contacts/contactHelpers';
import {
    hasSediVoterIssueDraftErrors,
    SEDI_VOTER_ISSUE_TEXT_FIELDS,
    validateSediVoterIssueDraft,
    type SediVoterIssueFormDraft,
} from './credentialIssueForm';
import {
    readyCredentialRegistriesForIssuer,
    resolvedCredentialHolderContacts,
} from './credentialSelection';
import {
    grantsForAid,
    heldCredentialsForAid,
    issuedCredentialsForAid,
    issuedCredentialsForAidAndSchema,
    issuerStatsForAid,
    registryTilesForIssuer,
    walletStatsForAid,
} from './credentialViewModels';

const defaultDraft: SediVoterIssueFormDraft = {
    fullName: 'Ada Voter',
    voterId: 'SEDI-0001',
    precinctId: 'PCT-042',
    county: 'Demo County',
    jurisdiction: 'SEDI',
    electionId: 'SEDI-2026-DEMO',
    eligible: true,
    expires: '2026-12-31T23:59:59Z',
};

const timestampText = (value: string | null): string =>
    value === null ? 'Not available' : (formatTimestamp(value) ?? value);

const aidLabel = (value: string | null | undefined): string =>
    value === null || value === undefined ? 'Not available' : value;

const statusTone = (
    status: CredentialSummaryRecord['status']
): 'neutral' | 'success' | 'warning' | 'error' | 'info' =>
    status === 'error'
        ? 'error'
        : status === 'revoked'
          ? 'warning'
          : status === 'admitted'
            ? 'success'
            : status === 'grantSent' || status === 'pendingAdmit'
              ? 'info'
              : 'neutral';

const schemaStatusTone = (
    status: IssueableCredentialTypeView['schemaStatus']
): 'neutral' | 'success' | 'warning' | 'error' | 'info' =>
    status === 'resolved'
        ? 'success'
        : status === 'resolving'
          ? 'info'
          : status === 'error'
            ? 'error'
            : 'warning';

const credentialPath = (aid?: string): string =>
    aid === undefined ? '/credentials' : `/credentials/${encodeURIComponent(aid)}`;

const issuerPath = (aid: string): string => `${credentialPath(aid)}/issuer`;

const issuerTypePath = (aid: string, typeKey: string): string =>
    `${issuerPath(aid)}/${encodeURIComponent(typeKey)}`;

const walletPath = (aid: string): string => `${credentialPath(aid)}/wallet`;

const newRequestId = (): string =>
    globalThis.crypto?.randomUUID?.() ??
    `credential-${Date.now()}-${Math.random().toString(16).slice(2)}`;

interface FormSubmitter {
    submit(formData: FormData, options: { method: 'post' }): void;
}

const submitWithId = (fetcher: FormSubmitter, formData: FormData): void => {
    formData.set('requestId', newRequestId());
    fetcher.submit(formData, { method: 'post' });
};

const schemaLabel = (
    schemaSaid: string | null,
    credentialTypesBySchema: ReadonlyMap<string, IssueableCredentialTypeView>
): string => {
    if (schemaSaid === null) {
        return 'Not available';
    }

    return (
        credentialTypesBySchema.get(schemaSaid)?.label ??
        abbreviateMiddle(schemaSaid, 18)
    );
};

const registryLabel = (
    registryId: string | null,
    registries: ReturnType<typeof selectCredentialRegistries>
): string => {
    if (registryId === null) {
        return 'Not available';
    }

    const registry =
        registries.find(
            (candidate) =>
                candidate.id === registryId || candidate.regk === registryId
        ) ?? null;
    return registry?.registryName ?? abbreviateMiddle(registryId, 18);
};

const CredentialRecordRows = ({
    credential,
    credentialTypesBySchema,
}: {
    credential: CredentialSummaryRecord;
    credentialTypesBySchema: ReadonlyMap<string, IssueableCredentialTypeView>;
}) => (
    <Stack spacing={0.5}>
        <TelemetryRow
            label="Type"
            value={schemaLabel(credential.schemaSaid, credentialTypesBySchema)}
        />
        <TelemetryRow
            label="Credential"
            value={aidLabel(credential.said)}
            mono
        />
        <TelemetryRow label="Issuer" value={aidLabel(credential.issuerAid)} mono />
        <TelemetryRow label="Registry" value={aidLabel(credential.registryId)} mono />
        <TelemetryRow label="Holder" value={aidLabel(credential.holderAid)} mono />
        <TelemetryRow
            label="Issued"
            value={timestampText(credential.issuedAt)}
        />
        {credential.grantSaid !== null && (
            <TelemetryRow label="Grant" value={credential.grantSaid} mono />
        )}
        {credential.admitSaid !== null && (
            <TelemetryRow label="Admit" value={credential.admitSaid} mono />
        )}
        {credential.attributes !== null && (
            <TelemetryRow
                label="Voter"
                value={`${credential.attributes.fullName} / ${credential.attributes.voterId}`}
            />
        )}
    </Stack>
);

const AidSelector = ({
    selectedAid,
    identifiers,
    onSelect,
}: {
    selectedAid: string;
    identifiers: ReturnType<typeof selectIdentifiers>;
    onSelect: (aid: string) => void;
}) => (
    <FormControl fullWidth size="small">
        <InputLabel id="credential-aid-label">AID</InputLabel>
        <Select
            labelId="credential-aid-label"
            label="AID"
            value={
                identifiers.some((identifier) => identifier.prefix === selectedAid)
                    ? selectedAid
                    : ''
            }
            onChange={(event) => onSelect(event.target.value)}
        >
            <MenuItem value="">
                <em>Select AID</em>
            </MenuItem>
            {identifiers.map((identifier) => (
                <MenuItem key={identifier.prefix} value={identifier.prefix}>
                    {identifier.name} / {abbreviateMiddle(identifier.prefix, 14)}
                </MenuItem>
            ))}
        </Select>
    </FormControl>
);

const WalletStackPreview = ({
    credentials,
    credentialTypesBySchema,
}: {
    credentials: readonly CredentialSummaryRecord[];
    credentialTypesBySchema: ReadonlyMap<string, IssueableCredentialTypeView>;
}) => {
    const previewCredentials = credentials.slice(0, 3);

    return (
        <Box sx={{ position: 'relative', minHeight: 150, mt: 1 }}>
            {previewCredentials.length === 0 ? (
                <Box
                    sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        height: 118,
                        p: 1.5,
                        bgcolor: 'rgba(13, 23, 34, 0.72)',
                    }}
                >
                    <Typography sx={{ fontWeight: 800 }}>
                        Wallet empty
                    </Typography>
                    <Typography color="text.secondary" variant="body2">
                        No admitted credentials
                    </Typography>
                </Box>
            ) : (
                previewCredentials.map((credential, index) => (
                    <Box
                        key={credential.said}
                        sx={{
                            position: 'absolute',
                            top: index * 18,
                            left: index * 10,
                            right: 0,
                            minHeight: 100,
                            border: 1,
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 1.5,
                            bgcolor:
                                index === 0
                                    ? 'background.paper'
                                    : 'rgba(16, 29, 42, 0.96)',
                            boxShadow: '0 16px 32px rgba(0, 0, 0, 0.24)',
                            zIndex: previewCredentials.length - index,
                        }}
                    >
                        <Typography sx={{ fontWeight: 800 }}>
                            {schemaLabel(
                                credential.schemaSaid,
                                credentialTypesBySchema
                            )}
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{ ...monoValueSx, mt: 1 }}
                        >
                            {abbreviateMiddle(credential.said, 24)}
                        </Typography>
                    </Box>
                ))
            )}
        </Box>
    );
};

const OverviewMetric = ({
    label,
    value,
}: {
    label: string;
    value: string;
}) => (
    <Box sx={{ minWidth: 0 }}>
        <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', fontWeight: 700, textTransform: 'uppercase' }}
        >
            {label}
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {value}
        </Typography>
    </Box>
);

const OverviewChoiceCard = ({
    title,
    eyebrow,
    icon,
    status,
    statusTone,
    onOpen,
    children,
    actions,
    testId,
}: {
    title: string;
    eyebrow: string;
    icon: ReactNode;
    status: string;
    statusTone: 'neutral' | 'success' | 'warning' | 'error' | 'info';
    onOpen: () => void;
    children: ReactNode;
    actions?: ReactNode;
    testId: string;
}) => (
    <Box
        role="button"
        tabIndex={0}
        data-testid={testId}
        onClick={onOpen}
        onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onOpen();
            }
        }}
        sx={[
            {
                height: '100%',
                minHeight: 300,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
                boxShadow: '0 18px 42px rgba(0, 0, 0, 0.2)',
                p: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                position: 'relative',
                overflow: 'hidden',
                '&:before': {
                    content: '""',
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    borderTop: '1px solid rgba(118, 232, 255, 0.16)',
                },
            },
            clickablePanelSx,
        ]}
    >
        <Stack
            direction="row"
            spacing={1.5}
            sx={{
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                minWidth: 0,
            }}
        >
            <Stack direction="row" spacing={1.5} sx={{ minWidth: 0 }}>
                <Box
                    sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        border: 1,
                        borderColor: 'divider',
                        color: 'primary.main',
                        flex: '0 0 auto',
                    }}
                >
                    {icon}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                    <Typography
                        variant="caption"
                        color="primary.main"
                        sx={{ fontWeight: 700, textTransform: 'uppercase' }}
                    >
                        {eyebrow}
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                        {title}
                    </Typography>
                </Box>
            </Stack>
            <StatusPill label={status} tone={statusTone} />
        </Stack>
        <Box sx={{ flex: '1 1 auto', minWidth: 0 }}>{children}</Box>
        {actions != null && (
            <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
            >
                {actions}
            </Stack>
        )}
    </Box>
);

/**
 * Route view for the issuer-to-holder credential issuance vertical slice.
 */
export const CredentialsView = () => {
    const loaderData = useLoaderData() as CredentialsLoaderData;
    const fetcher = useFetcher<CredentialActionData>();
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { aid: aidParam, typeKey } = useParams<{
        aid?: string;
        typeKey?: string;
    }>();

    const identifiers = useAppSelector(selectIdentifiers);
    const contacts = useAppSelector(selectContacts);
    const credentialTypes = useAppSelector(selectIssueableCredentialTypeViews);
    const registries = useAppSelector(selectCredentialRegistries);
    const issuedCredentials = useAppSelector(selectIssuedCredentials);
    const heldCredentials = useAppSelector(selectHeldCredentials);
    const grantNotifications = useAppSelector(selectCredentialGrantNotifications);
    const walletSelectedAid = useAppSelector(selectSelectedWalletAid);
    const walletSelectedRegistry = useAppSelector(selectSelectedWalletRegistry);

    const [holderAid, setHolderAid] = useState('');
    const [registryName, setRegistryName] = useState('sedi-voter-registry');
    const [showNewRegistry, setShowNewRegistry] = useState(false);
    const [expandedCredentialSaid, setExpandedCredentialSaid] = useState('');
    const [pendingRegistrySelection, setPendingRegistrySelection] = useState<{
        issuerAid: string;
        registryName: string;
    } | null>(null);
    const [draft, setDraft] = useState<SediVoterIssueFormDraft>(defaultDraft);

    const actionRunning = fetcher.state !== 'idle';
    const selectedAid = aidParam ?? walletSelectedAid ?? '';
    const selectedIdentifier =
        identifiers.find((identifier) => identifier.prefix === selectedAid) ??
        null;
    const issueableCredentialTypes = credentialTypes.filter(
        (type) => type.schemaStatus === 'resolved'
    );
    const addableCredentialTypes = credentialTypes.filter(
        (type) => type.schemaStatus !== 'resolved'
    );
    const selectedType =
        credentialTypes.find((type) => type.key === typeKey) ?? null;
    const credentialTypesBySchema = useMemo(
        () =>
            new Map(
                credentialTypes.map((credentialType) => [
                    credentialType.schemaSaid,
                    credentialType,
                ])
            ),
        [credentialTypes]
    );
    const unresolvedWalletCredentialType =
        credentialTypes.find((type) => type.schemaStatus !== 'resolved') ?? null;
    const resolvedHolderContacts = resolvedCredentialHolderContacts(contacts);
    const activeHolderContact =
        resolvedHolderContacts.find((contact) => contact.aid === holderAid) ??
        null;
    const selectedAidHeldCredentials =
        selectedIdentifier === null
            ? []
            : heldCredentialsForAid(heldCredentials, selectedIdentifier.prefix);
    const selectedAidGrants =
        selectedIdentifier === null
            ? []
            : grantsForAid(grantNotifications, selectedIdentifier.prefix);
    const issuerStats =
        selectedIdentifier === null
            ? null
            : issuerStatsForAid({
                  aid: selectedIdentifier.prefix,
                  credentialTypes,
                  issuedCredentials,
              });
    const walletStats =
        selectedIdentifier === null
            ? null
            : walletStatsForAid({
                  aid: selectedIdentifier.prefix,
                  heldCredentials,
                  grants: grantNotifications,
              });
    const issuerMode = location.pathname.endsWith('/issuer');
    const walletMode = location.pathname.endsWith('/wallet');
    const typeMode = typeKey !== undefined;
    const overviewMode =
        selectedAid.length > 0 && !issuerMode && !walletMode && !typeMode;
    const selectedAidIssuedCredentials =
        selectedIdentifier === null
            ? []
            : issuedCredentialsForAid(
                  issuedCredentials,
                  selectedIdentifier.prefix
              );

    const registryTiles =
        selectedIdentifier === null || selectedType === null
            ? []
            : registryTilesForIssuer({
                  aid: selectedIdentifier.prefix,
                  registries,
                  issuedCredentials,
                  credentialTypes,
                  selectedSchemaSaid: selectedType.schemaSaid,
              });
    const pendingRegistry =
        pendingRegistrySelection === null
            ? null
            : (readyCredentialRegistriesForIssuer(
                  registries,
                  selectedIdentifier?.prefix ?? null
              ).find(
                  (registry) =>
                      registry.issuerAid ===
                          pendingRegistrySelection.issuerAid &&
                      registry.registryName ===
                          pendingRegistrySelection.registryName
              ) ?? null);
    const selectedRegistryIdForAid = registryTiles.some(
        (tile) => tile.registry.id === walletSelectedRegistry?.id
    )
        ? (walletSelectedRegistry?.id ?? '')
        : '';
    const effectiveRegistryId =
        selectedRegistryIdForAid || pendingRegistry?.id || '';
    const selectedRegistry =
        registryTiles.find((tile) => tile.registry.id === effectiveRegistryId)
            ?.registry ?? null;
    const selectedTypeIssuedCredentials =
        selectedIdentifier === null || selectedType === null
            ? []
            : issuedCredentialsForAidAndSchema(
                  issuedCredentials,
                  selectedIdentifier.prefix,
                  selectedType.schemaSaid
              );
    const draftErrors = validateSediVoterIssueDraft(draft);
    const draftHasErrors = hasSediVoterIssueDraftErrors(draftErrors);
    const holderSelectionMessage =
        activeHolderContact !== null
            ? null
            : resolvedHolderContacts.length === 0
              ? 'No resolved non-witness holder contacts are available.'
              : holderAid.trim().length > 0
                ? 'Selected holder contact cannot receive credentials.'
                : 'Select a holder contact.';
    const issueBlockers = [
        ...(selectedIdentifier === null ? ['Select a local issuer AID.'] : []),
        ...(selectedType === null ? ['Select a credential type.'] : []),
        ...(selectedType !== null && selectedType.schemaStatus !== 'resolved'
            ? ['Add this credential type to the agent before issuing.']
            : []),
        ...(selectedRegistry === null
            ? [
                  registryTiles.length === 0
                      ? 'Create a registry for this AID before issuing.'
                      : 'Select a registry tile.',
              ]
            : []),
        ...(holderSelectionMessage === null ? [] : [holderSelectionMessage]),
        ...(draftHasErrors ? ['Fix the highlighted credential fields.'] : []),
    ];
    const issuerReady = issueBlockers.length === 0;

    useEffect(() => {
        if (
            selectedIdentifier !== null &&
            walletSelectedAid !== selectedIdentifier.prefix
        ) {
            dispatch(walletAidSelected({ aid: selectedIdentifier.prefix }));
        }
    }, [dispatch, selectedIdentifier, walletSelectedAid]);

    useEffect(() => {
        if (
            pendingRegistry !== null &&
            walletSelectedRegistry?.id !== pendingRegistry.id
        ) {
            dispatch(walletRegistrySelected({ registryId: pendingRegistry.id }));
        }
    }, [dispatch, pendingRegistry, walletSelectedRegistry?.id]);

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const actionStatus =
        fetcher.data === undefined
            ? loaderData.status === 'error'
                ? { ok: false, message: loaderData.message }
                : null
            : fetcher.data;

    const navigateToAid = (aid: string) => {
        if (aid.length === 0) {
            dispatch(walletAidCleared());
        } else {
            dispatch(walletAidSelected({ aid }));
        }
        navigate(aid.length === 0 ? credentialPath() : credentialPath(aid));
    };

    const submitResolveSchema = (credentialType: IssueableCredentialTypeView) => {
        const formData = new FormData();
        formData.set('intent', 'resolveSchema');
        formData.set('schemaSaid', credentialType.schemaSaid);
        formData.set('schemaOobiUrl', credentialType.schemaOobiUrl);
        submitWithId(fetcher, formData);
    };

    const submitCreateRegistry = () => {
        if (selectedIdentifier === null || registryName.trim().length === 0) {
            return;
        }

        const normalizedRegistryName = registryName.trim();
        const formData = new FormData();
        formData.set('intent', 'createRegistry');
        formData.set('issuerAlias', selectedIdentifier.name);
        formData.set('issuerAid', selectedIdentifier.prefix);
        formData.set('registryName', normalizedRegistryName);
        setPendingRegistrySelection({
            issuerAid: selectedIdentifier.prefix,
            registryName: normalizedRegistryName,
        });
        submitWithId(fetcher, formData);
    };

    const submitIssue = () => {
        if (
            selectedIdentifier === null ||
            selectedRegistry === null ||
            selectedType === null ||
            activeHolderContact === null ||
            activeHolderContact.aid === null
        ) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'issueCredential');
        formData.set('issuerAlias', selectedIdentifier.name);
        formData.set('issuerAid', selectedIdentifier.prefix);
        formData.set('holderAid', activeHolderContact.aid);
        formData.set('registryId', selectedRegistry.regk);
        formData.set('schemaSaid', selectedType.schemaSaid);
        Object.entries(draft).forEach(([key, value]) => {
            formData.set(key, String(value));
        });
        submitWithId(fetcher, formData);
    };

    const submitGrant = (credential: CredentialSummaryRecord) => {
        if (selectedIdentifier === null || credential.holderAid === null) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'grantCredential');
        formData.set('issuerAlias', selectedIdentifier.name);
        formData.set('issuerAid', selectedIdentifier.prefix);
        formData.set('holderAid', credential.holderAid);
        formData.set('credentialSaid', credential.said);
        submitWithId(fetcher, formData);
    };

    const submitAdmit = (notificationId: string, grantSaid: string) => {
        if (selectedIdentifier === null) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'admitCredentialGrant');
        formData.set('holderAlias', selectedIdentifier.name);
        formData.set('holderAid', selectedIdentifier.prefix);
        formData.set('notificationId', notificationId);
        formData.set('grantSaid', grantSaid);
        submitWithId(fetcher, formData);
    };

    const submitRefresh = () => {
        const formData = new FormData();
        formData.set('intent', 'refreshCredentials');
        submitWithId(fetcher, formData);
    };

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }} data-testid="credentials-view">
            <PageHeader
                eyebrow="Credentials"
                title="Credentials"
                summary="Select one local AID to view issuer or wallet activity."
                actions={
                    <Tooltip title="Refresh credential inbox, registries, and wallet inventory">
                        <span>
                            <Button
                                variant="outlined"
                                startIcon={<RefreshIcon />}
                                disabled={actionRunning}
                                onClick={submitRefresh}
                            >
                                Refresh
                            </Button>
                        </span>
                    </Tooltip>
                }
            />

            {actionStatus !== null && (
                <ConsolePanel
                    title={actionStatus.ok ? 'Command accepted' : 'Command blocked'}
                    actions={
                        <StatusPill
                            label={actionStatus.ok ? 'Accepted' : 'Error'}
                            tone={actionStatus.ok ? 'success' : 'error'}
                        />
                    }
                >
                    <Typography color="text.secondary">
                        {actionStatus.message}
                    </Typography>
                </ConsolePanel>
            )}

            <ConsolePanel title="AID">
                <Stack spacing={2}>
                    <AidSelector
                        selectedAid={selectedAid}
                        identifiers={identifiers}
                        onSelect={navigateToAid}
                    />
                    {identifiers.length === 0 && (
                        <EmptyState
                            title="No local AIDs"
                            message="Create an identifier before using credentials."
                            action={
                                <Button
                                    component={RouterLink}
                                    to="/identifiers"
                                    variant="contained"
                                >
                                    Identifiers
                                </Button>
                            }
                        />
                    )}
                    {selectedAid.length > 0 && selectedIdentifier === null && (
                        <EmptyState
                            title="AID not found"
                            message="Choose a local identifier from the AID selector."
                        />
                    )}
                </Stack>
            </ConsolePanel>

            {selectedIdentifier === null ? null : overviewMode ? (
                <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <OverviewChoiceCard
                            title="Issuer"
                            eyebrow={selectedIdentifier.name}
                            icon={<AssignmentTurnedInIcon />}
                            status={`${issuerStats?.issued ?? 0} issued`}
                            statusTone={
                                (issuerStats?.issued ?? 0) > 0
                                    ? 'success'
                                    : 'neutral'
                            }
                            onOpen={() =>
                                navigate(issuerPath(selectedIdentifier.prefix))
                            }
                            testId="credential-issuer-card"
                        >
                            <Stack spacing={2}>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: {
                                            xs: '1fr 1fr',
                                            sm: 'repeat(3, minmax(0, 1fr))',
                                        },
                                        gap: 1.5,
                                    }}
                                >
                                    <OverviewMetric
                                        label="Issuable"
                                        value={String(
                                            issuerStats?.issueableTypes ?? 0
                                        )}
                                    />
                                    <OverviewMetric
                                        label="Issued"
                                        value={String(issuerStats?.issued ?? 0)}
                                    />
                                    <OverviewMetric
                                        label="Granted"
                                        value={String(issuerStats?.granted ?? 0)}
                                    />
                                </Box>
                                <Typography variant="body2" sx={monoValueSx}>
                                    {selectedIdentifier.prefix}
                                </Typography>
                            </Stack>
                        </OverviewChoiceCard>
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }}>
                        <OverviewChoiceCard
                            title="Wallet"
                            eyebrow={selectedIdentifier.name}
                            icon={<AccountBalanceWalletOutlinedIcon />}
                            status={
                                (walletStats?.pendingGrants ?? 0) > 0
                                    ? `${walletStats?.pendingGrants} pending`
                                    : `${walletStats?.admitted ?? 0} admitted`
                            }
                            statusTone={
                                (walletStats?.pendingGrants ?? 0) > 0
                                    ? 'info'
                                    : (walletStats?.admitted ?? 0) > 0
                                      ? 'success'
                                      : 'neutral'
                            }
                            onOpen={() =>
                                navigate(walletPath(selectedIdentifier.prefix))
                            }
                            actions={
                                unresolvedWalletCredentialType === null ? null : (
                                    <Button
                                        variant="outlined"
                                        startIcon={<RefreshIcon />}
                                        disabled={
                                            actionRunning ||
                                            unresolvedWalletCredentialType.schemaStatus ===
                                                'resolving'
                                        }
                                        onClick={() =>
                                            submitResolveSchema(
                                                unresolvedWalletCredentialType
                                            )
                                        }
                                    >
                                        Add schema type
                                    </Button>
                                )
                            }
                            testId="credential-wallet-card"
                        >
                            <Stack spacing={2}>
                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: {
                                            xs: '1fr 1fr',
                                            sm: 'repeat(3, minmax(0, 1fr))',
                                        },
                                        gap: 1.5,
                                    }}
                                >
                                    <OverviewMetric
                                        label="Held types"
                                        value={String(walletStats?.heldTypes ?? 0)}
                                    />
                                    <OverviewMetric
                                        label="Admitted"
                                        value={String(walletStats?.admitted ?? 0)}
                                    />
                                    <OverviewMetric
                                        label="Present"
                                        value={String(
                                            walletStats?.presentationGrants ?? 0
                                        )}
                                    />
                                </Box>
                                {credentialTypes.length > 0 && (
                                    <Stack
                                        direction="row"
                                        spacing={1}
                                        sx={{
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                        }}
                                    >
                                        <Typography variant="body2">
                                            Credential type readiness
                                        </Typography>
                                        <StatusPill
                                            label={
                                                unresolvedWalletCredentialType ===
                                                null
                                                    ? 'resolved'
                                                    : unresolvedWalletCredentialType.schemaStatus
                                            }
                                            tone={
                                                unresolvedWalletCredentialType ===
                                                null
                                                    ? 'success'
                                                    : schemaStatusTone(
                                                          unresolvedWalletCredentialType.schemaStatus
                                                      )
                                            }
                                        />
                                    </Stack>
                                )}
                                <WalletStackPreview
                                    credentials={selectedAidHeldCredentials}
                                    credentialTypesBySchema={
                                        credentialTypesBySchema
                                    }
                                />
                            </Stack>
                        </OverviewChoiceCard>
                    </Grid>
                </Grid>
            ) : issuerMode ? (
                <Stack spacing={2}>
                    <Box>
                        <Button
                            component={RouterLink}
                            to={credentialPath(selectedIdentifier.prefix)}
                            startIcon={<ArrowBackIcon />}
                            variant="outlined"
                        >
                            Back
                        </Button>
                    </Box>
                    <ConsolePanel
                        title="Issuer"
                        eyebrow={selectedIdentifier.name}
                        actions={
                            <StatusPill
                                label={`${issuerStats?.granted ?? 0} granted`}
                                tone={
                                    (issuerStats?.granted ?? 0) > 0
                                        ? 'success'
                                        : 'neutral'
                                }
                            />
                        }
                    >
                        <Grid container spacing={1.5}>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TelemetryRow
                                    label="Issuable types"
                                    value={String(
                                        issuerStats?.issueableTypes ?? 0
                                    )}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TelemetryRow
                                    label="Issued"
                                    value={String(issuerStats?.issued ?? 0)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TelemetryRow
                                    label="Granted"
                                    value={String(issuerStats?.granted ?? 0)}
                                />
                            </Grid>
                        </Grid>
                    </ConsolePanel>
                    <ConsolePanel
                        title="Issueable credential types"
                        actions={
                            addableCredentialTypes[0] === undefined ? null : (
                                <Button
                                    variant="outlined"
                                    startIcon={<AssignmentTurnedInIcon />}
                                    disabled={actionRunning}
                                    onClick={() =>
                                        submitResolveSchema(
                                            addableCredentialTypes[0]
                                        )
                                    }
                                >
                                    Add schema type
                                </Button>
                            )
                        }
                    >
                        {issueableCredentialTypes.length === 0 ? (
                            <EmptyState
                                title="No credential types added"
                                message="Add a supported schema type to this agent before issuing credentials."
                            />
                        ) : (
                            <Box sx={{ overflowX: 'auto' }}>
                                <Table size="small" sx={{ minWidth: 560 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Type</TableCell>
                                            <TableCell align="right">
                                                Issued
                                            </TableCell>
                                            <TableCell align="right">
                                                Granted
                                            </TableCell>
                                            <TableCell>Last issued</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {issueableCredentialTypes.map(
                                            (credentialType) => {
                                                const issuedForType =
                                                    issuedCredentialsForAidAndSchema(
                                                        issuedCredentials,
                                                        selectedIdentifier.prefix,
                                                        credentialType.schemaSaid
                                                    );
                                                return (
                                                    <TableRow
                                                        key={credentialType.key}
                                                        hover
                                                        role="button"
                                                        tabIndex={0}
                                                        sx={{ cursor: 'pointer' }}
                                                        onClick={() =>
                                                            navigate(
                                                                issuerTypePath(
                                                                    selectedIdentifier.prefix,
                                                                    credentialType.key
                                                                )
                                                            )
                                                        }
                                                        onKeyDown={(event) => {
                                                            if (
                                                                event.key ===
                                                                    'Enter' ||
                                                                event.key === ' '
                                                            ) {
                                                                event.preventDefault();
                                                                navigate(
                                                                    issuerTypePath(
                                                                        selectedIdentifier.prefix,
                                                                        credentialType.key
                                                                    )
                                                                );
                                                            }
                                                        }}
                                                    >
                                                        <TableCell>
                                                            <Typography
                                                                sx={{
                                                                    fontWeight: 800,
                                                                }}
                                                            >
                                                                {
                                                                    credentialType.label
                                                                }
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {issuedForType.length}
                                                        </TableCell>
                                                        <TableCell align="right">
                                                            {
                                                                issuedForType.filter(
                                                                    (
                                                                        credential
                                                                    ) =>
                                                                        credential.grantSaid !==
                                                                        null
                                                                ).length
                                                            }
                                                        </TableCell>
                                                        <TableCell>
                                                            {timestampText(
                                                                issuedForType
                                                                    .map(
                                                                        (
                                                                            credential
                                                                        ) =>
                                                                            credential.issuedAt
                                                                    )
                                                                    .filter(
                                                                        (
                                                                            value
                                                                        ): value is string =>
                                                                            value !==
                                                                            null
                                                                    )
                                                                    .sort(
                                                                        (
                                                                            left,
                                                                            right
                                                                        ) =>
                                                                            right.localeCompare(
                                                                                left
                                                                            )
                                                                    )[0] ??
                                                                    null
                                                            )}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            }
                                        )}
                                    </TableBody>
                                </Table>
                            </Box>
                        )}
                    </ConsolePanel>
                    <ConsolePanel
                        title="Issued credentials"
                        actions={
                            <StatusPill
                                label={`${selectedAidIssuedCredentials.length} total`}
                                tone={
                                    selectedAidIssuedCredentials.length > 0
                                        ? 'success'
                                        : 'neutral'
                                }
                            />
                        }
                    >
                        {selectedAidIssuedCredentials.length === 0 ? (
                            <EmptyState
                                title="No issued credentials"
                                message="Credentials issued by this AID across all registries will appear here."
                            />
                        ) : (
                            <Box sx={{ overflowX: 'auto' }}>
                                <Table size="small" sx={{ minWidth: 840 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Type</TableCell>
                                            <TableCell>Registry</TableCell>
                                            <TableCell>Holder</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Issued</TableCell>
                                            <TableCell>Credential</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {selectedAidIssuedCredentials.map(
                                            (credential) => (
                                                <TableRow key={credential.said}>
                                                    <TableCell>
                                                        {schemaLabel(
                                                            credential.schemaSaid,
                                                            credentialTypesBySchema
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {registryLabel(
                                                            credential.registryId,
                                                            registries
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={monoValueSx}>
                                                        {abbreviateMiddle(
                                                            credential.holderAid ??
                                                                'Not available',
                                                            24
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusPill
                                                            label={
                                                                credential.status
                                                            }
                                                            tone={statusTone(
                                                                credential.status
                                                            )}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        {timestampText(
                                                            credential.issuedAt
                                                        )}
                                                    </TableCell>
                                                    <TableCell sx={monoValueSx}>
                                                        {abbreviateMiddle(
                                                            credential.said,
                                                            24
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        )}
                                    </TableBody>
                                </Table>
                            </Box>
                        )}
                    </ConsolePanel>
                </Stack>
            ) : typeMode ? (
                selectedType === null ? (
                    <Stack spacing={2}>
                        <Box>
                            <Button
                                component={RouterLink}
                                to={issuerPath(selectedIdentifier.prefix)}
                                startIcon={<ArrowBackIcon />}
                                variant="outlined"
                            >
                                Back
                            </Button>
                        </Box>
                        <EmptyState
                            title="Credential type not found"
                            message="Choose an issueable credential type from the issuer page."
                        />
                    </Stack>
                ) : selectedType.schemaStatus !== 'resolved' ? (
                    <Stack spacing={2}>
                        <Box>
                            <Button
                                component={RouterLink}
                                to={issuerPath(selectedIdentifier.prefix)}
                                startIcon={<ArrowBackIcon />}
                                variant="outlined"
                            >
                                Back
                            </Button>
                        </Box>
                        <ConsolePanel
                            title={selectedType.label}
                            eyebrow="Add credential type"
                            actions={
                                <StatusPill
                                    label={selectedType.schemaStatus}
                                    tone={schemaStatusTone(
                                        selectedType.schemaStatus
                                    )}
                                />
                            }
                        >
                            <EmptyState
                                title="Credential type not added"
                                message="Add this supported schema type to the connected agent before issuing credentials of this type."
                                action={
                                    <Button
                                        variant="contained"
                                        startIcon={<AssignmentTurnedInIcon />}
                                        disabled={actionRunning}
                                        onClick={() =>
                                            submitResolveSchema(selectedType)
                                        }
                                    >
                                        Add schema type
                                    </Button>
                                }
                            />
                        </ConsolePanel>
                    </Stack>
                ) : (
                    <Stack spacing={2}>
                        <Box>
                            <Button
                                component={RouterLink}
                                to={issuerPath(selectedIdentifier.prefix)}
                                startIcon={<ArrowBackIcon />}
                                variant="outlined"
                            >
                                Back
                            </Button>
                        </Box>
                        <ConsolePanel
                            title={selectedType.label}
                            eyebrow="Issue credential"
                            actions={
                                <StatusPill
                                    label="schema known"
                                    tone="success"
                                />
                            }
                        >
                            <Stack spacing={2}>
                                <Stack spacing={1.5}>
                                    <Stack
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={1}
                                        sx={{
                                            justifyContent: 'space-between',
                                            alignItems: {
                                                xs: 'stretch',
                                                sm: 'center',
                                            },
                                        }}
                                    >
                                        <Typography variant="h6">
                                            Registries
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            startIcon={<AddCircleOutlineIcon />}
                                            onClick={() =>
                                                setShowNewRegistry(
                                                    (current) => !current
                                                )
                                            }
                                        >
                                            New registry
                                        </Button>
                                    </Stack>
                                    <Collapse in={showNewRegistry}>
                                        <Grid container spacing={1.5}>
                                            <Grid size={{ xs: 12, md: 8 }}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Registry name"
                                                    value={registryName}
                                                    onChange={(event) =>
                                                        setRegistryName(
                                                            event.target.value
                                                        )
                                                    }
                                                />
                                            </Grid>
                                            <Grid size={{ xs: 12, md: 4 }}>
                                                <Button
                                                    fullWidth
                                                    variant="contained"
                                                    disabled={
                                                        actionRunning ||
                                                        registryName.trim()
                                                            .length === 0
                                                    }
                                                    onClick={
                                                        submitCreateRegistry
                                                    }
                                                >
                                                    Create
                                                </Button>
                                            </Grid>
                                        </Grid>
                                    </Collapse>
                                    {registryTiles.length === 0 ? (
                                        <EmptyState
                                            title="No registries"
                                            message="Create a registry for this AID before issuing."
                                        />
                                    ) : (
                                        <Box
                                            sx={{
                                                display: 'grid',
                                                gridTemplateColumns: {
                                                    xs: '1fr',
                                                    md: 'repeat(2, minmax(0, 1fr))',
                                                },
                                                gap: 1.5,
                                            }}
                                        >
                                            {registryTiles.map((tile) => {
                                                const selected =
                                                    tile.registry.id ===
                                                    effectiveRegistryId;
                                                return (
                                                    <Box
                                                        key={tile.registry.id}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={() =>
                                                            dispatch(
                                                                walletRegistrySelected(
                                                                    {
                                                                        registryId:
                                                                            tile
                                                                                .registry
                                                                                .id,
                                                                    }
                                                                )
                                                            )
                                                        }
                                                        onKeyDown={(event) => {
                                                            if (
                                                                event.key ===
                                                                    'Enter' ||
                                                                event.key === ' '
                                                            ) {
                                                                event.preventDefault();
                                                                dispatch(
                                                                    walletRegistrySelected(
                                                                        {
                                                                            registryId:
                                                                                tile
                                                                                    .registry
                                                                                    .id,
                                                                        }
                                                                    )
                                                                );
                                                            }
                                                        }}
                                                        sx={[
                                                            {
                                                                border: 1,
                                                                borderColor:
                                                                    selected
                                                                        ? 'primary.main'
                                                                        : 'divider',
                                                                borderRadius: 1,
                                                                p: 1.5,
                                                                bgcolor:
                                                                    selected
                                                                        ? 'rgba(118, 232, 255, 0.08)'
                                                                        : 'rgba(13, 23, 34, 0.72)',
                                                            },
                                                            clickablePanelSx,
                                                        ]}
                                                    >
                                                        <Stack spacing={1}>
                                                            <Stack
                                                                direction="row"
                                                                spacing={1}
                                                                sx={{
                                                                    justifyContent:
                                                                        'space-between',
                                                                    alignItems:
                                                                        'center',
                                                                }}
                                                            >
                                                                <Typography
                                                                    sx={{
                                                                        fontWeight: 800,
                                                                    }}
                                                                >
                                                                    {
                                                                        tile
                                                                            .registry
                                                                            .registryName
                                                                    }
                                                                </Typography>
                                                                <StatusPill
                                                                    label={`${tile.selectedTypeCount} selected type`}
                                                                    tone={
                                                                        selected
                                                                            ? 'info'
                                                                            : 'neutral'
                                                                    }
                                                                />
                                                            </Stack>
                                                            <Typography
                                                                variant="body2"
                                                                sx={
                                                                    monoValueSx
                                                                }
                                                            >
                                                                {abbreviateMiddle(
                                                                    tile
                                                                        .registry
                                                                        .regk,
                                                                    24
                                                                )}
                                                            </Typography>
                                                            {tile.schemaCounts.map(
                                                                (count) => (
                                                                    <TelemetryRow
                                                                        key={
                                                                            count.schemaSaid
                                                                        }
                                                                        label={
                                                                            count.label
                                                                        }
                                                                        value={String(
                                                                            count.count
                                                                        )}
                                                                    />
                                                                )
                                                            )}
                                                        </Stack>
                                                    </Box>
                                                );
                                            })}
                                        </Box>
                                    )}
                                </Stack>

                                <FormControl
                                    fullWidth
                                    size="small"
                                    error={holderSelectionMessage !== null}
                                >
                                    <InputLabel id="holder-contact-label">
                                        Holder contact
                                    </InputLabel>
                                    <Select
                                        labelId="holder-contact-label"
                                        label="Holder contact"
                                        value={holderAid}
                                        onChange={(event) =>
                                            setHolderAid(event.target.value)
                                        }
                                    >
                                        <MenuItem value="">
                                            <em>Select holder contact</em>
                                        </MenuItem>
                                        {resolvedHolderContacts.map(
                                            (contact) => (
                                                <MenuItem
                                                    key={contact.id}
                                                    value={contact.aid ?? ''}
                                                >
                                                    {contact.alias}
                                                </MenuItem>
                                            )
                                        )}
                                    </Select>
                                    {holderSelectionMessage !== null && (
                                        <FormHelperText>
                                            {holderSelectionMessage}
                                        </FormHelperText>
                                    )}
                                </FormControl>

                                <Box
                                    sx={{
                                        display: 'grid',
                                        gridTemplateColumns: {
                                            xs: '1fr',
                                            md: 'repeat(2, minmax(0, 1fr))',
                                        },
                                        gap: 1.5,
                                    }}
                                >
                                    {SEDI_VOTER_ISSUE_TEXT_FIELDS.map(
                                        ({ key, label }) => (
                                        <TextField
                                            key={key}
                                            size="small"
                                            label={label}
                                            value={draft[key]}
                                            error={draftErrors[key] !== undefined}
                                            helperText={draftErrors[key] ?? ' '}
                                            onChange={(event) =>
                                                setDraft((current) => ({
                                                    ...current,
                                                    [key]: event.target.value,
                                                }))
                                            }
                                        />
                                        )
                                    )}
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={draft.eligible}
                                                onChange={(event) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        eligible:
                                                            event.target
                                                                .checked,
                                                    }))
                                                }
                                            />
                                        }
                                        label="Eligible"
                                    />
                                </Box>

                                <Box
                                    sx={{
                                        border: 1,
                                        borderColor: issuerReady
                                            ? 'success.main'
                                            : 'warning.main',
                                        borderRadius: 1,
                                        p: 1.5,
                                        bgcolor: issuerReady
                                            ? 'rgba(31, 122, 77, 0.08)'
                                            : 'rgba(255, 180, 84, 0.08)',
                                    }}
                                >
                                    <Stack spacing={1}>
                                        <StatusPill
                                            label={
                                                issuerReady
                                                    ? 'Ready to issue'
                                                    : 'Issue blocked'
                                            }
                                            tone={
                                                issuerReady
                                                    ? 'success'
                                                    : 'warning'
                                            }
                                        />
                                        {issuerReady ? (
                                            <Typography variant="body2">
                                                Schema, registry, holder, and
                                                credential fields are ready.
                                            </Typography>
                                        ) : (
                                            <Stack spacing={0.5}>
                                                {issueBlockers.map((blocker) => (
                                                    <Typography
                                                        key={blocker}
                                                        variant="body2"
                                                    >
                                                        {blocker}
                                                    </Typography>
                                                ))}
                                            </Stack>
                                        )}
                                    </Stack>
                                </Box>

                                <Button
                                    variant="contained"
                                    startIcon={<InventoryIcon />}
                                    disabled={actionRunning || !issuerReady}
                                    onClick={submitIssue}
                                >
                                    Issue credential
                                </Button>
                            </Stack>
                        </ConsolePanel>

                        <ConsolePanel
                            title="Issued for this type"
                            actions={
                                <StatusPill
                                    label={`${selectedTypeIssuedCredentials.length} issued`}
                                    tone={
                                        selectedTypeIssuedCredentials.length > 0
                                            ? 'success'
                                            : 'neutral'
                                    }
                                />
                            }
                        >
                            {selectedTypeIssuedCredentials.length === 0 ? (
                                <EmptyState
                                    title="No issued credentials"
                                    message="Issued credentials for this type will appear here."
                                />
                            ) : (
                                <Stack spacing={1.5}>
                                    {selectedTypeIssuedCredentials.map(
                                        (credential) => (
                                            <Box
                                                key={credential.said}
                                                sx={{
                                                    border: 1,
                                                    borderColor: 'divider',
                                                    borderRadius: 1,
                                                    p: 1.5,
                                                }}
                                            >
                                                <Stack spacing={1.5}>
                                                    <Stack
                                                        direction={{
                                                            xs: 'column',
                                                            sm: 'row',
                                                        }}
                                                        spacing={1}
                                                        sx={{
                                                            justifyContent:
                                                                'space-between',
                                                            alignItems: {
                                                                xs: 'stretch',
                                                                sm: 'center',
                                                            },
                                                        }}
                                                    >
                                                        <StatusPill
                                                            label={
                                                                credential.status
                                                            }
                                                            tone={statusTone(
                                                                credential.status
                                                            )}
                                                        />
                                                        <Button
                                                            variant="outlined"
                                                            startIcon={
                                                                <SendIcon />
                                                            }
                                                            disabled={
                                                                actionRunning ||
                                                                credential.status !==
                                                                    'issued' ||
                                                                credential.holderAid ===
                                                                    null
                                                            }
                                                            onClick={() =>
                                                                submitGrant(
                                                                    credential
                                                                )
                                                            }
                                                        >
                                                            Grant
                                                        </Button>
                                                    </Stack>
                                                    <CredentialRecordRows
                                                        credential={credential}
                                                        credentialTypesBySchema={
                                                            credentialTypesBySchema
                                                        }
                                                    />
                                                </Stack>
                                            </Box>
                                        )
                                    )}
                                </Stack>
                            )}
                        </ConsolePanel>
                    </Stack>
                )
            ) : walletMode ? (
                <Stack spacing={2}>
                    <Box>
                        <Button
                            component={RouterLink}
                            to={credentialPath(selectedIdentifier.prefix)}
                            startIcon={<ArrowBackIcon />}
                            variant="outlined"
                        >
                            Back
                        </Button>
                    </Box>
                    <ConsolePanel
                        title="Credential types"
                        eyebrow={selectedIdentifier.name}
                        actions={
                            <StatusPill
                                label={
                                    unresolvedWalletCredentialType === null
                                        ? 'ready'
                                        : 'setup needed'
                                }
                                tone={
                                    unresolvedWalletCredentialType === null
                                        ? 'success'
                                        : 'warning'
                                }
                            />
                        }
                    >
                        {credentialTypes.length === 0 ? (
                            <EmptyState
                                title="No supported schemas"
                                message="No credential types are configured for this wallet."
                            />
                        ) : (
                            <Stack spacing={1.5}>
                                {credentialTypes.map((credentialType) => (
                                    <Stack
                                        key={credentialType.key}
                                        direction={{ xs: 'column', sm: 'row' }}
                                        spacing={1}
                                        sx={{
                                            justifyContent: 'space-between',
                                            alignItems: {
                                                xs: 'stretch',
                                                sm: 'center',
                                            },
                                            minWidth: 0,
                                        }}
                                    >
                                        <Box sx={{ minWidth: 0 }}>
                                            <Typography sx={{ fontWeight: 800 }}>
                                                {credentialType.label}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                sx={monoValueSx}
                                            >
                                                {abbreviateMiddle(
                                                    credentialType.schemaSaid,
                                                    28
                                                )}
                                            </Typography>
                                        </Box>
                                        <Stack
                                            direction={{ xs: 'column', sm: 'row' }}
                                            spacing={1}
                                            sx={{
                                                alignItems: {
                                                    xs: 'stretch',
                                                    sm: 'center',
                                                },
                                            }}
                                        >
                                            <StatusPill
                                                label={
                                                    credentialType.schemaStatus
                                                }
                                                tone={schemaStatusTone(
                                                    credentialType.schemaStatus
                                                )}
                                            />
                                            {credentialType.schemaStatus !==
                                                'resolved' && (
                                                <Button
                                                    variant="outlined"
                                                    startIcon={<RefreshIcon />}
                                                    disabled={
                                                        actionRunning ||
                                                        credentialType.schemaStatus ===
                                                            'resolving'
                                                    }
                                                    onClick={() =>
                                                        submitResolveSchema(
                                                            credentialType
                                                        )
                                                    }
                                                >
                                                    Add schema type
                                                </Button>
                                            )}
                                        </Stack>
                                    </Stack>
                                ))}
                            </Stack>
                        )}
                    </ConsolePanel>
                    <ConsolePanel
                        title="Wallet"
                        eyebrow={selectedIdentifier.name}
                        actions={
                            <StatusPill
                                label={`${walletStats?.pendingGrants ?? 0} pending`}
                                tone={
                                    (walletStats?.pendingGrants ?? 0) > 0
                                        ? 'info'
                                        : 'neutral'
                                }
                            />
                        }
                    >
                        <Grid container spacing={1.5}>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TelemetryRow
                                    label="Admitted"
                                    value={String(walletStats?.admitted ?? 0)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TelemetryRow
                                    label="Held types"
                                    value={String(walletStats?.heldTypes ?? 0)}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 4 }}>
                                <TelemetryRow
                                    label="Presentations"
                                    value={String(
                                        walletStats?.presentationGrants ?? 0
                                    )}
                                />
                            </Grid>
                        </Grid>
                    </ConsolePanel>

                    <ConsolePanel title="Inbound grants">
                        {selectedAidGrants.length === 0 ? (
                            <EmptyState
                                title="No credential grants"
                                message="Credential grants addressed to this AID will appear here."
                            />
                        ) : (
                            <Stack spacing={1.5}>
                                {selectedAidGrants.map((grant) => {
                                    const canAdmit =
                                        grant.status === 'actionable';
                                    return (
                                        <Box
                                            key={grant.notificationId}
                                            sx={{
                                                border: 1,
                                                borderColor: 'divider',
                                                borderRadius: 1,
                                                p: 1.5,
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
                                                        justifyContent:
                                                            'space-between',
                                                        alignItems: {
                                                            xs: 'stretch',
                                                            sm: 'center',
                                                        },
                                                    }}
                                                >
                                                    <Typography
                                                        sx={{ fontWeight: 800 }}
                                                    >
                                                        {String(
                                                            grant.attributes
                                                                .fullName ??
                                                                schemaLabel(
                                                                    grant.schemaSaid,
                                                                    credentialTypesBySchema
                                                                )
                                                        )}
                                                    </Typography>
                                                    <StatusPill
                                                        label={grant.status}
                                                        tone={
                                                            canAdmit
                                                                ? 'info'
                                                                : 'neutral'
                                                        }
                                                    />
                                                </Stack>
                                                <Typography
                                                    variant="body2"
                                                    sx={monoValueSx}
                                                >
                                                    {grant.credentialSaid}
                                                </Typography>
                                                <Button
                                                    variant="contained"
                                                    startIcon={
                                                        <CheckCircleOutlineIcon />
                                                    }
                                                    disabled={
                                                        actionRunning ||
                                                        !canAdmit
                                                    }
                                                    onClick={() =>
                                                        submitAdmit(
                                                            grant.notificationId,
                                                            grant.grantSaid
                                                        )
                                                    }
                                                >
                                                    Admit
                                                </Button>
                                            </Stack>
                                        </Box>
                                    );
                                })}
                            </Stack>
                        )}
                    </ConsolePanel>

                    <ConsolePanel title="Held credentials">
                        {selectedAidHeldCredentials.length === 0 ? (
                            <EmptyState
                                title="No held credentials"
                                message="Admitted credentials for this AID will appear here."
                            />
                        ) : (
                            <Stack spacing={1.5}>
                                {selectedAidHeldCredentials.map(
                                    (credential) => {
                                        const expanded =
                                            expandedCredentialSaid ===
                                            credential.said;
                                        return (
                                            <Box
                                                key={credential.said}
                                                role="button"
                                                tabIndex={0}
                                                onClick={() =>
                                                    setExpandedCredentialSaid(
                                                        expanded
                                                            ? ''
                                                            : credential.said
                                                    )
                                                }
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key === 'Enter' ||
                                                        event.key === ' '
                                                    ) {
                                                        event.preventDefault();
                                                        setExpandedCredentialSaid(
                                                            expanded
                                                                ? ''
                                                                : credential.said
                                                        );
                                                    }
                                                }}
                                                sx={[
                                                    {
                                                        border: 1,
                                                        borderColor: expanded
                                                            ? 'primary.main'
                                                            : 'divider',
                                                        borderRadius: 1,
                                                        p: 1.5,
                                                        bgcolor:
                                                            'rgba(13, 23, 34, 0.72)',
                                                    },
                                                    clickablePanelSx,
                                                ]}
                                            >
                                                <Stack spacing={1}>
                                                    <Stack
                                                        direction={{
                                                            xs: 'column',
                                                            sm: 'row',
                                                        }}
                                                        spacing={1}
                                                        sx={{
                                                            justifyContent:
                                                                'space-between',
                                                            alignItems: {
                                                                xs: 'stretch',
                                                                sm: 'center',
                                                            },
                                                        }}
                                                    >
                                                        <Typography
                                                            sx={{
                                                                fontWeight: 800,
                                                            }}
                                                        >
                                                            {schemaLabel(
                                                                credential.schemaSaid,
                                                                credentialTypesBySchema
                                                            )}
                                                        </Typography>
                                                        <StatusPill
                                                            label={
                                                                credential.status
                                                            }
                                                            tone={statusTone(
                                                                credential.status
                                                            )}
                                                        />
                                                    </Stack>
                                                    <Typography
                                                        variant="body2"
                                                        sx={monoValueSx}
                                                    >
                                                        {abbreviateMiddle(
                                                            credential.said,
                                                            28
                                                        )}
                                                    </Typography>
                                                    <Collapse in={expanded}>
                                                        <Box sx={{ pt: 1 }}>
                                                            <CredentialRecordRows
                                                                credential={
                                                                    credential
                                                                }
                                                                credentialTypesBySchema={
                                                                    credentialTypesBySchema
                                                                }
                                                            />
                                                        </Box>
                                                    </Collapse>
                                                </Stack>
                                            </Box>
                                        );
                                    }
                                )}
                            </Stack>
                        )}
                    </ConsolePanel>
                </Stack>
            ) : null}

        </Box>
    );
};
