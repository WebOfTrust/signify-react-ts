import { useState } from 'react';
import { Box, Fab, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useFetcher, useLoaderData } from 'react-router-dom';
import type { Algos } from 'signify-ts';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import type {
    IdentifierActionData,
    IdentifiersLoaderData,
} from '../../app/routeData';
import { IdentifierCreateDialog } from './IdentifierCreateDialog';
import { IdentifierDetailsModal } from './IdentifierDetailsModal';
import { IdentifierTable } from './IdentifierTable';
import {
    idleIdentifierAction,
    type DynamicIdentifierField,
    type IdentifierActionState,
    type IdentifierSummary,
} from './identifierTypes';

/**
 * Connected identifiers feature route.
 *
 * Identifier list loading and mutations are owned by the route loader/action.
 * The component owns only selected-row, dialog, and visible action-feedback
 * state while child components stay presentational.
 */
export const IdentifiersView = () => {
    const loaderData = useLoaderData() as IdentifiersLoaderData;
    const fetcher = useFetcher<IdentifierActionData>();
    const [selectedIdentifier, setSelectedIdentifier] =
        useState<IdentifierSummary | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [pendingMessage, setPendingMessage] = useState<string | null>(null);
    const actionRunning = fetcher.state !== 'idle';

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    const identifiers = loaderData.identifiers;

    const actionState: IdentifierActionState = (() => {
        if (actionRunning) {
            return {
                status: 'running',
                message: pendingMessage ?? 'Working...',
                error: null,
            };
        }

        if (fetcher.data !== undefined) {
            if (fetcher.data.ok) {
                return {
                    status: 'success',
                    message: fetcher.data.message,
                    error: null,
                };
            }

            return {
                status: 'error',
                message: fetcher.data.message,
                error: new Error(fetcher.data.message),
            };
        }

        if (loaderData.status === 'error') {
            return {
                status: 'error',
                message: loaderData.message,
                error: new Error(loaderData.message),
            };
        }

        return idleIdentifierAction;
    })();

    const handleRotate = (aid: string) => {
        setPendingMessage(`Rotating identifier ${aid}`);
        const formData = new FormData();
        formData.set('intent', 'rotate');
        formData.set('aid', aid);
        fetcher.submit(formData, { method: 'post' });
    };

    const handleCreate = async (
        name: string,
        algo: Algos,
        fields: readonly DynamicIdentifierField[]
    ): Promise<void> => {
        setPendingMessage(`Creating identifier ${name}`);
        setCreateOpen(false);
        const formData = new FormData();
        formData.set('intent', 'create');
        formData.set('name', name);
        formData.set('algo', algo);
        formData.set('fields', JSON.stringify(fields));
        fetcher.submit(formData, { method: 'post' });
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
            {createOpen && (
                <IdentifierCreateDialog
                    open={createOpen}
                    actionRunning={actionRunning}
                    onClose={() => setCreateOpen(false)}
                    onCreate={handleCreate}
                />
            )}
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
