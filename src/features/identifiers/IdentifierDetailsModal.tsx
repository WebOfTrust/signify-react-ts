import type { ReactNode } from 'react';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import type { GeneratedOobiRecord } from '../../state/contacts.slice';
import type { IdentifierSummary } from './identifierTypes';
import {
    formatIdentifierMetadata,
    identifierCurrentKey,
    identifierCurrentKeys,
    identifierIdentifierIndex,
    identifierJson,
    identifierKeyIndex,
    identifierTier,
    identifierType,
    identifierUnavailableValue,
} from './identifierHelpers';

/**
 * Props for the identifier detail modal.
 */
export interface IdentifierDetailsModalProps {
    open: boolean;
    identifier: IdentifierSummary | null;
    refreshStatus: 'idle' | 'loading' | 'success' | 'error';
    refreshMessage: string | null;
    oobiState: IdentifierOobiDetailState;
    actionRunning: boolean;
    onClose: () => void;
    onRotate: (name: string) => void;
}

/**
 * Async state for detail-modal OOBI loading and copy feedback.
 */
export interface IdentifierOobiDetailState {
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string | null;
    records: GeneratedOobiRecord[];
}

interface DetailFieldProps {
    label: string;
    value: string;
    mono?: boolean;
    accessory?: ReactNode;
    footprint?: 'compact' | 'medium' | 'wide';
    tone?: 'neutral' | 'identity' | 'key' | 'metric';
}

const detailGridColumn = (footprint: DetailFieldProps['footprint']) => ({
    xs: '1 / -1',
    sm:
        footprint === 'wide'
            ? '1 / -1'
            : footprint === 'compact'
              ? 'span 2'
              : 'span 3',
});

const detailTone = (tone: DetailFieldProps['tone']) => {
    if (tone === 'identity') {
        return { bgcolor: 'background.paper', borderColor: 'primary.light' };
    }

    if (tone === 'key') {
        return { bgcolor: 'background.paper', borderColor: 'success.light' };
    }

    if (tone === 'metric') {
        return { bgcolor: 'action.hover', borderColor: 'divider' };
    }

    return { bgcolor: 'background.paper', borderColor: 'divider' };
};

const DetailField = ({
    label,
    value,
    mono = false,
    accessory,
    footprint = 'medium',
    tone = 'neutral',
}: DetailFieldProps) => (
    <Box
        sx={{
            ...detailTone(tone),
            border: 1,
            borderRadius: 1,
            display: 'flex',
            flexDirection: 'column',
            gridColumn: detailGridColumn(footprint),
            justifyContent: 'center',
            minHeight: footprint === 'wide' ? 76 : 64,
            minWidth: 0,
            px: footprint === 'compact' ? 1.25 : 1.5,
            py: 1.25,
        }}
    >
        <Typography variant="caption" color="text.secondary">
            {label}
        </Typography>
        <Stack
            direction="row"
            spacing={1}
            sx={{ mt: 0.5, alignItems: 'center' }}
        >
            <Typography
                variant="body2"
                sx={{
                    fontFamily: mono ? 'var(--app-mono-font)' : undefined,
                    overflowWrap: 'anywhere',
                    minWidth: 0,
                }}
            >
                {value}
            </Typography>
            {accessory}
        </Stack>
    </Box>
);

const jsonTokenPattern =
    /("(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|true|false|null|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;

const renderJsonLine = (line: string, lineIndex: number): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of line.matchAll(jsonTokenPattern)) {
        const token = match[0];
        const index = match.index ?? 0;

        if (index > lastIndex) {
            nodes.push(line.slice(lastIndex, index));
        }

        const remainder = line.slice(index + token.length).trimStart();
        const className = token.startsWith('"')
            ? remainder.startsWith(':')
                ? 'json-key'
                : 'json-string'
            : token === 'true' || token === 'false'
              ? 'json-boolean'
              : token === 'null'
                ? 'json-null'
                : 'json-number';

        nodes.push(
            <Box
                key={`${lineIndex}-${index}`}
                component="span"
                className={className}
            >
                {token}
            </Box>
        );
        lastIndex = index + token.length;
    }

    if (lastIndex < line.length) {
        nodes.push(line.slice(lastIndex));
    }

    return nodes;
};

const JsonCodeBlock = ({ value }: { value: string }) => (
    <Box
        component="pre"
        sx={{
            m: 0,
            maxHeight: '50dvh',
            overflow: 'auto',
            p: 2,
            borderRadius: 1,
            bgcolor: 'background.default',
            color: 'text.primary',
            fontFamily: 'var(--app-mono-font)',
            fontSize: '0.8125rem',
            lineHeight: 1.6,
            whiteSpace: 'pre',
            '.json-key': { color: 'info.main' },
            '.json-string': { color: 'success.main' },
            '.json-number': { color: 'warning.dark' },
            '.json-boolean': { color: 'secondary.main' },
            '.json-null': { color: 'text.disabled', fontStyle: 'italic' },
        }}
    >
        {value.split('\n').map((line, index, lines) => (
            <span key={index}>
                {renderJsonLine(line, index)}
                {index < lines.length - 1 ? '\n' : null}
            </span>
        ))}
    </Box>
);

const copyValue = (value: string): void => {
    void globalThis.navigator.clipboard?.writeText(value);
};

/**
 * Identifier details and rotate action.
 *
 * The modal receives `onRotate` rather than calling Signify directly so all
 * KERIA operation waiting and error state stays in `IdentifiersView`.
 */
export const IdentifierDetailsModal = ({
    open,
    identifier,
    refreshStatus,
    refreshMessage,
    oobiState,
    actionRunning,
    onClose,
    onRotate,
}: IdentifierDetailsModalProps) => {
    const currentKeys =
        identifier === null ? [] : identifierCurrentKeys(identifier);
    const currentKey =
        identifier === null
            ? identifierUnavailableValue
            : (identifierCurrentKey(identifier) ?? identifierUnavailableValue);
    const currentKeyDisplay =
        refreshStatus === 'loading' && currentKey === identifierUnavailableValue
            ? 'Loading from KERIA...'
            : currentKey;
    const additionalKeyCount = Math.max(currentKeys.length - 1, 0);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
            fullWidth
            maxWidth="md"
            slotProps={{
                paper: {
                    sx: {
                        m: { xs: 2, sm: 4 },
                        width: { xs: 'calc(100% - 32px)', sm: '100%' },
                    },
                },
            }}
        >
            <DialogTitle id="modal-modal-title">Identifier Details</DialogTitle>
            <DialogContent
                id="modal-modal-description"
                dividers
                sx={{ overflowWrap: 'anywhere' }}
            >
                <Stack spacing={2}>
                    <Box
                        sx={{
                            display: 'grid',
                            gridTemplateColumns: {
                                xs: '1fr',
                                sm: 'repeat(6, minmax(0, 1fr))',
                            },
                            gap: 1.25,
                        }}
                    >
                        <DetailField
                            label="Name"
                            value={
                                identifier?.name ?? identifierUnavailableValue
                            }
                            footprint="medium"
                            tone="identity"
                        />
                        <DetailField
                            label="AID"
                            value={
                                identifier?.prefix ?? identifierUnavailableValue
                            }
                            mono
                            footprint="wide"
                            tone="identity"
                        />
                        <DetailField
                            label="Type"
                            value={
                                identifier === null
                                    ? identifierUnavailableValue
                                    : identifierType(identifier)
                            }
                            footprint="compact"
                        />
                        <DetailField
                            label="Current Key"
                            value={currentKeyDisplay}
                            mono
                            footprint="wide"
                            tone="key"
                            accessory={
                                refreshStatus === 'loading' ? (
                                    <Chip
                                        size="small"
                                        label="refreshing"
                                        color="info"
                                        variant="outlined"
                                    />
                                ) : additionalKeyCount > 0 ? (
                                    <Chip
                                        size="small"
                                        label={`+${additionalKeyCount} more`}
                                    />
                                ) : null
                            }
                        />
                        <DetailField
                            label="Key Index"
                            value={
                                identifier === null
                                    ? identifierUnavailableValue
                                    : formatIdentifierMetadata(
                                          identifierKeyIndex(identifier)
                                      )
                            }
                            footprint="compact"
                            tone="metric"
                        />
                        <DetailField
                            label="Identifier Index"
                            value={
                                identifier === null
                                    ? identifierUnavailableValue
                                    : formatIdentifierMetadata(
                                          identifierIdentifierIndex(identifier)
                                      )
                            }
                            footprint="compact"
                            tone="metric"
                        />
                        <DetailField
                            label="Tier"
                            value={
                                identifier === null
                                    ? identifierUnavailableValue
                                    : formatIdentifierMetadata(
                                          identifierTier(identifier)
                                      )
                            }
                            footprint="compact"
                            tone="metric"
                        />
                    </Box>
                    {refreshStatus === 'error' && refreshMessage !== null && (
                        <Typography color="error">
                            Unable to refresh identifier details:{' '}
                            {refreshMessage}
                        </Typography>
                    )}
                    <Accordion disableGutters defaultExpanded>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack
                                direction="row"
                                spacing={1}
                                sx={{ alignItems: 'center' }}
                            >
                                <Typography>OOBIs</Typography>
                                {oobiState.status === 'loading' && (
                                    <CircularProgress size={16} />
                                )}
                            </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                            <IdentifierOobis state={oobiState} />
                        </AccordionDetails>
                    </Accordion>
                    {identifier !== null && (
                        <Accordion disableGutters>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Advanced JSON</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <JsonCodeBlock
                                    value={identifierJson(identifier)}
                                />
                            </AccordionDetails>
                        </Accordion>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions
                sx={{
                    flexDirection: { xs: 'column-reverse', sm: 'row' },
                    gap: 1,
                    px: { xs: 2, sm: 3 },
                    py: 2,
                }}
            >
                <Button
                    onClick={onClose}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                    Close
                </Button>
                <Button
                    variant="contained"
                    startIcon={<RotateRightIcon />}
                    disabled={actionRunning || !identifier?.name}
                    onClick={() => {
                        if (identifier?.name) {
                            onRotate(identifier.name);
                        }
                    }}
                    sx={{ width: { xs: '100%', sm: 'auto' } }}
                >
                    {actionRunning ? 'Working...' : 'Rotate'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

const IdentifierOobis = ({ state }: { state: IdentifierOobiDetailState }) => {
    if (state.status === 'loading' || state.status === 'idle') {
        return (
            <Typography color="text.secondary">
                Loading identifier OOBIs...
            </Typography>
        );
    }

    if (state.status === 'error') {
        return (
            <Typography color="error">
                Unable to load identifier OOBIs: {state.message}
            </Typography>
        );
    }

    if (state.records.length === 0) {
        return (
            <Typography color="text.secondary">
                No OOBIs are available for this identifier.
            </Typography>
        );
    }

    return (
        <Stack spacing={1}>
            {state.records.map((record) => (
                <Box
                    key={record.id}
                    sx={{
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        px: 1.5,
                        py: 1.25,
                    }}
                >
                    <Stack spacing={1}>
                        <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}
                        >
                            <Chip
                                size="small"
                                label={`${record.role} OOBI`}
                                color={record.role === 'agent' ? 'primary' : 'info'}
                                variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary">
                                {record.oobis.length} URL
                                {record.oobis.length === 1 ? '' : 's'}
                            </Typography>
                        </Stack>
                        {record.oobis.map((oobi) => (
                            <Box
                                key={oobi}
                                sx={{
                                    display: 'grid',
                                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                                    gap: 1,
                                    alignItems: 'start',
                                }}
                            >
                                <Typography
                                    variant="body2"
                                    sx={{
                                        fontFamily: 'var(--app-mono-font)',
                                        overflowWrap: 'anywhere',
                                        minWidth: 0,
                                    }}
                                >
                                    {oobi}
                                </Typography>
                                <Tooltip title={`Copy ${record.role} OOBI`}>
                                    <IconButton
                                        size="small"
                                        aria-label={`Copy ${record.role} OOBI`}
                                        onClick={() => copyValue(oobi)}
                                    >
                                        <ContentCopyIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            </Box>
                        ))}
                    </Stack>
                </Box>
            ))}
        </Stack>
    );
};
