import {
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Typography,
} from '@mui/material';
import type { IdentifierSummary } from './identifierTypes';

/**
 * Props for the identifier detail modal.
 */
export interface IdentifierDetailsModalProps {
    open: boolean;
    identifier: IdentifierSummary | null;
    actionRunning: boolean;
    onClose: () => void;
    onRotate: (name: string) => void;
}

/**
 * Best-effort display type for the current Signify identifier payload.
 *
 * The legacy UI used the third object key to find the algorithm-specific
 * details. Preserve that behavior here until the identifier model is made
 * explicit.
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

const identifierDetails = (identifier: IdentifierSummary): unknown => {
    if ('salty' in identifier) {
        return identifier.salty;
    }

    if ('randy' in identifier) {
        return identifier.randy;
    }

    if ('group' in identifier) {
        return identifier.group;
    }

    if ('extern' in identifier) {
        return identifier.extern;
    }

    return undefined;
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
    actionRunning,
    onClose,
    onRotate,
}: IdentifierDetailsModalProps) => {
    const type = identifier ? identifierType(identifier) : '';

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
                <Stack spacing={1.5}>
                    <Typography>Name: {identifier?.name}</Typography>
                    <Typography>Prefix: {identifier?.prefix}</Typography>
                    <Typography>Type: {type}</Typography>
                    <Box
                        component="pre"
                        sx={{
                            m: 0,
                            maxHeight: '50dvh',
                            overflow: 'auto',
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                        }}
                    >
                        {JSON.stringify(
                            identifier === null
                                ? undefined
                                : identifierDetails(identifier),
                            null,
                            2
                        )}
                    </Box>
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
