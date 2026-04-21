import { RouterProvider } from 'react-router-dom';
import './App.css';
import { createAppRouter } from './app/router';
import { createAppRuntime } from './app/runtime';

const appRuntime = createAppRuntime();
const appRouter = createAppRouter(appRuntime);

function App() {
    return <RouterProvider router={appRouter} />;
}

export default App;
