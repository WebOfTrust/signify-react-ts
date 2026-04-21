import {
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
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
    <TableContainer component={Paper} data-testid="identifier-table">
        <Table sx={{ minWidth: 650 }} aria-label="simple table">
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
                            '&:last-child td, &:last-child th': {
                                border: 0,
                            },
                        }}
                        onClick={() => onSelect(identifier)}
                        style={{ cursor: 'pointer' }}
                    >
                        <TableCell component="th" scope="row">
                            {identifier.name}
                        </TableCell>
                        <TableCell>{identifier.prefix}</TableCell>
                        <TableCell>{identifierType(identifier)}</TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </TableContainer>
);
