import { useState } from 'react';
import {
    Autocomplete,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    Grid,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import { useFetcher } from 'react-router-dom';
import { appConfig, type ConnectionOption } from '../config';
import type { RootActionData } from './routeData';
import type { SignifyConnectionState } from './runtime';

/**
 * Props for the KERIA connection dialog.
 *
 * The dialog owns only form state. Boot/connect behavior is submitted to the
 * root route action so Signify lifecycle stays in the app runtime boundary.
 */
export interface ConnectDialogProps {
    /** Whether the modal is currently visible. */
    open: boolean;
    /** Current connection state from the shared app runtime. */
    connection: SignifyConnectionState;
    /** Close the dialog without changing runtime connection state. */
    onClose: () => void;
}

/**
 * User-facing status label for the typed connection state.
 *
 * Keep this local until another component truly needs the same presentation
 * policy; duplicating a second tiny formatter is preferable to a premature
 * shared status abstraction.
 */
const connectionStatusLabel = (connection: SignifyConnectionState): string => {
    if (connection.status === 'idle') {
        return 'Not Connected';
    }

    if (connection.status === 'connecting') {
        return 'Connecting';
    }

    if (connection.status === 'connected') {
        return 'Connected';
    }

    return 'Error';
};

/**
 * Modal form for selecting a configured KERIA target and passcode.
 *
 * Stable `data-testid` values here are part of the browser-smoke contract. The
 * passcode generation goes through the root route action so Signify WASM
 * readiness participates in the app-wide pending overlay.
 */
export const ConnectDialog = ({
    open,
    connection,
    onClose,
}: ConnectDialogProps) => {
    const connectFetcher = useFetcher<RootActionData>();
    const passcodeFetcher = useFetcher<RootActionData>();
    const [selectedConnection, setSelectedConnection] =
        useState<ConnectionOption>(appConfig.connectionOptions[0]);
    const [draftPasscode, setDraftPasscode] = useState<string | null>(null);
    const isConnected = connection.status === 'connected';
    const isSubmitting =
        connection.status === 'connecting' || connectFetcher.state !== 'idle';
    const isGenerating = passcodeFetcher.state !== 'idle';
    const generatedPasscode =
        passcodeFetcher.data?.intent === 'generatePasscode' &&
        passcodeFetcher.data.ok
            ? passcodeFetcher.data.passcode
            : null;
    const passcode = draftPasscode ?? generatedPasscode ?? '';
    const actionError =
        connection.status === 'error'
            ? connection.error.message
            : connectFetcher.data?.ok === false
              ? connectFetcher.data.message
              : passcodeFetcher.data?.ok === false
                ? passcodeFetcher.data.message
                : null;

    const handleConnect = () => {
        const formData = new FormData();
        formData.set('intent', 'connect');
        formData.set('adminUrl', selectedConnection.adminUrl);
        formData.set('bootUrl', selectedConnection.bootUrl);
        formData.set('passcode', passcode);
        connectFetcher.submit(formData, { method: 'post', action: '/' });
    };

    const handleGeneratePasscode = () => {
        const formData = new FormData();
        formData.set('intent', 'generatePasscode');
        setDraftPasscode(null);
        passcodeFetcher.submit(formData, { method: 'post', action: '/' });
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            data-testid="connect-dialog"
            fullWidth
            maxWidth="sm"
            slotProps={{
                paper: {
                    sx: {
                        m: { xs: 2, sm: 4 },
                        width: { xs: 'calc(100% - 32px)', sm: '100%' },
                    },
                },
            }}
        >
            <DialogTitle>Connect</DialogTitle>
            <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
                <Stack spacing={3}>
                    <Autocomplete
                        id="combo-box-demo"
                        options={appConfig.connectionOptions}
                        getOptionLabel={(option) =>
                            `${option.label} (${option.adminUrl})`
                        }
                        isOptionEqualToValue={(option, value) =>
                            option.adminUrl === value.adminUrl &&
                            option.bootUrl === value.bootUrl
                        }
                        renderInput={(params) => (
                            <TextField {...params} fullWidth />
                        )}
                        value={selectedConnection}
                        fullWidth
                        onChange={(_event, newValue) => {
                            setSelectedConnection(
                                newValue ?? appConfig.connectionOptions[0]
                            );
                        }}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField
                            id="outlined-password-input"
                            label="Passcode"
                            type="text"
                            autoComplete="current-password"
                            variant="outlined"
                            value={passcode}
                            onChange={(event) =>
                                setDraftPasscode(event.target.value)
                            }
                            helperText="Passcode must be at least 21 characters"
                            fullWidth
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            data-testid="generate-passcode"
                            disabled={isSubmitting || isGenerating}
                            onClick={handleGeneratePasscode}
                            sx={{
                                alignSelf: {
                                    xs: 'stretch',
                                    sm: 'flex-start',
                                },
                                minHeight: 40,
                                mt: { xs: 0, sm: 1 },
                            }}
                        >
                            {isGenerating ? 'Creating...' : 'Create'}
                        </Button>
                    </Stack>

                    <Button
                        variant="contained"
                        color="primary"
                        data-testid="connect-submit"
                        disabled={
                            isSubmitting || isGenerating || passcode.length < 21
                        }
                        onClick={handleConnect}
                    >
                        {isSubmitting ? 'Connecting...' : 'Connect'}
                    </Button>
                    {actionError !== null && (
                        <Typography
                            color="error"
                            data-testid="connection-error"
                        >
                            {actionError}
                        </Typography>
                    )}
                </Stack>
            </DialogContent>
            <Box sx={{ mt: 2 }}>
                <Divider />
            </Box>
            <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
                <Grid container spacing={2} sx={{ width: '100%' }}>
                    <Grid size={12}>
                        <Button
                            fullWidth
                            disabled
                            data-testid={`connection-status-${connection.status}`}
                            sx={{
                                '&.Mui-disabled': {
                                    background: isConnected ? 'green' : 'red',
                                    color: 'black',
                                },
                            }}
                        >
                            Status: {connectionStatusLabel(connection)}
                        </Button>
                    </Grid>

                    <Grid size={12}>
                        <Button
                            onClick={onClose}
                            color="primary"
                            fullWidth
                            data-testid="connect-close"
                        >
                            Close
                        </Button>
                    </Grid>
                </Grid>
            </DialogActions>
        </Dialog>
    );
};
