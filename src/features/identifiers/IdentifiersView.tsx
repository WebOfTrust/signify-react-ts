import { useState } from 'react';
import { Box, Button, Fab, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { useFetcher, useLoaderData } from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import { EmptyState, PageHeader, StatusPill } from '../../app/Console';
import type {
    IdentifierActionData,
    IdentifiersLoaderData,
} from '../../app/routeData';
import { IdentifierCreateDialog } from './IdentifierCreateDialog';
import { IdentifierDetailsModal } from './IdentifierDetailsModal';
import { IdentifierTable } from './IdentifierTable';
import {
    idleIdentifierAction,
    type IdentifierActionState,
    type IdentifierCreateDraft,
} from './identifierTypes';
import { useAppSelector } from '../../state/hooks';
import {
    selectActiveOperations,
    selectIdentifiers,
} from '../../state/selectors';

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
    const [selectedIdentifierName, setSelectedIdentifierName] = useState<
        string | null
    >(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [activeCreateRequestId, setActiveCreateRequestId] = useState<
        string | null
    >(null);
    const [pendingMessage, setPendingMessage] = useState<string | null>(null);
    const actionRunning = fetcher.state !== 'idle';
    const liveIdentifiers = useAppSelector(selectIdentifiers);
    const activeOperations = useAppSelector(selectActiveOperations);
    const activeResourceKeys = new Set(
        activeOperations.flatMap((operation) => operation.resourceKeys)
    );
    const createSucceeded =
        activeCreateRequestId !== null &&
        fetcher.state === 'idle' &&
        fetcher.data?.intent === 'create' &&
        fetcher.data.ok &&
        fetcher.data.requestId === activeCreateRequestId;
    const createDialogOpen = createOpen && !createSucceeded;

    const loaderIdentifiers =
        loaderData.status === 'blocked' ? [] : loaderData.identifiers;
    const identifiers =
        liveIdentifiers.length > 0 ? liveIdentifiers : loaderIdentifiers;
    const selectedIdentifier =
        selectedIdentifierName === null
            ? null
            : (identifiers.find(
                  (identifier) => identifier.name === selectedIdentifierName
              ) ?? null);

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

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
        formData.set('requestId', globalThis.crypto.randomUUID());
        fetcher.submit(formData, { method: 'post' });
    };

    const handleCreate = async (
        draft: IdentifierCreateDraft
    ): Promise<void> => {
        const requestId = globalThis.crypto.randomUUID();
        setActiveCreateRequestId(requestId);
        setPendingMessage(`Creating identifier ${draft.name}`);
        const formData = new FormData();
        formData.set('intent', 'create');
        formData.set('requestId', requestId);
        formData.set('draft', JSON.stringify(draft));
        fetcher.submit(formData, { method: 'post' });
    };

    const isRotateDisabled = (identifierName: string): boolean =>
        activeResourceKeys.has(`identifier:aid:${identifierName}`);
    const openCreate = () => {
        setActiveCreateRequestId(null);
        setCreateOpen(true);
    };

    return (
        <Box sx={{ display: 'grid', gap: 2.5 }}>
            <PageHeader
                eyebrow="Identity console"
                title="Identifiers"
                summary="Create, inspect, copy, and rotate local AIDs connected to this Signify client."
                actions={
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        aria-label="create identifier"
                        onClick={openCreate}
                        disabled={actionRunning}
                        sx={{ display: { xs: 'none', sm: 'inline-flex' } }}
                    >
                        Create Identifier
                    </Button>
                }
            />
            {actionState.message && (
                <Box
                    sx={{
                        border: 1,
                        borderColor:
                            actionState.status === 'error'
                                ? 'error.main'
                                : 'divider',
                        borderRadius: 1,
                        bgcolor:
                            actionState.status === 'error'
                                ? 'rgba(255, 61, 79, 0.08)'
                                : 'rgba(39, 215, 255, 0.06)',
                        px: 2,
                        py: 1.25,
                    }}
                >
                    <StatusPill
                        label={actionState.status}
                        tone={
                            actionState.status === 'error'
                                ? 'error'
                                : actionState.status === 'success'
                                  ? 'success'
                                  : actionState.status === 'running'
                                    ? 'warning'
                                    : 'neutral'
                        }
                    />{' '}
                    <Typography
                        component="span"
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
            {identifiers.length === 0 && (
                <EmptyState
                    title="No identifiers in local inventory"
                    message="Create the first AID before running credential flows or client diagnostics."
                    action={
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            aria-label="add"
                            onClick={openCreate}
                            disabled={actionRunning}
                            sx={{ display: { xs: 'inline-flex', sm: 'none' } }}
                        >
                            Create Identifier
                        </Button>
                    }
                />
            )}
            <IdentifierTable
                identifiers={identifiers}
                onSelect={(identifier) =>
                    setSelectedIdentifierName(identifier.name)
                }
                onRotate={handleRotate}
                isRotateDisabled={(identifier) =>
                    isRotateDisabled(identifier.name)
                }
            />
            <IdentifierDetailsModal
                open={
                    selectedIdentifierName !== null &&
                    selectedIdentifier !== null
                }
                identifier={selectedIdentifier}
                actionRunning={
                    selectedIdentifierName === null
                        ? false
                        : isRotateDisabled(selectedIdentifierName)
                }
                onClose={() => setSelectedIdentifierName(null)}
                onRotate={handleRotate}
            />
            {createDialogOpen && (
                <IdentifierCreateDialog
                    open={createDialogOpen}
                    actionRunning={actionRunning}
                    onClose={() => {
                        setCreateOpen(false);
                        setActiveCreateRequestId(null);
                    }}
                    onCreate={handleCreate}
                />
            )}
            <Fab
                color="primary"
                aria-label="add"
                onClick={() => {
                    openCreate();
                }}
                disabled={actionRunning}
                sx={{
                    display: {
                        xs:
                            createDialogOpen || identifiers.length === 0
                                ? 'none'
                                : 'inline-flex',
                        sm: 'none',
                    },
                    position: 'fixed',
                    right: { xs: '16px', sm: '24px' },
                    bottom: {
                        xs: 'calc(16px + env(safe-area-inset-bottom))',
                        sm: '24px',
                    },
                }}
            >
                <AddIcon />
            </Fab>
        </Box>
    );
};
