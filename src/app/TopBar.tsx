import { AppBar, Button, IconButton, Toolbar, Typography } from '@mui/material';
import CircleIcon from '@mui/icons-material/Circle';
import MenuIcon from '@mui/icons-material/Menu';

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
                gap: { xs: 1, sm: 2 },
                minWidth: 0,
            }}
        >
            <IconButton
                edge="start"
                color="inherit"
                aria-label="menu"
                data-testid="nav-open"
                onClick={onMenuClick}
            >
                <MenuIcon />
            </IconButton>
            <Typography
                variant="h6"
                noWrap
                sx={{
                    flex: '1 1 auto',
                    minWidth: 0,
                }}
            >
                Signify Client
            </Typography>
            <Button
                color="inherit"
                aria-label={isConnected ? 'Connected' : 'Connect'}
                sx={{
                    flex: '0 0 auto',
                    minWidth: { xs: 44, sm: 64 },
                    px: { xs: 1, sm: 2 },
                    gap: 0.75,
                }}
                onClick={onConnectClick}
                data-testid="connect-open"
            >
                <CircleIcon
                    sx={{
                        color: isConnected ? 'green' : 'red',
                    }}
                />
                <Typography
                    component="span"
                    sx={{ display: { xs: 'none', sm: 'inline' } }}
                >
                    Connect
                </Typography>
            </Button>
        </Toolbar>
    </AppBar>
);
