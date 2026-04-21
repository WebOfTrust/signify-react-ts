import { useCallback, useEffect, useState } from 'react';
import type { SignifyClient } from 'signify-ts';
import { Box, Fab, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { toError, waitOperation } from '../../signify/client';
import { IdentifierCreateDialog } from './IdentifierCreateDialog';
import { IdentifierDetailsModal } from './IdentifierDetailsModal';
import { IdentifierTable } from './IdentifierTable';
import {
    identifiersFromResponse,
    parseIdentifierCreateArgs,
} from './identifierHelpers';
import {
    idleIdentifierAction,
    type DynamicIdentifierField,
    type IdentifierActionState,
    type IdentifierSummary,
} from './identifierTypes';

/**
 * Props for the identifiers route.
 */
export interface IdentifiersViewProps {
    client: SignifyClient;
}

/**
 * Connected identifiers feature route.
 *
 * This is the owner for identifier list loading, create/rotate operation
 * waiting, and action feedback. Child components stay presentational and
 * receive callbacks/data through props.
 */
export const IdentifiersView = ({ client }: IdentifiersViewProps) => {
    const [selectedIdentifier, setSelectedIdentifier] =
        useState<IdentifierSummary | null>(null);
    const [identifiers, setIdentifiers] = useState<IdentifierSummary[]>([]);
    const [actionState, setActionState] =
        useState<IdentifierActionState>(idleIdentifierAction);
    const [createOpen, setCreateOpen] = useState(false);
    const actionRunning = actionState.status === 'running';

    const getIdentifiers = useCallback(async () => {
        const listIdentifiers = identifiersFromResponse(
            await client.identifiers().list()
        );
        setIdentifiers(listIdentifiers);
        return listIdentifiers;
    }, [client]);

    useEffect(() => {
        getIdentifiers().catch((error) => {
            const normalized = toError(error);
            setActionState({
                status: 'error',
                message: `Unable to load identifiers: ${normalized.message}. Connect can succeed even when the browser blocks signed KERIA resource requests; check that ${client.url} is reachable from this page and allows the Signify signed-request headers.`,
                error: normalized,
            });
        });
    }, [client.url, getIdentifiers]);

    const handleRotate = async (aid: string) => {
        setActionState({
            status: 'running',
            message: `Rotating identifier ${aid}`,
            error: null,
        });

        try {
            const result = await client.identifiers().rotate(aid, {});
            const operation = await result.op();
            await waitOperation(client, operation, {
                label: `rotating identifier ${aid}`,
            });
            await getIdentifiers();
            setActionState({
                status: 'success',
                message: `Rotated identifier ${aid}`,
                error: null,
            });
        } catch (error) {
            const normalized = toError(error);
            setActionState({
                status: 'error',
                message: normalized.message,
                error: normalized,
            });
        }
    };

    const handleCreate = async (
        name: string,
        algo: string,
        fields: readonly DynamicIdentifierField[]
    ): Promise<boolean> => {
        setActionState({
            status: 'running',
            message: `Creating identifier ${name}`,
            error: null,
        });

        try {
            const args = parseIdentifierCreateArgs(algo, fields);
            const identifierClient = client.identifiers();
            const result = await identifierClient.create(
                name,
                args as Parameters<typeof identifierClient.create>[1]
            );
            const operation = await result.op();
            await waitOperation(client, operation, {
                label: `creating identifier ${name}`,
            });
            await getIdentifiers();
            setActionState({
                status: 'success',
                message: `Created identifier ${name}`,
                error: null,
            });
            return true;
        } catch (error) {
            const normalized = toError(error);
            setActionState({
                status: 'error',
                message: normalized.message,
                error: normalized,
            });
            return false;
        }
    };

    return (
        <>
            {actionState.message && (
                <Box sx={{ p: 2 }}>
                    <Typography
                        color={
                            actionState.status === 'error'
                                ? 'error'
                                : 'text.primary'
                        }
                        data-testid="identifier-action-status"
                    >
                        {actionState.message}
                    </Typography>
                </Box>
            )}
            <IdentifierTable
                identifiers={identifiers}
                onSelect={setSelectedIdentifier}
            />
            <IdentifierDetailsModal
                open={selectedIdentifier !== null}
                identifier={selectedIdentifier}
                actionRunning={actionRunning}
                onClose={() => setSelectedIdentifier(null)}
                onRotate={handleRotate}
            />
            <IdentifierCreateDialog
                open={createOpen}
                actionRunning={actionRunning}
                onClose={() => setCreateOpen(false)}
                onCreate={handleCreate}
            />
            <Fab
                color="primary"
                aria-label="add"
                style={{ position: 'fixed', bottom: '20px', right: '20px' }}
                onClick={() => setCreateOpen(true)}
                disabled={actionRunning}
            >
                <AddIcon />
            </Fab>
        </>
    );
};
