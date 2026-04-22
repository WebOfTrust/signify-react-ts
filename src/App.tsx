import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './app/router';
import { createAppRuntime } from './app/runtime';
import { appTheme } from './app/theme';
import { appStore } from './state/store';
import { installUiPreferencesPersistence } from './state/uiPreferencesPersistence';

const appRuntime = createAppRuntime({ store: appStore });
const appRouter = createAppRouter(appRuntime);
const uninstallUiPreferencesPersistence =
    installUiPreferencesPersistence(appStore);

if (typeof window !== 'undefined') {
    window.addEventListener(
        'pagehide',
        () => {
            uninstallUiPreferencesPersistence();
            void appRuntime.destroy();
        },
        { once: true }
    );
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        uninstallUiPreferencesPersistence();
        void appRuntime.destroy();
    });
}

function App() {
    return (
        <Provider store={appStore}>
            <ThemeProvider theme={appTheme}>
                <CssBaseline />
                <RouterProvider router={appRouter} />
            </ThemeProvider>
        </Provider>
    );
}

export default App;
