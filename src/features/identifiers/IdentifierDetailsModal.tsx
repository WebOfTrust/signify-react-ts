import { Box, Button, Modal } from '@mui/material';
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
    Object.keys(identifier)[2] ?? '';

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
        <Modal
            open={open}
            onClose={onClose}
            aria-labelledby="modal-modal-title"
            aria-describedby="modal-modal-description"
        >
            <Box
                sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 400,
                    bgcolor: 'background.paper',
                    boxShadow: 24,
                    p: 4,
                    overflow: 'auto',
                    maxHeight: '80vh',
                }}
            >
                <h2>Identifier Details</h2>
                <p>Name: {identifier?.name}</p>
                <p>Prefix: {identifier?.prefix}</p>
                <p>Type: {type}</p>
                <pre>
                    {JSON.stringify(
                        identifier === null ? undefined : identifier[type],
                        null,
                        2
                    )}
                </pre>
                <Button
                    disabled={actionRunning || !identifier?.name}
                    onClick={() => {
                        if (identifier?.name) {
                            onRotate(identifier.name);
                        }
                    }}
                >
                    {actionRunning ? 'Working...' : 'Rotate'}
                </Button>
            </Box>
        </Modal>
    );
};
