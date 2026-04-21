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
import { appConfig, type ConnectionOption } from '../config';
import { randomSignifyPasscode } from '../signify/client';
import type { SignifyConnectionState } from '../signify/useSignifyClient';

/**
 * Props for the KERIA connection dialog.
 *
 * The dialog owns only form state. Boot/connect behavior is delegated to
 * `onConnect` so Signify lifecycle stays in `AppShell` and `useSignifyClient`.
 */
export interface ConnectDialogProps {
    open: boolean;
    connection: SignifyConnectionState;
    onClose: () => void;
    onConnect: (
        connectionOption: ConnectionOption,
        passcode: string
    ) => Promise<boolean>;
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
 * passcode generator goes through `randomSignifyPasscode` so Signify WASM
 * readiness stays centralized in the client boundary.
 */
export const ConnectDialog = ({
    open,
    connection,
    onClose,
    onConnect,
}: ConnectDialogProps) => {
    const [selectedConnection, setSelectedConnection] =
        useState<ConnectionOption>(appConfig.connectionOptions[0]);
    const [passcode, setPasscode] = useState('');
    const isConnected = connection.status === 'connected';

    const handleConnect = async () => {
        await onConnect(selectedConnection, passcode);
    };

    return (
        <Dialog open={open} onClose={onClose} data-testid="connect-dialog">
            <DialogTitle>Connect</DialogTitle>
            <DialogContent>
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
                        sx={{ width: 300 }}
                        value={selectedConnection}
                        fullWidth
                        onChange={(_event, newValue) => {
                            setSelectedConnection(
                                newValue ?? appConfig.connectionOptions[0]
                            );
                        }}
                    />
                    <Stack direction="row" spacing={2}>
                        <TextField
                            id="outlined-password-input"
                            label="Passcode"
                            type="text"
                            autoComplete="current-password"
                            variant="outlined"
                            value={passcode}
                            onChange={(event) =>
                                setPasscode(event.target.value)
                            }
                            helperText="Passcode must be at least 21 characters"
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            data-testid="generate-passcode"
                            onClick={async () =>
                                setPasscode(await randomSignifyPasscode())
                            }
                            sx={{
                                padding: '4px',
                                height: '40px',
                                marginTop: '10px',
                            }}
                        >
                            Create
                        </Button>
                    </Stack>

                    <Button
                        variant="contained"
                        color="primary"
                        data-testid="connect-submit"
                        disabled={
                            connection.status === 'connecting' ||
                            passcode.length < 21
                        }
                        onClick={handleConnect}
                    >
                        {connection.status === 'connecting'
                            ? 'Connecting...'
                            : 'Connect'}
                    </Button>
                    {connection.status === 'error' && (
                        <Typography
                            color="error"
                            data-testid="connection-error"
                        >
                            {connection.error.message}
                        </Typography>
                    )}
                </Stack>
            </DialogContent>
            <Box sx={{ mt: 2 }}>
                <Divider />
            </Box>
            <DialogActions>
                <Grid container spacing={2}>
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
