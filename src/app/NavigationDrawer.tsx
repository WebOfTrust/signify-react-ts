import type { KeyboardEvent } from 'react';
import { Drawer, List, ListItem, ListItemText } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { VIEW_DEFINITIONS } from '../views';

/**
 * Props for the route navigation drawer.
 */
export interface NavigationDrawerProps {
    open: boolean;
    onClose: () => void;
}

/**
 * Drawer generated from `VIEW_DEFINITIONS`.
 *
 * This component is intentionally route-aware and feature-unaware: adding a new
 * drawer item should mean updating the typed view registry, not hardcoding a
 * second list here.
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
        <Drawer open={open} onClose={onClose}>
            <div role="presentation" onKeyDown={handleKeyDown}>
                <List>
                    {VIEW_DEFINITIONS.map((view) => (
                        <ListItem
                            key={view.id}
                            onClick={() => {
                                navigate(view.path);
                                onClose();
                            }}
                            data-testid={view.testId}
                        >
                            <ListItemText primary={view.label} />
                        </ListItem>
                    ))}
                </List>
            </div>
        </Drawer>
    );
};
