import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverStatusToggle } from '../../../src/features/driver/dashboard/DriverStatusToggle';

describe('DriverStatusToggle', () => {
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

  async function renderToggle(currentStatus: 'AVAILABLE' | 'OFFLINE' | 'ON_BREAK') {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <DriverStatusToggle currentStatus={currentStatus} />
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('calls PATCH /drivers/me/status with the exact selected value', async () => {
    mock.onPatch('/drivers/me/status').reply(200, {
      success: true,
      data: { status: 'AVAILABLE' },
    });

    const { getByText } = await renderToggle('OFFLINE');

    await fireEvent.press(getByText('Available'));

    await waitFor(() => {
      const call = mock.history.patch.find((req) => req.url === '/drivers/me/status');
      expect(call).toBeTruthy();
      expect(JSON.parse(call!.data)).toEqual({ status: 'AVAILABLE' });
    });
  });

  it('does not call the API when tapping the already-active status', async () => {
    const { getByText } = await renderToggle('AVAILABLE');

    await fireEvent.press(getByText('Available'));

    expect(mock.history.patch.length).toBe(0);
  });

  it('shows the backend error message on failure', async () => {
    mock.onPatch('/drivers/me/status').reply(403, {
      success: false,
      message: 'Driver must be approved before going online',
    });

    const { getByText } = await renderToggle('OFFLINE');

    await fireEvent.press(getByText('Available'));

    await waitFor(() =>
      expect(getByText('Driver must be approved before going online')).toBeTruthy(),
    );
  });
});
