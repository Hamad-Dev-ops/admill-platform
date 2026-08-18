import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { FindingDriverScreen } from '../../../src/features/customer/matching/FindingDriverScreen';

const socketHandlers: Record<string, (payload: unknown) => void> = {};
jest.mock('../../../src/hooks/useSocketEvent', () => ({
  useSocketEvent: (event: string, handler: (payload: unknown) => void) => {
    socketHandlers[event] = handler;
  },
}));

const mockSubscribeToJob = jest.fn();
jest.mock('../../../src/socket/SocketService', () => ({
  SocketService: {
    subscribeToJob: (...args: unknown[]) => mockSubscribeToJob(...args),
    addConnectListener: jest.fn(),
    removeConnectListener: jest.fn(),
  },
}));

const mockNavigate = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, replace: mockReplace }),
}));

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
    companyId: 'c1',
    customerId: 'cus1',
    offeredDriverIds: ['d1', 'd2'],
    serviceType: 'CAR_TOWING',
    status: 'PENDING',
    pickupLocation: { geo: { type: 'Point', coordinates: [55.27, 25.2] }, address: 'A' },
    destinationLocation: { geo: { type: 'Point', coordinates: [55.14, 25.08] }, address: 'B' },
    distanceKm: 12,
    durationMinutes: 20,
    estimatedFare: 80,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('FindingDriverScreen', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    configureApiClient({
      getAccessToken: () => 'test-token',
      refreshSession: jest.fn(),
      onAuthExpired: jest.fn(),
    });
    Object.keys(socketHandlers).forEach((key) => delete socketHandlers[key]);
    mockSubscribeToJob.mockReset();
    mockNavigate.mockReset();
    mockReplace.mockReset();
  });

  afterEach(() => {
    mock.restore();
  });

  async function renderScreen() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <FindingDriverScreen
            // @ts-expect-error - minimal navigation/route stub for a unit test
            navigation={{}}
            route={{ key: 'FindingDriver', name: 'FindingDriver', params: { jobId: 'j1' } }}
          />
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('subscribes to the job over the socket and shows an indeterminate matching state', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload() });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Finding your driver...')).toBeTruthy());
    expect(mockSubscribeToJob).toHaveBeenCalledWith('j1');
    // No fabricated candidate/queue-position text anywhere.
    expect(() => getByText(/driver 1/i)).toThrow();
  });

  it('navigates to JobDetail when job:accepted fires for this job', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload() });

    await renderScreen();
    await waitFor(() => expect(socketHandlers['job:accepted']).toBeTruthy());

    socketHandlers['job:accepted']({ _id: 'j1', status: 'ACCEPTED' });

    expect(mockReplace).toHaveBeenCalledWith('JobDetail', { jobId: 'j1' });
  });

  it('ignores job:accepted events for a different job', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload() });

    await renderScreen();
    await waitFor(() => expect(socketHandlers['job:accepted']).toBeTruthy());

    socketHandlers['job:accepted']({ _id: 'some-other-job', status: 'ACCEPTED' });

    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows a real timeout state once the job\'s own expiresAt has passed, with no driver found', async () => {
    mock.onGet('/jobs/j1').reply(200, {
      success: true,
      data: jobPayload({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
    });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('No driver found in time')).toBeTruthy());
  });

  it('cancels the request and returns to Home on success', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload() });
    mock.onPatch('/jobs/j1/status').reply(200, { success: true, data: jobPayload({ status: 'CANCELLED' }) });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Cancel Request')).toBeTruthy());
    await fireEvent.press(getByText('Cancel Request'));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('CustomerTabs'));
    const call = mock.history.patch.find((req) => req.url === '/jobs/j1/status');
    expect(JSON.parse(call!.data)).toEqual({
      status: 'CANCELLED',
      cancellationReason: 'Customer cancelled while waiting for a driver',
    });
  });

  it('shows an error state when the job fails to load', async () => {
    mock.onGet('/jobs/j1').reply(500);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });
});
