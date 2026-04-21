import { useLoaderData } from 'react-router-dom';
import { ConnectionRequired } from '../../app/ConnectionRequired';
import type { CredentialsLoaderData } from '../../app/routeData';

/**
 * Placeholder credentials route.
 *
 * The route loader gates this placeholder behind a connected Signify client so
 * the future issuer/holder credential workflow can replace this component
 * without changing route semantics.
 */
export const CredentialsView = () => {
    const loaderData = useLoaderData() as CredentialsLoaderData;

    if (loaderData.status === 'blocked') {
        return <ConnectionRequired />;
    }

    return <div>Credentials Component</div>;
};
