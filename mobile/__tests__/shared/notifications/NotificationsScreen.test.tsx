import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { NotificationsScreen } from '../../../src/features/shared/notifications/NotificationsScreen';

function notificationPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'n1',
    receiverId: 'owner-1',
    title: 'New job request',
    message: 'A new job is waiting for a driver',
    type: 'JOB_REQUEST',
    priority: 'MEDIUM',
    isRead: false,
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('NotificationsScreen', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    configureApiClient({
      getAccessToken: () => 'test-token',
      refreshSession: jest.fn(),
      onAuthExpired: jest.fn(),
    });
  });

  afterEach(() => {
    mock.restore();
  });

  function renderScreen() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <NavigationContainer>
            <NotificationsScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows an empty state when there are no notifications', async () => {
    mock.onGet('/notifications').reply(200, { success: true, data: [], meta: { page: 1, limit: 50, total: 0 } });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('No notifications yet')).toBeTruthy());
  });

  it('renders a notification and marks it read on tap', async () => {
    mock.onGet('/notifications').reply(200, {
      success: true,
      data: [notificationPayload()],
      meta: { page: 1, limit: 50, total: 1 },
    });
    mock.onPatch('/notifications/n1/read').reply(200, {
      success: true,
      data: notificationPayload({ isRead: true }),
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('New job request')).toBeTruthy());

    fireEvent.press(screen.getByText('New job request'));

    await waitFor(() =>
      expect(mock.history.patch.some((req) => req.url === '/notifications/n1/read')).toBe(true),
    );
  });

  it('does not call mark-as-read for an already-read notification', async () => {
    mock.onGet('/notifications').reply(200, {
      success: true,
      data: [notificationPayload({ isRead: true })],
      meta: { page: 1, limit: 50, total: 1 },
    });

    await renderScreen();
    await waitFor(() => expect(screen.getByText('New job request')).toBeTruthy());

    fireEvent.press(screen.getByText('New job request'));

    expect(mock.history.patch.length).toBe(0);
  });
});
