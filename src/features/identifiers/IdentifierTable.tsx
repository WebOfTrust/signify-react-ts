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
}

const monoSx = {
    fontFamily: 'var(--app-mono-font)',
    letterSpacing: 0,
};

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
                fontSize: 'inherit',
                lineHeight: 'inherit',
                textAlign: 'left',
                maxWidth: '100%',
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

    return (
        <Box data-testid="identifier-table">
            <Stack spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' } }}>
                {identifiers.map((identifier) => (
                    <Card
                        key={identifier.name}
                        variant="outlined"
                        data-testid={`identifier-row-${identifier.name}`}
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
                                            identifierIdentifierIndex(identifier)
                                        )}
                                    </Typography>
                                </Stack>
                            </Stack>
                        </CardContent>
                        <CardActions sx={{ justifyContent: 'flex-end', pt: 0 }}>
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
                sx={{ display: { xs: 'none', sm: 'block' } }}
            >
                <Table sx={{ minWidth: 800 }} aria-label="identifier table">
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>AID</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>KIDX</TableCell>
                            <TableCell>PIDX</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {identifiers.map((identifier) => (
                            <TableRow
                                key={identifier.name}
                                sx={{
                                    cursor: 'pointer',
                                    '&:last-child td, &:last-child th': {
                                        border: 0,
                                    },
                                }}
                                onClick={() => onSelect(identifier)}
                            >
                                <TableCell component="th" scope="row">
                                    {identifier.name}
                                </TableCell>
                                <TableCell>
                                    <CopyableMonoValue
                                        value={identifier.prefix}
                                        label="full AID"
                                        copied={
                                            copiedValue === identifier.prefix
                                        }
                                        onCopy={copyValue}
                                    />
                                </TableCell>
                                <TableCell>
                                    {identifierType(identifier)}
                                </TableCell>
                                <TableCell>
                                    {formatIdentifierMetadata(
                                        identifierKeyIndex(identifier)
                                    )}
                                </TableCell>
                                <TableCell>
                                    {formatIdentifierMetadata(
                                        identifierIdentifierIndex(identifier)
                                    )}
                                </TableCell>
                                <TableCell align="right">
                                    <Tooltip title="Rotate identifier">
                                        <span>
                                            <IconButton
                                                aria-label={`Rotate identifier ${identifier.name}`}
                                                disabled={isRotateDisabled(
                                                    identifier
                                                )}
                                                onClick={(event) =>
                                                    rotate(event, identifier)
                                                }
                                            >
                                                <RotateRightIcon />
                                            </IconButton>
                                        </span>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};
