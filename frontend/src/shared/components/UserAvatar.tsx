import type { User } from '@/features/users/types/users.types';

export function UserAvatar({ user, size = 'w-9 h-9' }: { user: User; size?: string }) {
  return (
    <div className={`${size} rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0`} style={{ backgroundColor: user.color }}>
      {user.initials}
    </div>
  );
}
