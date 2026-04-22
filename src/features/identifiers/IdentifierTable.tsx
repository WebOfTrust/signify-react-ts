import { useState, type MouseEvent } from 'react';
import {
    Box,
    Card,
    CardActions,
    CardContent,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import type { IdentifierSummary } from './identifierTypes';
import {
    formatIdentifierMetadata,
    identifierIdentifierIndex,
    identifierKeyIndex,
    identifierType,
    truncateMiddle,
} from './identifierHelpers';

/**
 * Props for the identifier list table.
 */
export interface IdentifierTableProps {
    identifiers: readonly IdentifierSummary[];
    onSelect: (identifier: IdentifierSummary) => void;
    onRotate: (name: string) => void;
    isRotateDisabled: (identifier: IdentifierSummary) => boolean;
    onCopyAgentOobi: (identifier: IdentifierSummary) => void;
    agentOobiCopyStatus: Record<string, IdentifierOobiCopyStatus>;
}

export interface IdentifierOobiCopyStatus {
    status: 'idle' | 'loading' | 'success' | 'error';
    message: string | null;
}

const monoSx = {
    fontFamily: 'var(--app-mono-font)',
    letterSpacing: 0,
};

const tableHeadBg = 'rgba(39, 215, 255, 0.06)';

const compactOnlyActionSx = {
    display: { sm: 'inline-flex', lg: 'none' },
} as const;

const mdUpCellSx = {
    display: { sm: 'none', md: 'table-cell' },
} as const;

const lgUpCellSx = {
    display: { sm: 'none', lg: 'table-cell' },
} as const;

const stickyActionCellSx = {
    position: 'sticky',
    right: 0,
    zIndex: 2,
    width: { sm: 104, lg: 72 },
    minWidth: { sm: 104, lg: 72 },
    bgcolor: 'background.paper',
    borderLeft: 1,
    borderLeftColor: 'divider',
} as const;

const stickyActionHeadCellSx = {
    ...stickyActionCellSx,
    zIndex: 4,
    bgcolor: tableHeadBg,
} as const;

interface CopyableMonoValueProps {
    value: string;
    label: string;
    copied: boolean;
    onCopy: (value: string) => void;
}

const CopyableMonoValue = ({
    value,
    label,
    copied,
    onCopy,
}: CopyableMonoValueProps) => (
    <Tooltip title={copied ? `Copied ${value}` : value}>
        <Box
            component="button"
            type="button"
            onClick={(event) => {
                event.stopPropagation();
                onCopy(value);
            }}
            sx={{
                p: 0,
                m: 0,
                border: 0,
                bgcolor: 'transparent',
                color: copied ? 'success.main' : 'primary.main',
                cursor: 'copy',
                display: 'inline-block',
                fontSize: 'inherit',
                lineHeight: 'inherit',
                textAlign: 'left',
                maxWidth: '100%',
                overflow: 'hidden',
                textOverflow: 'clip',
                verticalAlign: 'bottom',
                whiteSpace: 'nowrap',
                ...monoSx,
            }}
            aria-label={`Copy ${label} ${value}`}
        >
            {truncateMiddle(value)}
        </Box>
    </Tooltip>
);

/**
 * Pure identifier list table.
 *
 * It renders rows and selection only; loading, errors, and KERIA operations
 * belong to `IdentifiersView`.
 */
export const IdentifierTable = ({
    identifiers,
    onSelect,
    onRotate,
    isRotateDisabled,
    onCopyAgentOobi,
    agentOobiCopyStatus,
}: IdentifierTableProps) => {
    const [copiedValue, setCopiedValue] = useState<string | null>(null);

    const copyValue = (value: string) => {
        void globalThis.navigator.clipboard
            ?.writeText(value)
            .catch(() => undefined);
        setCopiedValue(value);
        globalThis.setTimeout(() => {
            setCopiedValue((current) => (current === value ? null : current));
        }, 1500);
    };

    const rotate = (
        event: MouseEvent<HTMLButtonElement>,
        identifier: IdentifierSummary
    ) => {
        event.stopPropagation();
        onRotate(identifier.name);
    };

    const copyAgentOobi = (
        event: MouseEvent<HTMLButtonElement>,
        identifier: IdentifierSummary
    ) => {
        event.stopPropagation();
        onCopyAgentOobi(identifier);
    };

    return (
        <Box data-testid="identifier-table">
            <Stack spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' } }}>
                {identifiers.map((identifier) => (
                    <Card
                        key={identifier.name}
                        variant="outlined"
                        data-testid={`identifier-row-${identifier.name}`}
                        sx={{
                            bgcolor: 'background.paper',
                            borderColor: 'divider',
                            '&:hover': {
                                borderColor: 'primary.main',
                            },
                        }}
                    >
                        <CardContent>
                            <Stack
                                spacing={0.75}
                                onClick={() => onSelect(identifier)}
                                sx={{ cursor: 'pointer' }}
                            >
                                <Typography variant="subtitle1">
                                    {identifier.name}
                                </Typography>
                                <Box>
                                    <CopyableMonoValue
                                        value={identifier.prefix}
                                        label="full AID"
                                        copied={
                                            copiedValue === identifier.prefix
                                        }
                                        onCopy={copyValue}
                                    />
                                </Box>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {identifierType(identifier)}
                                </Typography>
                                <Stack direction="row" spacing={2}>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        KIDX:{' '}
                                        {formatIdentifierMetadata(
                                            identifierKeyIndex(identifier)
                                        )}
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        color="text.secondary"
                                    >
                                        PIDX:{' '}
                                        {formatIdentifierMetadata(
                                            identifierIdentifierIndex(
                                                identifier
                                            )
                                        )}
                                    </Typography>
                                </Stack>
                            </Stack>
                        </CardContent>
                        <CardActions
                            sx={{
                                justifyContent: 'flex-end',
                                minHeight: 48,
                                pt: 0,
                                flexWrap: 'nowrap',
                            }}
                        >
                            <OobiCopyButton
                                identifier={identifier}
                                copyStatus={agentOobiCopyStatus[identifier.name]}
                                onCopy={copyAgentOobi}
                            />
                            <Tooltip title="Rotate identifier">
                                <span>
                                    <IconButton
                                        aria-label={`Rotate identifier ${identifier.name}`}
                                        disabled={isRotateDisabled(identifier)}
                                        onClick={(event) =>
                                            rotate(event, identifier)
                                        }
                                    >
                                        <RotateRightIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </CardActions>
                    </Card>
                ))}
            </Stack>
            <TableContainer
                component={Paper}
                sx={{
                    display: { xs: 'none', sm: 'block' },
                    bgcolor: 'background.paper',
                    borderColor: 'divider',
                    overflowX: 'auto',
                }}
            >
                <Table
                    sx={{
                        minWidth: { sm: 520, md: 680, lg: 900 },
                        tableLayout: 'fixed',
                    }}
                    aria-label="identifier table"
                >
                    <TableHead>
                        <TableRow
                            sx={{
                                bgcolor: tableHeadBg,
                            }}
                        >
                            <TableCell
                                sx={{
                                    width: { sm: '28%', md: '24%', lg: '17%' },
                                }}
                            >
                                Name
                            </TableCell>
                            <TableCell
                                sx={{
                                    width: { sm: '52%', md: '42%', lg: '34%' },
                                }}
                            >
                                AID
                            </TableCell>
                            <TableCell sx={{ ...mdUpCellSx, width: '12%' }}>
                                Type
                            </TableCell>
                            <TableCell sx={{ ...lgUpCellSx, width: '9%' }}>
                                KIDX
                            </TableCell>
                            <TableCell sx={{ ...lgUpCellSx, width: '9%' }}>
                                PIDX
                            </TableCell>
                            <TableCell
                                align="center"
                                sx={{ ...lgUpCellSx, width: 72 }}
                            >
                                OOBI
                            </TableCell>
                            <TableCell align="right" sx={stickyActionHeadCellSx}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {identifiers.map((identifier) => (
                            <TableRow
                                key={identifier.name}
                                data-testid={`identifier-table-row-${identifier.name}`}
                                sx={{
                                    cursor: 'pointer',
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                    },
                                    '&:hover .identifier-actions-cell': {
                                        bgcolor: 'rgba(39, 215, 255, 0.1)',
                                    },
                                    '&:last-child td, &:last-child th': {
                                        border: 0,
                                    },
                                }}
                                onClick={() => onSelect(identifier)}
                            >
                                <TableCell
                                    component="th"
                                    scope="row"
                                    sx={{ minWidth: 0 }}
                                >
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {identifier.name}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ minWidth: 0 }}>
                                    <CopyableMonoValue
                                        value={identifier.prefix}
                                        label="full AID"
                                        copied={
                                            copiedValue === identifier.prefix
                                        }
                                        onCopy={copyValue}
                                    />
                                </TableCell>
                                <TableCell sx={mdUpCellSx}>
                                    {identifierType(identifier)}
                                </TableCell>
                                <TableCell sx={lgUpCellSx}>
                                    {formatIdentifierMetadata(
                                        identifierKeyIndex(identifier)
                                    )}
                                </TableCell>
                                <TableCell sx={lgUpCellSx}>
                                    {formatIdentifierMetadata(
                                        identifierIdentifierIndex(identifier)
                                    )}
                                </TableCell>
                                <TableCell align="center" sx={lgUpCellSx}>
                                    <OobiCopyButton
                                        identifier={identifier}
                                        copyStatus={
                                            agentOobiCopyStatus[identifier.name]
                                        }
                                        onCopy={copyAgentOobi}
                                    />
                                </TableCell>
                                <TableCell
                                    align="right"
                                    className="identifier-actions-cell"
                                    sx={stickyActionCellSx}
                                >
                                    <Stack
                                        direction="row"
                                        spacing={0.25}
                                        sx={{
                                            alignItems: 'center',
                                            flexWrap: 'nowrap',
                                            justifyContent: 'flex-end',
                                        }}
                                    >
                                        <Box sx={compactOnlyActionSx}>
                                            <OobiCopyButton
                                                identifier={identifier}
                                                copyStatus={
                                                    agentOobiCopyStatus[
                                                        identifier.name
                                                    ]
                                                }
                                                onCopy={copyAgentOobi}
                                                size="small"
                                            />
                                        </Box>
                                        <Tooltip title="Rotate identifier">
                                            <span>
                                                <IconButton
                                                    size="small"
                                                    aria-label={`Rotate identifier ${identifier.name}`}
                                                    disabled={isRotateDisabled(
                                                        identifier
                                                    )}
                                                    onClick={(event) =>
                                                        rotate(event, identifier)
                                                    }
                                                >
                                                    <RotateRightIcon fontSize="small" />
                                                </IconButton>
                                            </span>
                                        </Tooltip>
                                    </Stack>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

const oobiCopyTooltip = (
    status: IdentifierOobiCopyStatus | undefined
): string => {
    if (status?.status === 'loading') {
        return 'Fetching agent OOBI...';
    }

    if (status?.status === 'success') {
        return 'Copied agent OOBI';
    }

    if (status?.status === 'error') {
        return status.message ?? 'Unable to copy agent OOBI';
    }

    return 'Copy agent OOBI';
};

const OobiCopyButton = ({
    identifier,
    copyStatus,
    onCopy,
    size = 'medium',
}: {
    identifier: IdentifierSummary;
    copyStatus: IdentifierOobiCopyStatus | undefined;
    onCopy: (
        event: MouseEvent<HTMLButtonElement>,
        identifier: IdentifierSummary
    ) => void;
    size?: 'small' | 'medium';
}) => (
    <Tooltip title={oobiCopyTooltip(copyStatus)}>
        <span>
            <IconButton
                size={size}
                aria-label={`Copy agent OOBI for ${identifier.name}`}
                disabled={copyStatus?.status === 'loading'}
                color={
                    copyStatus?.status === 'success'
                        ? 'success'
                        : copyStatus?.status === 'error'
                          ? 'error'
                          : 'default'
                }
                onClick={(event) => onCopy(event, identifier)}
            >
                <ContentCopyIcon
                    fontSize={size === 'small' ? 'small' : 'medium'}
                />
            </IconButton>
        </span>
    </Tooltip>
);
