import {
    Box,
    Card,
    CardActionArea,
    CardContent,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import type { IdentifierSummary } from './identifierTypes';

/**
 * Props for the identifier list table.
 */
export interface IdentifierTableProps {
    identifiers: readonly IdentifierSummary[];
    onSelect: (identifier: IdentifierSummary) => void;
}

/**
 * Best-effort identifier algorithm/type label.
 *
 * This preserves the legacy table display until Signify identifier responses
 * are modeled explicitly.
 */
const identifierType = (identifier: IdentifierSummary): string =>
    'salty' in identifier
        ? 'salty'
        : 'randy' in identifier
          ? 'randy'
          : 'group' in identifier
            ? 'group'
            : 'extern' in identifier
              ? 'extern'
              : '';

/**
 * Pure identifier list table.
 *
 * It renders rows and selection only; loading, errors, and KERIA operations
 * belong to `IdentifiersView`.
 */
export const IdentifierTable = ({
    identifiers,
    onSelect,
}: IdentifierTableProps) => (
    <Box data-testid="identifier-table">
        <Stack spacing={1.5} sx={{ display: { xs: 'flex', sm: 'none' } }}>
            {identifiers.map((identifier) => (
                <Card key={identifier.name} variant="outlined">
                    <CardActionArea onClick={() => onSelect(identifier)}>
                        <CardContent>
                            <Stack spacing={0.75}>
                                <Typography variant="subtitle1">
                                    {identifier.name}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ overflowWrap: 'anywhere' }}
                                >
                                    {identifier.prefix}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    color="text.secondary"
                                >
                                    {identifierType(identifier)}
                                </Typography>
                            </Stack>
                        </CardContent>
                    </CardActionArea>
                </Card>
            ))}
        </Stack>
        <TableContainer
            component={Paper}
            sx={{ display: { xs: 'none', sm: 'block' } }}
        >
            <Table sx={{ minWidth: 650 }} aria-label="identifier table">
                <TableHead>
                    <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Prefix</TableCell>
                        <TableCell>Type</TableCell>
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
                            <TableCell sx={{ overflowWrap: 'anywhere' }}>
                                {identifier.prefix}
                            </TableCell>
                            <TableCell>{identifierType(identifier)}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    </Box>
);
