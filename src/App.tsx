import { CssBaseline } from '@mui/material';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './app/router';
import { createAppRuntime } from './app/runtime';
import { appStore } from './state/store';

const appRuntime = createAppRuntime({ store: appStore });
const appRouter = createAppRouter(appRuntime);

if (typeof window !== 'undefined') {
    window.addEventListener(
        'pagehide',
        () => {
            void appRuntime.destroy();
        },
        { once: true }
    );
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        void appRuntime.destroy();
    });
}

function App() {
    return (
        <Provider store={appStore}>
            <CssBaseline />
            <RouterProvider router={appRouter} />
        </Provider>
    );
}

export default App;
