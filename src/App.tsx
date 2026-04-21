import { CssBaseline } from '@mui/material';
import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from './app/router';
import { createAppRuntime } from './app/runtime';

const appRuntime = createAppRuntime();
const appRouter = createAppRouter(appRuntime);

function App() {
    return (
        <>
            <CssBaseline />
            <RouterProvider router={appRouter} />
        </>
    );
}

export default App;
