import { useState } from 'react';
import {
    Autocomplete,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    InputAdornment,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useFetcher } from 'react-router-dom';
import { appConfig, type ConnectionOption } from '../config';
import { monoValueSx } from './consoleStyles';
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
    const [copiedPasscode, setCopiedPasscode] = useState(false);
    const [passcodeVisible, setPasscodeVisible] = useState(false);
    const isSubmitting =
        connection.status === 'connecting' || connectFetcher.state !== 'idle';
    const isGenerating = passcodeFetcher.state !== 'idle';
    const generatedPasscode =
        passcodeFetcher.data?.intent === 'generatePasscode' &&
        passcodeFetcher.data.ok
            ? passcodeFetcher.data.passcode
            : null;
    const passcode = draftPasscode ?? generatedPasscode ?? '';
    const passcodeReady = passcode.length >= 21;
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
        setCopiedPasscode(false);
        passcodeFetcher.submit(formData, { method: 'post', action: '/' });
    };

    const handleCopyPasscode = () => {
        if (passcode.length === 0) {
            return;
        }

        void globalThis.navigator.clipboard
            ?.writeText(passcode)
            .catch(() => undefined);
        setCopiedPasscode(true);
        globalThis.setTimeout(() => setCopiedPasscode(false), 1500);
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
            <DialogTitle>Connect Wallet</DialogTitle>
            <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 3 }}>
                <Stack spacing={2.5}>
                    <Box
                        sx={{
                            border: 1,
                            borderColor: passcodeReady
                                ? 'primary.main'
                                : 'divider',
                            borderRadius: 1,
                            bgcolor: 'rgba(5, 9, 13, 0.62)',
                            p: { xs: 1.5, sm: 2 },
                        }}
                    >
                        <Stack
                            direction={{ xs: 'column', sm: 'row' }}
                            spacing={1}
                            sx={{
                                alignItems: { xs: 'stretch', sm: 'center' },
                                justifyContent: 'space-between',
                                mb: 1.25,
                            }}
                        >
                            <Box>
                                <Typography
                                    variant="caption"
                                    color="primary.main"
                                    sx={{
                                        display: 'block',
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                    }}
                                >
                                    Passcode generator
                                </Typography>
                                <Typography color="text.secondary">
                                    Generate a fresh Signify passcode or paste
                                    an existing one.
                                </Typography>
                            </Box>
                            <Stack direction="row" spacing={1}>
                                <Tooltip title="Copy passcode">
                                    <span>
                                        <IconButton
                                            aria-label="Copy passcode"
                                            disabled={passcode.length === 0}
                                            onClick={handleCopyPasscode}
                                        >
                                            <ContentCopyIcon />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    data-testid="generate-passcode"
                                    disabled={isSubmitting || isGenerating}
                                    onClick={handleGeneratePasscode}
                                    startIcon={<RefreshIcon />}
                                >
                                    {isGenerating
                                        ? 'Generating...'
                                        : 'Generate'}
                                </Button>
                            </Stack>
                        </Stack>
                        <TextField
                            id="outlined-password-input"
                            label="Passcode"
                            type={passcodeVisible ? 'text' : 'password'}
                            autoComplete="current-password"
                            variant="outlined"
                            value={passcode}
                            onChange={(event) => {
                                setCopiedPasscode(false);
                                setDraftPasscode(event.target.value);
                            }}
                            helperText={
                                passcodeReady
                                    ? copiedPasscode
                                        ? 'Copied to clipboard'
                                        : 'Ready to connect'
                                    : 'Passcode must be at least 21 characters'
                            }
                            fullWidth
                            slotProps={{
                                input: {
                                    sx: {
                                        ...monoValueSx,
                                        fontSize: { xs: '1rem', sm: '1.12rem' },
                                    },
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <Tooltip
                                                title={
                                                    passcodeVisible
                                                        ? 'Hide passcode'
                                                        : 'Show passcode'
                                                }
                                            >
                                                <IconButton
                                                    aria-label={
                                                        passcodeVisible
                                                            ? 'Hide passcode'
                                                            : 'Show passcode'
                                                    }
                                                    edge="end"
                                                    onClick={() => {
                                                        setPasscodeVisible(
                                                            (visible) =>
                                                                !visible
                                                        );
                                                    }}
                                                    onMouseDown={(event) => {
                                                        event.preventDefault();
                                                    }}
                                                    data-testid="toggle-passcode-visibility"
                                                >
                                                    {passcodeVisible ? (
                                                        <VisibilityOffIcon />
                                                    ) : (
                                                        <VisibilityIcon />
                                                    )}
                                                </IconButton>
                                            </Tooltip>
                                        </InputAdornment>
                                    ),
                                },
                                inputLabel: {
                                    shrink: true,
                                },
                            }}
                        />
                    </Box>

                    <Button
                        variant="contained"
                        color="primary"
                        data-testid="connect-submit"
                        disabled={
                            isSubmitting || isGenerating || !passcodeReady
                        }
                        onClick={handleConnect}
                        size="large"
                        fullWidth
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
                    <Box>
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mb: 0.75, fontWeight: 700 }}
                        >
                            KERIA target
                        </Typography>
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
                                <TextField
                                    {...params}
                                    label="Connection"
                                    fullWidth
                                />
                            )}
                            value={selectedConnection}
                            fullWidth
                            onChange={(_event, newValue) => {
                                setSelectedConnection(
                                    newValue ?? appConfig.connectionOptions[0]
                                );
                            }}
                        />
                        <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'block', mt: 0.75, ...monoValueSx }}
                        >
                            Admin {selectedConnection.adminUrl} | Boot{' '}
                            {selectedConnection.bootUrl}
                        </Typography>
                    </Box>
                </Stack>
            </DialogContent>
            <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2 }}>
                <Button
                    onClick={onClose}
                    color="primary"
                    fullWidth
                    data-testid="connect-close"
                >
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
};
