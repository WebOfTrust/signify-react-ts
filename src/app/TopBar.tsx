import { AppBar, Button, IconButton, Toolbar, Typography } from '@mui/material';
import { Circle, Menu } from '@mui/icons-material';

/**
 * Props for the fixed app bar.
 */
export interface TopBarProps {
    /** True when the shared app runtime has a connected Signify client. */
    isConnected: boolean;
    /** Open the route navigation drawer. */
    onMenuClick: () => void;
    /** Open the KERIA connection dialog. */
    onConnectClick: () => void;
}

/**
 * Fixed application bar with menu and connect affordances.
 *
 * It renders only shell controls and connection indication; it does not know
 * about routes or Signify clients. Keep the `nav-open` and `connect-open`
 * selectors stable for browser smoke.
 */
export const TopBar = ({
    isConnected,
    onMenuClick,
    onConnectClick,
}: TopBarProps) => (
    <AppBar position="fixed" sx={{ width: '100%' }}>
        <Toolbar
            sx={{
                display: 'flex',
                justifyContent: 'space-between',
            }}
        >
            <IconButton
                edge="start"
                color="inherit"
                aria-label="menu"
                data-testid="nav-open"
                onClick={onMenuClick}
            >
                <Menu />
            </IconButton>
            <Typography variant="h6">Signify Client</Typography>
            <Button
                color="inherit"
                sx={{ marginLeft: 'auto' }}
                onClick={onConnectClick}
                data-testid="connect-open"
            >
                <Circle
                    sx={{
                        color: isConnected ? 'green' : 'red',
                    }}
                />
                Connect
            </Button>
        </Toolbar>
    </AppBar>
);
