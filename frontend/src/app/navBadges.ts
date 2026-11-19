/** The numbers next to the menu items. A number means "new since you last opened that page" (or waiting for you). Computed by the server. */
import type { PageId } from '@/app/navigation';
import type { User } from '@/features/users/types/users.types';
import type { AppState } from '@/store/types';

export function navBadges(state: AppState, _currentUser: User): Partial<Record<PageId, number>> {
  return { ...state.badges };
}
