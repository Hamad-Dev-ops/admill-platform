import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { IncomingJobOfferModal } from '../../../src/features/driver/offers/IncomingJobOfferModal';
import type { JobPayload } from '../../../src/socket/SocketService';

function offerPayload(overrides: Partial<Record<string, unknown>> = {}): JobPayload {
  return {
    _id: 'j1',
    jobNumber: 'JOB-20260810-000001',
    offeredDriverIds: ['my-driver-id'],
    serviceType: 'CAR_TOWING',
    status: 'PENDING',
    pickupLocation: { geo: { type: 'Point', coordinates: [55.27, 25.2] }, address: 'Burj Khalifa' },
    destinationLocation: { geo: { type: 'Point', coordinates: [55.14, 25.08] }, address: 'Marina' },
    distanceKm: 12,
    durationMinutes: 20,
    estimatedFare: 80,
    expiresAt: new Date(Date.now() + 600_000).toISOString(),
    ...overrides,
  } as JobPayload;
}

describe('IncomingJobOfferModal', () => {
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

  async function renderModal(props: {
    offer: JobPayload | null;
    onDismiss?: jest.Mock;
    onAccepted?: jest.Mock;
  }) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const onDismiss = props.onDismiss ?? jest.fn();
    const onAccepted = props.onAccepted ?? jest.fn();
    const utils = await render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <IncomingJobOfferModal offer={props.offer} onDismiss={onDismiss} onAccepted={onAccepted} />
        </PaperProvider>
      </QueryClientProvider>,
    );
    return { ...utils, onDismiss, onAccepted };
  }

  it('renders the real job fields from the offer payload', async () => {
    const { getByText } = await renderModal({ offer: offerPayload() });

    expect(getByText('Car Towing')).toBeTruthy();
    expect(getByText('Burj Khalifa')).toBeTruthy();
    expect(getByText('Marina')).toBeTruthy();
    expect(getByText('AED 80.00')).toBeTruthy();
  });

  it('calls POST /jobs/:id/accept and reports acceptance on success', async () => {
    mock.onPost('/jobs/j1/accept').reply(200, {
      success: true,
      data: { _id: 'j1', status: 'ACCEPTED' },
    });

    const { getByText, onAccepted } = await renderModal({ offer: offerPayload() });

    await fireEvent.press(getByText('Accept'));

    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith('j1'));
  });

  it('shows a clear message (not a generic error) when another driver won the accept race', async () => {
    mock.onPost('/jobs/j1/accept').reply(409, {
      success: false,
      message: 'This job has already been accepted by another driver',
    });

    const { getByText } = await renderModal({ offer: offerPayload() });

    await fireEvent.press(getByText('Accept'));

    await waitFor(() =>
      expect(getByText('Another driver already accepted this job.')).toBeTruthy(),
    );
  });

  it('shows a clear expiry message on a 410 response', async () => {
    mock.onPost('/jobs/j1/accept').reply(410, {
      success: false,
      message: 'This job has expired',
    });

    const { getByText } = await renderModal({ offer: offerPayload() });

    await fireEvent.press(getByText('Accept'));

    await waitFor(() => expect(getByText('This job offer has expired.')).toBeTruthy());
  });

  it('calls POST /jobs/:id/reject and dismisses on Decline', async () => {
    mock.onPost('/jobs/j1/reject').reply(200, {
      success: true,
      data: { _id: 'j1', status: 'PENDING' },
    });

    const { getByText, onDismiss } = await renderModal({ offer: offerPayload() });

    await fireEvent.press(getByText('Decline'));

    await waitFor(() => {
      expect(mock.history.post.some((req) => req.url === '/jobs/j1/reject')).toBe(true);
      expect(onDismiss).toHaveBeenCalled();
    });
  });

  it('renders nothing when there is no offer', async () => {
    const { queryByText } = await renderModal({ offer: null });
    expect(queryByText('New Job Offer')).toBeNull();
  });
});
