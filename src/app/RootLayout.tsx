import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import type { AppRuntime } from './runtime';
import { useAppSession } from './runtimeHooks';
import { AppRuntimeProvider } from './runtimeContext';
import { ConnectDialog } from './ConnectDialog';
import { NavigationDrawer } from './NavigationDrawer';
import { TopBar } from './TopBar';

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
    const { connection } = useAppSession();

    useEffect(() => {
        if (connection.status === 'connected') {
            setConnectOpen(false);
        }
    }, [connection.status]);

    return (
        <div>
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
                open={connectOpen}
                connection={connection}
                onClose={() => setConnectOpen(false)}
            />
            <Outlet />
        </div>
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
