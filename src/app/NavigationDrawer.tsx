import type { KeyboardEvent } from 'react';
import { Drawer, List, ListItemButton, ListItemText } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { APP_NAV_ITEMS } from './router';

/**
 * Props for the route navigation drawer.
 */
export interface NavigationDrawerProps {
    /** Whether the drawer is currently visible. */
    open: boolean;
    /** Close the drawer after backdrop, keyboard, or item selection events. */
    onClose: () => void;
}

/**
 * Drawer generated from data-router route handles.
 *
 * This component is intentionally route-aware and feature-unaware: adding a new
 * drawer item should mean updating the route descriptor, not hardcoding a
 * second navigation list here.
 */
export const NavigationDrawer = ({ open, onClose }: NavigationDrawerProps) => {
    const navigate = useNavigate();

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
                    },
                },
            }}
        >
            <div role="presentation" onKeyDown={handleKeyDown}>
                <List>
                    {APP_NAV_ITEMS.map((view) => (
                        <ListItemButton
                            key={view.routeId}
                            onClick={() => {
                                navigate(view.path);
                                onClose();
                            }}
                            data-testid={view.testId}
                        >
                            <ListItemText primary={view.label} />
                        </ListItemButton>
                    ))}
                </List>
            </div>
        </Drawer>
    );
};
