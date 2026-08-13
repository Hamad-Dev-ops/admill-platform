import { AppState } from 'react-native';
import { QueryClient, focusManager } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

// React Query's "refetch stale queries on window focus" only fires
// automatically on the web — on React Native it needs to be told what
// "focus" means, via this exact AppState wiring (TanStack Query's own
// documented React Native integration point, not a new pattern). Without
// it, a screen that's been backgrounded for a while (a driver's dashboard,
// say) never automatically revalidates its cached data on return to
// foreground — only a fresh mount or a manual pull-to-refresh would. This
// was previously entirely unwired.
AppState.addEventListener('change', (status) => {
  focusManager.setFocused(status === 'active');
});
