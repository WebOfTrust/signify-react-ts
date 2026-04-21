import { useState } from 'react';
import { Box } from '@mui/material';
import { Outlet, useFetchers, useNavigation } from 'react-router-dom';
import type { AppRuntime } from './runtime';
import { useAppSession } from './runtimeHooks';
import { AppRuntimeProvider } from './runtimeContext';
import { ConnectDialog } from './ConnectDialog';
import { derivePendingState } from './pendingState';
import { LoadingOverlay } from './LoadingOverlay';
import { NavigationDrawer } from './NavigationDrawer';
import { TopBar } from './TopBar';
import { useAppSelector } from '../state/hooks';
import { selectLatestActiveOperationLabel } from '../state/selectors';

export interface RootLayoutProps {
    /** Runtime instance injected into the data-router route tree. */
    runtime: AppRuntime;
}

/**
 * Data-router root route element.
 *
 * The root owns durable shell UI state while feature routes render through the
 * outlet. Signify connection state comes from `AppRuntime`, the same object
 * used by loaders and actions, so route actions update the app bar and dialog
 * without a second React-only session model.
 */
const RootLayoutContent = () => {
    const [connectOpen, setConnectOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const navigation = useNavigation();
    const fetchers = useFetchers();
    const { connection } = useAppSession();
    const activeOperationLabel = useAppSelector(selectLatestActiveOperationLabel);
    const connectDialogOpen = connectOpen && connection.status !== 'connected';
    const pending = derivePendingState({
        navigation,
        fetchers,
        connectionStatus: connection.status,
        activeOperationLabel,
    });

    return (
        <Box
            sx={{
                minHeight: '100dvh',
                bgcolor: 'background.default',
                color: 'text.primary',
            }}
        >
            <TopBar
                isConnected={connection.status === 'connected'}
                onMenuClick={() => setDrawerOpen(true)}
                onConnectClick={() => setConnectOpen(true)}
            />
            <NavigationDrawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            />
            <ConnectDialog
                open={connectDialogOpen}
                connection={connection}
                onClose={() => setConnectOpen(false)}
            />
            <LoadingOverlay
                active={pending.active}
                label={pending.label}
                source={pending.source}
            />
            <Box
                component="main"
                sx={{
                    minHeight: '100dvh',
                    overflowX: 'clip',
                    px: { xs: 2, sm: 3 },
                    pt: { xs: 'calc(56px + 16px)', sm: 'calc(64px + 24px)' },
                    pb: {
                        xs: 'calc(88px + env(safe-area-inset-bottom))',
                        sm: 3,
                    },
                }}
            >
                <Outlet />
            </Box>
        </Box>
    );
};

/**
 * Root layout wrapper that provides the injected runtime to shell components.
 */
export const RootLayout = ({ runtime }: RootLayoutProps) => (
    <AppRuntimeProvider runtime={runtime}>
        <RootLayoutContent />
    </AppRuntimeProvider>
);
