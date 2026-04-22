import type { KeyboardEvent } from 'react';
import {
    Box,
    Divider,
    Drawer,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Tooltip,
    Typography,
} from '@mui/material';
import BadgeOutlinedIcon from '@mui/icons-material/BadgeOutlined';
import CreditCardIcon from '@mui/icons-material/CreditCard';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ListAltIcon from '@mui/icons-material/ListAlt';
import NotificationsIcon from '@mui/icons-material/Notifications';
import TerminalIcon from '@mui/icons-material/Terminal';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { useLocation, useNavigate } from 'react-router-dom';
import { APP_NAV_ITEMS } from './router';
import type { AppRouteId } from './router';
import { UI_SOUND_HOVER_VALUE } from './uiSound';

/**
 * Props for the route navigation drawer.
 */
export interface NavigationDrawerProps {
    /** Whether the drawer is currently visible. */
    open: boolean;
    /** Close the drawer after backdrop, keyboard, or item selection events. */
    onClose: () => void;
    /** Clear all persisted local app state for every controller bucket. */
    onClearLocalState: () => void;
}

export interface DesktopNavigationRailProps {
    /** Clear all persisted local app state for every controller bucket. */
    onClearLocalState: () => void;
}

const routeIcon = (routeId: AppRouteId) => {
    if (routeId === 'identifiers') {
        return <BadgeOutlinedIcon />;
    }

    if (routeId === 'credentials') {
        return <CreditCardIcon />;
    }

    if (routeId === 'client') {
        return <TerminalIcon />;
    }

    if (routeId === 'operations') {
        return <ListAltIcon />;
    }

    return <NotificationsIcon />;
};

const navButtonSx = (active: boolean) => ({
    mx: 1,
    my: 0.5,
    border: 1,
    borderColor: active ? 'primary.main' : 'transparent',
    borderRadius: 1,
    color: active ? 'primary.main' : 'text.secondary',
    bgcolor: active ? 'action.selected' : 'transparent',
    '&:hover': {
        borderColor: 'primary.main',
        bgcolor: 'action.hover',
        color: 'text.primary',
    },
    '.MuiListItemIcon-root': {
        color: 'inherit',
        minWidth: 38,
    },
});

const LOCAL_STATE_CLEAR_CONFIRMATION =
    'Clear all saved local app state for every identifier? This removes operation history, app notifications, dismissed exchange records, and saved challenge words stored in this browser.';

const ClearLocalStateIcon = () => (
    <ListItemIcon
        sx={{
            minWidth: 38,
            color: 'error.main',
            position: 'relative',
        }}
    >
        <DeleteForeverIcon />
        <WarningAmberIcon
            sx={{
                position: 'absolute',
                left: 18,
                top: 14,
                fontSize: 15,
                color: 'warning.main',
            }}
        />
    </ListItemIcon>
);

const clearLocalStateButtonSx = {
    ...navButtonSx(false),
    color: 'error.main',
    borderColor: 'transparent',
    '&:hover': {
        borderColor: 'error.main',
        bgcolor: 'rgba(255, 75, 90, 0.08)',
        color: 'error.main',
    },
    '.MuiListItemIcon-root': {
        minWidth: 38,
    },
};

const confirmAndClearLocalState = (
    onClearLocalState: () => void,
    onClose?: () => void
) => {
    const confirmed = globalThis.confirm(LOCAL_STATE_CLEAR_CONFIRMATION);
    if (!confirmed) {
        return;
    }

    onClearLocalState();
    onClose?.();
};

/**
 * Drawer generated from data-router route handles.
 *
 * This component is intentionally route-aware and feature-unaware: adding a new
 * drawer item should mean updating the route descriptor, not hardcoding a
 * second navigation list here.
 */
export const NavigationDrawer = ({
    open,
    onClose,
    onClearLocalState,
}: NavigationDrawerProps) => {
    const navigate = useNavigate();
    const location = useLocation();

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Tab' || event.key === 'Shift') {
            return;
        }

        onClose();
    };

    return (
        <Drawer
            open={open}
            onClose={onClose}
            slotProps={{
                paper: {
                    sx: {
                        width: 'min(80vw, 280px)',
                        pt: 1,
                    },
                },
            }}
        >
            <Box
                role="presentation"
                onKeyDown={handleKeyDown}
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                }}
            >
                <List>
                    {APP_NAV_ITEMS.map((view) => (
                        <ListItemButton
                            key={view.routeId}
                            onClick={() => {
                                navigate(view.path);
                                onClose();
                            }}
                            data-testid={view.testId}
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                            sx={navButtonSx(
                                location.pathname.startsWith(view.path)
                            )}
                        >
                            <ListItemIcon>
                                {routeIcon(view.routeId)}
                            </ListItemIcon>
                            <ListItemText primary={view.label} />
                        </ListItemButton>
                    ))}
                </List>
                <Box sx={{ flexGrow: 1 }} />
                <Divider sx={{ mx: 1, my: 0.75 }} />
                <ListItemButton
                    onClick={() =>
                        confirmAndClearLocalState(onClearLocalState, onClose)
                    }
                    data-testid="clear-local-state"
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                    sx={clearLocalStateButtonSx}
                >
                    <ClearLocalStateIcon />
                    <ListItemText
                        primary="Clear local state"
                        secondary="All identifier buckets"
                    />
                </ListItemButton>
            </Box>
        </Drawer>
    );
};

export const DesktopNavigationRail = ({
    onClearLocalState,
}: DesktopNavigationRailProps) => {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <Box
            component="nav"
            aria-label="Primary routes"
            sx={{
                display: { xs: 'none', md: 'flex' },
                position: 'fixed',
                top: 64,
                bottom: 0,
                left: 0,
                zIndex: (theme) => theme.zIndex.appBar - 1,
                width: 184,
                flexDirection: 'column',
                gap: 0.5,
                borderRight: 1,
                borderColor: 'divider',
                bgcolor: 'rgba(7, 13, 20, 0.9)',
                px: 1,
                py: 2,
                backdropFilter: 'blur(10px)',
            }}
        >
            {APP_NAV_ITEMS.map((view) => {
                const active = location.pathname.startsWith(view.path);

                return (
                    <Tooltip
                        key={view.routeId}
                        title={view.label}
                        placement="right"
                    >
                        <ListItemButton
                            onClick={() => navigate(view.path)}
                            data-testid={`rail-${view.testId}`}
                            data-ui-sound={UI_SOUND_HOVER_VALUE}
                            selected={active}
                            sx={{
                                ...navButtonSx(active),
                                mx: 0,
                                minHeight: 48,
                            }}
                        >
                            <ListItemIcon>
                                {routeIcon(view.routeId)}
                            </ListItemIcon>
                            <ListItemText
                                primary={
                                    <Typography
                                        component="span"
                                        sx={{ fontWeight: active ? 700 : 600 }}
                                    >
                                        {view.label}
                                    </Typography>
                                }
                            />
                        </ListItemButton>
                    </Tooltip>
                );
            })}
            <Box sx={{ flexGrow: 1 }} />
            <Divider sx={{ my: 0.75 }} />
            <Tooltip title="Clear all saved local app state" placement="right">
                <ListItemButton
                    onClick={() => confirmAndClearLocalState(onClearLocalState)}
                    data-testid="rail-clear-local-state"
                    data-ui-sound={UI_SOUND_HOVER_VALUE}
                    sx={{
                        ...clearLocalStateButtonSx,
                        mx: 0,
                        minHeight: 48,
                    }}
                >
                    <ClearLocalStateIcon />
                    <ListItemText
                        primary={
                            <Typography
                                component="span"
                                sx={{ fontWeight: 600 }}
                            >
                                Clear local state
                            </Typography>
                        }
                    />
                </ListItemButton>
            </Tooltip>
        </Box>
    );
};
