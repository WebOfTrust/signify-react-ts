import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { AppDispatch, RootState } from './store';

/**
 * Typed Redux dispatch hook for components that need to dispatch slice actions.
 */
export const useAppDispatch = (): AppDispatch => useDispatch<AppDispatch>();

/**
 * Typed Redux selector hook for reading `RootState` in React components.
 */
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
