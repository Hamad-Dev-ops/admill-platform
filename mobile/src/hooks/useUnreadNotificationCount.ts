import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getUnreadNotificationCount } from '../api/notifications.api';
import { useSocketEvent } from './useSocketEvent';

// REST is the source of truth; the notification:new socket event just
// triggers a refetch rather than being trusted as the new count directly —
// a missed/duplicate event or a stale connection should never desync the
// badge from what the server actually has (architecture-baseline.md
// real-time rules).
export function useUnreadNotificationCount() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: getUnreadNotificationCount,
  });

  useSocketEvent('notification:new', () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  return query.data ?? 0;
}
