import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DriverNavigator } from '../../src/navigation/DriverNavigator';

const mockUseProfileStatus = jest.fn();
jest.mock('../../src/hooks/useProfileStatus', () => ({
  useProfileStatus: () => mockUseProfileStatus(),
}));

jest.mock('../../src/auth/AuthContext', () => ({
  useAuth: () => ({ logout: jest.fn().mockResolvedValue(undefined) }),
}));

// This hook's own internal ID-resolution/buffering logic is covered in
// useIncomingJobOffer.test.tsx — mocked here purely to prove the structural
// half of QA audit finding #4's fix: DriverOfferOverlay (and therefore this
// hook's socket listener) is reachable regardless of profileStatus, not
// gated behind 'ready' the way it used to be.
const mockUseIncomingJobOffer = jest.fn();
jest.mock('../../src/features/driver/offers/useIncomingJobOffer', () => ({
  useIncomingJobOffer: () => mockUseIncomingJobOffer(),
}));

async function renderNavigator() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return await render(
    <QueryClientProvider client={queryClient}>
      <PaperProvider>
        <NavigationContainer>
          <DriverNavigator />
        </NavigationContainer>
      </PaperProvider>
    </QueryClientProvider>,
  );
}

describe('DriverNavigator — offer overlay mount timing', () => {
  beforeEach(() => {
    mockUseIncomingJobOffer.mockReturnValue({ offer: null, dismiss: jest.fn() });
  });

  it('mounts the offer overlay even while profileStatus is still loading (the actual race window being closed)', async () => {
    mockUseProfileStatus.mockReturnValue({ kind: 'loading' });
    mockUseIncomingJobOffer.mockReturnValue({
      offer: {
        _id: 'j1',
        jobNumber: 'JOB-1',
        offeredDriverIds: ['me'],
        serviceType: 'CAR_TOWING',
        status: 'PENDING',
        pickupLocation: { address: 'Burj Khalifa' },
        destinationLocation: { address: 'Marina' },
        distanceKm: 12,
        durationMinutes: 20,
        estimatedFare: 80,
        expiresAt: new Date(Date.now() + 600_000).toISOString(),
      },
      dismiss: jest.fn(),
    });

    const { getByText } = await renderNavigator();

    // The offer modal renders even though the rest of the screen is still
    // the loading spinner — proves the overlay isn't gated behind 'ready'.
    await waitFor(() => expect(getByText('New Job Offer')).toBeTruthy());
  });

  it('mounts the offer overlay while pending-approval, with no offer active, without crashing', async () => {
    mockUseProfileStatus.mockReturnValue({ kind: 'pending-approval' });
    const { getByText, queryByText } = await renderNavigator();
    await waitFor(() => expect(getByText('Approval pending')).toBeTruthy());
    expect(queryByText('New Job Offer')).toBeNull();
  });

  it('still renders the real tab shell once ready, unaffected by the overlay always being mounted', async () => {
    mockUseProfileStatus.mockReturnValue({ kind: 'ready' });
    const { getAllByText } = await renderNavigator();
    await waitFor(() => expect(getAllByText('Dashboard').length).toBeGreaterThan(0));
  });
});
