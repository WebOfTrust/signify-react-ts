import { useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { appConfig, type ConnectionOption } from '../config';
import { ClientView } from '../features/client/ClientView';
import { CredentialsView } from '../features/credentials/CredentialsView';
import { IdentifiersView } from '../features/identifiers/IdentifiersView';
import { useSignifyClient } from '../signify/useSignifyClient';
import { DEFAULT_VIEW, pathForView } from '../views';
import { ConnectDialog } from './ConnectDialog';
import { ConnectionRequired } from './ConnectionRequired';
import { NavigationDrawer } from './NavigationDrawer';
import { TopBar } from './TopBar';

/**
 * Routed application shell.
 *
 * This is the composition root for React UI concerns: router layout, drawer
 * state, connect-dialog state, and the `useSignifyClient` hook. Keep Signify
 * lifecycle here or below `src/signify`; feature components should receive a
 * connected client/state through props instead of constructing clients.
 */
export const AppShell = () => {
    const [connectOpen, setConnectOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const { connection, client, state, connect } = useSignifyClient();
    const navigate = useNavigate();
    const defaultPath = pathForView(DEFAULT_VIEW);

    const handleConnect = async (
        connectionOption: ConnectionOption,
        passcode: string
    ): Promise<boolean> => {
        const connected = await connect({
            adminUrl: connectionOption.adminUrl,
            bootUrl: connectionOption.bootUrl,
            passcode,
            tier: appConfig.defaultTier,
        });

        if (connected !== null) {
            navigate(defaultPath);
            setConnectOpen(false);
            return true;
        }

        return false;
    };

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
                onConnect={handleConnect}
            />
            <Routes>
                <Route
                    path="/"
                    element={<Navigate to={defaultPath} replace />}
                />
                <Route
                    path="/identifiers"
                    element={
                        client ? (
                            <IdentifiersView client={client} />
                        ) : (
                            <ConnectionRequired />
                        )
                    }
                />
                <Route
                    path="/credentials"
                    element={
                        client ? <CredentialsView /> : <ConnectionRequired />
                    }
                />
                <Route
                    path="/client"
                    element={
                        state ? (
                            <ClientView summary={state} />
                        ) : (
                            <ConnectionRequired />
                        )
                    }
                />
                <Route
                    path="*"
                    element={<Navigate to={defaultPath} replace />}
                />
            </Routes>
        </div>
    );
};
