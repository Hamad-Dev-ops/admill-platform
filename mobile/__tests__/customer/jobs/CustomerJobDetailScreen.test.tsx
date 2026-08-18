import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { CustomerJobDetailScreen } from '../../../src/features/customer/jobs/CustomerJobDetailScreen';

const socketHandlers: Record<string, (payload: unknown) => void> = {};
jest.mock('../../../src/hooks/useSocketEvent', () => ({
  useSocketEvent: (event: string, handler: (payload: unknown) => void) => {
    socketHandlers[event] = handler;
  },
}));

jest.mock('../../../src/socket/SocketService', () => ({
  SocketService: {
    subscribeToJob: jest.fn(),
    addConnectListener: jest.fn(),
    removeConnectListener: jest.fn(),
  },
}));

// getRoute is unit-tested exhaustively in __tests__/utils/directions.test.ts
// (real fetch mocking, decode correctness, every failure mode) — here it's
// just mocked at the boundary to prove the screen renders/omits <Polyline>
// correctly based on what it resolves to, without a real network call.
const mockGetRoute = jest.fn();
jest.mock('../../../src/utils/directions', () => ({
  getRoute: (...args: unknown[]) => mockGetRoute(...args),
}));

const mockGoBack = jest.fn();

function jobPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
    companyId: 'c1',
    customerId: 'cus1',
    driverId: 'd1',
    offeredDriverIds: ['d1'],
    serviceType: 'CAR_TOWING',
    status: 'ACCEPTED',
    pickupLocation: { geo: { type: 'Point', coordinates: [55.27, 25.2] }, address: 'Sheikh Zayed Rd' },
    destinationLocation: { geo: { type: 'Point', coordinates: [55.14, 25.08] }, address: 'Al Quoz' },
    distanceKm: 12,
    durationMinutes: 20,
    estimatedFare: 80,
    expiresAt: '2030-01-01',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('CustomerJobDetailScreen', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    configureApiClient({
      getAccessToken: () => 'test-token',
      refreshSession: jest.fn(),
      onAuthExpired: jest.fn(),
    });
    Object.keys(socketHandlers).forEach((key) => delete socketHandlers[key]);
    mockGoBack.mockReset();
    mockGetRoute.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    mock.restore();
  });

  async function renderScreen() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <CustomerJobDetailScreen
            // @ts-expect-error - minimal navigation/route stub for a unit test
            navigation={{ goBack: mockGoBack }}
            route={{ key: 'JobDetail', name: 'JobDetail', params: { jobId: 'j1' } }}
          />
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows an error state when the job fails to load', async () => {
    mock.onGet('/jobs/j1').reply(500);
    const { getByText } = await renderScreen();
    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });

  it('renders the route polyline once getRoute resolves real geometry', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'ACCEPTED' }) });
    mock.onGet('/drivers/d1/location').reply(200, {
      success: true,
      data: { driverId: 'd1', location: { type: 'Point', coordinates: [55.2, 25.15] } },
    });
    mockGetRoute.mockResolvedValue([
      { latitude: 25.2, longitude: 55.27 },
      { latitude: 25.08, longitude: 55.14 },
    ]);

    const { findByTestId } = await renderScreen();

    expect(await findByTestId('map-polyline')).toBeTruthy();
  });

  it('renders markers-only (no polyline) when getRoute resolves null — the graceful fallback', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'ACCEPTED' }) });
    mockGetRoute.mockResolvedValue(null);

    const { queryByTestId, findByTestId } = await renderScreen();

    await findByTestId('map-view');
    expect(queryByTestId('map-polyline')).toBeNull();
  });

  it('shows the assigned driver\'s name, photo, and rating when present (gap #13)', async () => {
    mock.onGet('/jobs/j1').reply(200, {
      success: true,
      data: jobPayload({
        status: 'ACCEPTED',
        assignedDriver: { firstName: 'Ahmed', lastName: 'Hassan', profileImage: 'https://example.com/a.jpg', rating: 4.8 },
      }),
    });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Ahmed Hassan')).toBeTruthy());
    expect(getByText('4.8★')).toBeTruthy();
  });

  it('shows nothing driver-identity-related when assignedDriver is null (no driver assigned yet)', async () => {
    mock.onGet('/jobs/j1').reply(200, {
      success: true,
      data: jobPayload({ status: 'PENDING', driverId: undefined, offeredDriverIds: [], assignedDriver: null }),
    });

    const { queryByText } = await renderScreen();

    await waitFor(() => expect(queryByText('Cancel Request')).toBeTruthy());
    expect(queryByText(/★/)).toBeNull();
  });

  it('shows live driver location while ACCEPTED', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'ACCEPTED' }) });
    mock.onGet('/drivers/d1/location').reply(200, {
      success: true,
      data: { driverId: 'd1', location: { type: 'Point', coordinates: [55.2, 25.15] } },
    });

    const { queryByText, getAllByTestId } = await renderScreen();

    await waitFor(() => expect(mock.history.get.find((req) => req.url === '/drivers/d1/location')).toBeTruthy());
    await waitFor(() => expect(getAllByTestId('map-marker').length).toBe(3));
    expect(queryByText("Live location isn't available until your driver is on the way.")).toBeNull();
  });

  it('fetches the initial driver location snapshot while EN_ROUTE and reflects a live socket update', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'EN_ROUTE' }) });
    mock.onGet('/drivers/d1/location').reply(200, {
      success: true,
      data: { driverId: 'd1', location: { type: 'Point', coordinates: [55.2, 25.15] } },
    });

    const { getByText, getAllByTestId } = await renderScreen();

    await waitFor(() => expect(mock.history.get.find((req) => req.url === '/drivers/d1/location')).toBeTruthy());
    await waitFor(() => expect(getAllByTestId('map-marker').length).toBe(3)); // pickup+destination+driver

    socketHandlers['driver:location:changed']({
      driverId: 'd1',
      jobId: 'j1',
      location: { type: 'Point', coordinates: [55.21, 25.16] },
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    // Still 3 markers (driver marker updates in place, doesn't duplicate).
    await waitFor(() => expect(getAllByTestId('map-marker').length).toBe(3));
    expect(getByText('Sheikh Zayed Rd')).toBeTruthy();
  });

  it('shows stronger cancellation copy for an already-accepted job vs a simple PENDING one', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'ACCEPTED' }) });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Cancel Request')).toBeTruthy());
    await fireEvent.press(getByText('Cancel Request'));

    await waitFor(() => expect(getByText(/A driver has already been assigned/)).toBeTruthy());
  });

  it('shows simple cancellation copy for a PENDING job', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'PENDING', driverId: undefined }) });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Cancel Request')).toBeTruthy());
    await fireEvent.press(getByText('Cancel Request'));

    await waitFor(() => expect(getByText('Cancel this recovery request?')).toBeTruthy());
  });

  it('submits the cancellation with the required reason', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'PENDING', driverId: undefined }) });
    mock.onPatch('/jobs/j1/status').reply(200, { success: true, data: jobPayload({ status: 'CANCELLED' }) });

    const { getByText, getByTestId } = await renderScreen();

    await waitFor(() => expect(getByText('Cancel Request')).toBeTruthy());
    await fireEvent.press(getByText('Cancel Request'));
    await fireEvent.changeText(getByTestId('cancel-reason-input'), 'Changed my mind');
    await fireEvent.press(getByText('Confirm Cancellation'));

    await waitFor(() => expect(mock.history.patch.length).toBe(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({
      status: 'CANCELLED',
      cancellationReason: 'Changed my mind',
    });
  });

  it('hides the cancel button for a terminal job', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'CANCELLED' }) });

    const { queryByText, getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Cancelled')).toBeTruthy());
    expect(queryByText('Cancel Request')).toBeNull();
  });

  it('shows the rating form for a completed, unrated job and submits real {stars, review}', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'COMPLETED', finalFare: 80 }) });
    mock.onPost('/jobs/j1/rating').reply(201, {
      success: true,
      data: { _id: 'r1', jobId: 'j1', customerId: 'cus1', driverId: 'd1', stars: 5, review: 'Great job' },
    });

    const { getByText, getByTestId, getAllByLabelText } = await renderScreen();

    await waitFor(() => expect(getByText('Rate your trip')).toBeTruthy());
    await fireEvent.press(getAllByLabelText('5 stars')[0]);
    await fireEvent.changeText(getByTestId('rating-review-input'), 'Great job');
    await fireEvent.press(getByText('Submit Rating'));

    await waitFor(() => expect(mock.history.post.length).toBe(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ stars: 5, review: 'Great job' });
    await waitFor(() => expect(getByText("Thanks — you've already rated this trip.")).toBeTruthy());
  });

  it('treats a 409 on rating submission as "already rated", not a generic error', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'COMPLETED' }) });
    mock.onPost('/jobs/j1/rating').reply(409, { success: false, message: 'You have already rated this job' });

    const { getByText, getAllByLabelText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('Rate your trip')).toBeTruthy());
    await fireEvent.press(getAllByLabelText('4 stars')[0]);
    await fireEvent.press(getByText('Submit Rating'));

    await waitFor(() => expect(getByText("Thanks — you've already rated this trip.")).toBeTruthy());
    expect(queryByText('Rate your trip')).toBeNull();
  });

  it('does not show a rating form for a non-completed job', async () => {
    mock.onGet('/jobs/j1').reply(200, { success: true, data: jobPayload({ status: 'STARTED' }) });

    const { queryByText, getByText } = await renderScreen();

    await waitFor(() => expect(getByText('In Progress')).toBeTruthy());
    expect(queryByText('Rate your trip')).toBeNull();
  });
});
