import { useDispatch, useSelector, type TypedUseSelectorHook } from 'react-redux';
import type { AppDispatch } from '@/store';
import type { RootState } from '@/store/rootReducer';
import { selectAppState } from '@/store/selectors';

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

/** Convenience: the whole app data + dispatch (components can migrate to granular selectors over time). */
export function useStore() {
  const state = useAppSelector(selectAppState);
  const dispatch = useAppDispatch();
  return { state, dispatch };
}
