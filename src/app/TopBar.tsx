import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { AppBar } from '@mui/material';
import { useFetcher, useLocation, useNavigate } from 'react-router-dom';
import type {
    ContactActionData,
    CredentialActionData,
    MultisigActionData,
} from './routeData';
import type { AppNotificationRecord } from '../state/appNotifications.slice';
import type {
    ChallengeRequestNotification,
    DelegationRequestNotification,
    MultisigRequestNotification,
} from '../state/notifications.slice';
import type {
    CredentialGrantNotification,
    W3CVcGrantNotification,
} from '../domain/credentials/credentialTypes';
import type { OperationRecord } from '../state/operations.slice';
import type { IdentifierSummary } from '../domain/identifiers/identifierTypes';
import { allAppNotificationsRead } from '../state/appNotifications.slice';
import {
    hoverSoundMutedToggled,
    themeModeToggled,
} from '../state/uiPreferences.slice';
import {
    walletAidCleared,
    walletAidSelected,
    walletRegistryCleared,
    walletRegistrySelected,
} from '../state/walletSelection.slice';
import { useAppDispatch, useAppSelector } from '../state/hooks';
import {
    selectHoverSoundMuted,
    selectReadyCredentialRegistriesForSelectedAid,
    selectSelectedWalletIdentifier,
    selectSelectedWalletRegistry,
    selectThemeMode,
} from '../state/selectors';
import {
    multisigRequestIntent,
    multisigRequestLocalMembers,
} from '../features/multisig/multisigRequestUi';
import { TopBarToolbar } from './TopBarToolbar';
import { TopBarOperationsPopover } from './TopBarOperationsPopover';
import { TopBarNotificationsPopover } from './TopBarNotificationsPopover';

const APP_NOTIFICATION_READ_DELAY_MS = 1250;

/**
 * Props for the fixed app bar.
 */
export interface TopBarProps {
    /** True when the shared app runtime has a connected Signify client. */
    isConnected: boolean;
    /** Currently running background operations. */
    activeOperations: readonly OperationRecord[];
    /** Recent app notifications for the bell popover. */
    recentNotifications: readonly AppNotificationRecord[];
    /** Actionable challenge requests discovered from KERIA notifications. */
    challengeRequests: readonly ChallengeRequestNotification[];
    /** Actionable credential grants discovered from KERIA notifications. */
    credentialGrants: readonly CredentialGrantNotification[];
    /** Informational W3C VC-JWT grants discovered from KERIA notifications. */
    w3cVcGrants: readonly W3CVcGrantNotification[];
    /** Actionable delegation requests discovered from KERIA notifications. */
    delegationRequests: readonly DelegationRequestNotification[];
    /** Actionable multisig requests discovered from KERIA notifications. */
    multisigRequests: readonly MultisigRequestNotification[];
    /** Local identifiers available for responding to challenge requests. */
    identifiers: readonly IdentifierSummary[];
    /** Number of unread app notifications plus actionable challenge requests. */
    unreadNotificationCount: number;
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
    activeOperations,
    recentNotifications,
    challengeRequests,
    credentialGrants,
    w3cVcGrants,
    delegationRequests,
    multisigRequests,
    identifiers,
    unreadNotificationCount,
    onMenuClick,
    onConnectClick,
}: TopBarProps) => {
    const [operationsAnchor, setOperationsAnchor] =
        useState<HTMLElement | null>(null);
    const [notificationsAnchor, setNotificationsAnchor] =
        useState<HTMLElement | null>(null);
    const [multisigDrafts, setMultisigDrafts] = useState<
        Record<string, { groupAlias: string; localMemberName: string }>
    >({});
    const dismissFetcher = useFetcher<ContactActionData>();
    const navigate = useNavigate();
    const location = useLocation();
    const dispatch = useAppDispatch();
    const hoverSoundMuted = useAppSelector(selectHoverSoundMuted);
    const themeMode = useAppSelector(selectThemeMode);
    const selectedIdentifier = useAppSelector(selectSelectedWalletIdentifier);
    const readyRegistries = useAppSelector(
        selectReadyCredentialRegistriesForSelectedAid
    );
    const selectedRegistry = useAppSelector(selectSelectedWalletRegistry);
    const operationsOpen = operationsAnchor !== null;
    const notificationsOpen = notificationsAnchor !== null;
    const visibleNotifications = useMemo(
        () => recentNotifications.slice(0, 5),
        [recentNotifications]
    );
    const credentialFetcher = useFetcher<CredentialActionData>();
    const markReadFetcher = useFetcher<ContactActionData>();
    const delegationFetcher = useFetcher<ContactActionData>();
    const multisigFetcher = useFetcher<MultisigActionData>();
    const visibleChallengeRequests = useMemo(
        () => challengeRequests.slice(0, 3),
        [challengeRequests]
    );
    const visibleCredentialGrants = useMemo(
        () => credentialGrants.slice(0, 3),
        [credentialGrants]
    );
    const visibleW3CVcGrants = useMemo(
        () => w3cVcGrants.slice(0, 3),
        [w3cVcGrants]
    );
    const visibleDelegationRequests = useMemo(
        () => delegationRequests.slice(0, 3),
        [delegationRequests]
    );
    const visibleMultisigRequests = useMemo(
        () => multisigRequests.slice(0, 3),
        [multisigRequests]
    );
    const multisigLocalMemberOptions = useMemo(
        () => multisigRequestLocalMembers(identifiers),
        [identifiers]
    );

    useEffect(() => {
        if (!notificationsOpen || unreadNotificationCount === 0) {
            return undefined;
        }

        const timeout = globalThis.setTimeout(() => {
            dispatch(allAppNotificationsRead());
        }, APP_NOTIFICATION_READ_DELAY_MS);

        return () => {
            globalThis.clearTimeout(timeout);
        };
    }, [dispatch, notificationsOpen, unreadNotificationCount]);

    const openOperations = (event: MouseEvent<HTMLElement>) => {
        setOperationsAnchor(event.currentTarget);
    };

    const openNotifications = (event: MouseEvent<HTMLElement>) => {
        setNotificationsAnchor(event.currentTarget);
    };

    const closeOperations = () => {
        setOperationsAnchor(null);
    };

    const closeNotifications = () => {
        setNotificationsAnchor(null);
    };

    const toggleHoverSoundMuted = () => {
        dispatch(hoverSoundMutedToggled());
    };

    const toggleThemeMode = () => {
        dispatch(themeModeToggled());
    };

    const navigateCredentialSelection = (aid: string | null) => {
        if (!location.pathname.startsWith('/credentials')) {
            return;
        }

        navigate(
            aid === null
                ? '/credentials'
                : `/credentials/${encodeURIComponent(aid)}`
        );
    };

    const handleSelectedAidChange = (value: string) => {
        if (value.length === 0) {
            dispatch(walletAidCleared());
            navigateCredentialSelection(null);
            return;
        }

        dispatch(walletAidSelected({ aid: value }));
        navigateCredentialSelection(value);
    };

    const handleSelectedRegistryChange = (value: string) => {
        if (value.length === 0) {
            dispatch(walletRegistryCleared());
            return;
        }

        dispatch(walletRegistrySelected({ registryId: value }));
    };

    const dismissChallengeRequest = (request: ChallengeRequestNotification) => {
        const formData = new FormData();
        formData.set('intent', 'dismissExchangeNotification');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', request.notificationId);
        formData.set('exnSaid', request.exnSaid);
        formData.set('route', '/challenge/request');
        dismissFetcher.submit(formData, {
            method: 'post',
            action: '/notifications',
        });
    };

    const admitCredentialGrant = (grant: CredentialGrantNotification) => {
        const recipient = identifiers.find(
            (identifier) => identifier.prefix === grant.holderAid
        );
        if (recipient === undefined) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'admitCredentialGrant');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('holderAlias', recipient.name);
        formData.set('holderAid', grant.holderAid);
        formData.set('notificationId', grant.notificationId);
        formData.set('grantSaid', grant.grantSaid);
        credentialFetcher.submit(formData, {
            method: 'post',
            action: '/credentials',
        });
        closeNotifications();
    };

    const approveDelegationRequest = (
        request: DelegationRequestNotification
    ) => {
        const delegator = identifiers.find(
            (identifier) => identifier.prefix === request.delegatorAid
        );
        if (delegator === undefined) {
            return;
        }

        const formData = new FormData();
        formData.set('intent', 'approveDelegationRequest');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', request.notificationId);
        formData.set('delegatorName', delegator.name);
        formData.set('delegatorAid', request.delegatorAid);
        formData.set('delegateAid', request.delegateAid);
        formData.set('delegateEventSaid', request.delegateEventSaid);
        formData.set('sequence', request.sequence);
        formData.set('sourceAid', request.sourceAid ?? '');
        formData.set('createdAt', request.createdAt);
        delegationFetcher.submit(formData, {
            method: 'post',
            action: '/notifications',
        });
        closeNotifications();
    };

    const markW3CGrantRead = (grant: W3CVcGrantNotification) => {
        const formData = new FormData();
        formData.set('intent', 'markNotificationRead');
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', grant.notificationId);
        markReadFetcher.submit(formData, {
            method: 'post',
            action: '/notifications',
        });
        closeNotifications();
    };

    const submitMultisigRequest = (
        request: MultisigRequestNotification,
        groupAlias: string,
        localMemberName: string
    ) => {
        const formData = new FormData();
        formData.set('intent', multisigRequestIntent(request));
        formData.set('requestId', globalThis.crypto.randomUUID());
        formData.set('notificationId', request.notificationId);
        formData.set('exnSaid', request.exnSaid);
        formData.set('groupAlias', groupAlias.trim());
        formData.set('localMemberName', localMemberName);
        multisigFetcher.submit(formData, {
            method: 'post',
            action: '/multisig',
        });
        closeNotifications();
    };

    return (
        <AppBar position="fixed" sx={{ width: '100%' }}>
            <TopBarToolbar
                isConnected={isConnected}
                hoverSoundMuted={hoverSoundMuted}
                themeMode={themeMode}
                selectedIdentifier={selectedIdentifier}
                selectedRegistry={selectedRegistry}
                identifiers={identifiers}
                readyRegistries={readyRegistries}
                activeOperationCount={activeOperations.length}
                unreadNotificationCount={unreadNotificationCount}
                onMenuClick={onMenuClick}
                onSelectedAidChange={handleSelectedAidChange}
                onSelectedRegistryChange={handleSelectedRegistryChange}
                onToggleHoverSoundMuted={toggleHoverSoundMuted}
                onToggleThemeMode={toggleThemeMode}
                onOpenOperations={openOperations}
                onOpenNotifications={openNotifications}
                onConnectClick={onConnectClick}
            />
            <TopBarOperationsPopover
                open={operationsOpen}
                anchorEl={operationsAnchor}
                activeOperations={activeOperations}
                onClose={closeOperations}
            />
            <TopBarNotificationsPopover
                open={notificationsOpen}
                anchorEl={notificationsAnchor}
                recentNotifications={recentNotifications}
                visibleNotifications={visibleNotifications}
                visibleChallengeRequests={visibleChallengeRequests}
                visibleCredentialGrants={visibleCredentialGrants}
                visibleW3CVcGrants={visibleW3CVcGrants}
                visibleDelegationRequests={visibleDelegationRequests}
                visibleMultisigRequests={visibleMultisigRequests}
                identifiers={identifiers}
                multisigDrafts={multisigDrafts}
                setMultisigDrafts={setMultisigDrafts}
                multisigLocalMemberOptions={multisigLocalMemberOptions}
                canDismissChallengeRequests={dismissFetcher.state === 'idle'}
                canSubmitCredentialGrants={credentialFetcher.state === 'idle'}
                canMarkW3CGrantsRead={markReadFetcher.state === 'idle'}
                canSubmitDelegationRequests={delegationFetcher.state === 'idle'}
                canSubmitMultisigRequests={multisigFetcher.state === 'idle'}
                dismissChallengeRequest={dismissChallengeRequest}
                admitCredentialGrant={admitCredentialGrant}
                markW3CGrantRead={markW3CGrantRead}
                approveDelegationRequest={approveDelegationRequest}
                submitMultisigRequest={submitMultisigRequest}
                onClose={closeNotifications}
            />
        </AppBar>
    );
};
