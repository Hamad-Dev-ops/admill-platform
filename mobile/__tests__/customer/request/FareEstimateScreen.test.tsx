import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Geolocation from '@react-native-community/geolocation';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { FareEstimateScreen } from '../../../src/features/customer/request/FareEstimateScreen';
import type { ServiceType } from '../../../src/types/enums';

const mockCheckPermission = jest.fn();
const mockRequestPermission = jest.fn();
jest.mock('../../../src/utils/locationPermissions', () => ({
  checkLocationPermission: (...args: unknown[]) => mockCheckPermission(...args),
  requestLocationPermission: (...args: unknown[]) => mockRequestPermission(...args),
  openAppSettings: jest.fn(),
}));

const mockGetCurrentPosition = Geolocation.getCurrentPosition as jest.Mock;

const mockGoBack = jest.fn();
const mockReplace = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: mockGoBack, replace: mockReplace }),
}));

function fareBreakdownPayload() {
  return {
    serviceType: 'CAR_TOWING',
    distanceKm: 11.4,
    durationMinutes: 20,
    factors: [
      { name: 'baseService', amount: 180, description: 'Base fare for CAR_TOWING' },
      { name: 'distance', amount: 47.88, description: '11.4km at 4.2 AED/km' },
    ],
    total: 227.88,
  };
}

describe('FareEstimateScreen', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    configureApiClient({
      getAccessToken: () => 'test-token',
      refreshSession: jest.fn(),
      onAuthExpired: jest.fn(),
    });
    mockCheckPermission.mockReset();
    mockRequestPermission.mockReset();
    mockGetCurrentPosition.mockReset();
    mockGoBack.mockReset();
    mockReplace.mockReset();
  });

  afterEach(() => {
    mock.restore();
  });

  async function renderScreen(serviceType: ServiceType) {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <NavigationContainer>
            <FareEstimateScreen
              // @ts-expect-error - minimal navigation/route stub for a unit test
              navigation={{}}
              route={{ key: 'FareEstimate', name: 'FareEstimate', params: { serviceType } }}
            />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows a permission error with retry when location access is denied', async () => {
    mockCheckPermission.mockResolvedValue('denied');
    mockRequestPermission.mockResolvedValue('denied');

    const { getByText } = await renderScreen('CAR_TOWING');

    await waitFor(() => expect(getByText(/Location access is needed/)).toBeTruthy());
  });

  it('shows a blocked-permission message with an Open Settings action', async () => {
    // checkLocationPermission can only ever resolve granted/denied (it just
    // wraps PermissionsAndroid.check(), a boolean) — 'blocked' only comes
    // back from requestLocationPermission()'s NEVER_ASK_AGAIN result, so
    // that's the realistic sequence to mock here.
    mockCheckPermission.mockResolvedValue('denied');
    mockRequestPermission.mockResolvedValue('blocked');

    const { getByText } = await renderScreen('CAR_TOWING');

    await waitFor(() => expect(getByText(/Location access is blocked/)).toBeTruthy());
  });

  it('for an on-site service, defaults destination to pickup and shows the real fare breakdown', async () => {
    mockCheckPermission.mockResolvedValue('granted');
    mockGetCurrentPosition.mockImplementation((success) => {
      success!({ coords: { latitude: 25.2, longitude: 55.27 }, timestamp: Date.now() });
    });
    mock.onPost('/pricing/estimate').reply(200, {
      success: true,
      data: { ...fareBreakdownPayload(), serviceType: 'JUMP_START' },
    });

    const { getByText } = await renderScreen('JUMP_START');

    await waitFor(() => expect(getByText('AED 227.88')).toBeTruthy());
    expect(getByText('Base fare for CAR_TOWING')).toBeTruthy();
    expect(getByText('11.4 km · 20 min')).toBeTruthy();

    const call = mock.history.post.find((req) => req.url === '/pricing/estimate');
    const body = JSON.parse(call!.data);
    expect(body.pickupLocation).toEqual(body.destinationLocation);
  });

  it('on GPS timeout, keeps the map usable, retries GPS, and lets a map tap set pickup', async () => {
    mockCheckPermission.mockResolvedValue('granted');
    mockGetCurrentPosition.mockImplementation((_success, error) => {
      error!({ code: 3, message: 'Location request timed out' });
    });
    mock.onPost('/pricing/estimate').reply(200, {
      success: true,
      data: { ...fareBreakdownPayload(), serviceType: 'JUMP_START' },
    });

    const { getByText, getByTestId, queryByText } = await renderScreen('JUMP_START');

    await waitFor(() => expect(getByText(/Location request timed out/)).toBeTruthy());
    expect(getByTestId('map-view')).toBeTruthy();
    expect(queryByText('Something went wrong')).toBeNull();

    await fireEvent.press(getByText('Retry current location'));
    expect(mockGetCurrentPosition.mock.calls.length).toBeGreaterThan(2);

    await fireEvent(getByTestId('map-view'), 'press', {
      nativeEvent: { coordinate: { latitude: 25.11, longitude: 55.22 } },
    });

    await waitFor(() => expect(getByText('AED 227.88')).toBeTruthy());
    const body = JSON.parse(mock.history.post.find((req) => req.url === '/pricing/estimate')!.data);
    expect(body.pickupLocation.coordinates).toEqual([55.22, 25.11]);
  });

  it('for a towing service, requires a map tap before estimating, then estimates with the tapped point', async () => {
    mockCheckPermission.mockResolvedValue('granted');
    mockGetCurrentPosition.mockImplementation((success) => {
      success!({ coords: { latitude: 25.2, longitude: 55.27 }, timestamp: Date.now() });
    });
    mock.onPost('/pricing/estimate').reply(200, { success: true, data: fareBreakdownPayload() });

    const { getByText, getByTestId, queryByText } = await renderScreen('CAR_TOWING');

    await waitFor(() => expect(getByText('Tap the map to set your drop-off location.')).toBeTruthy());
    expect(mock.history.post.length).toBe(0);

    await fireEvent(getByTestId('map-view'), 'press', {
      nativeEvent: { coordinate: { latitude: 25.1, longitude: 55.2 } },
    });

    await waitFor(() => expect(getByText('AED 227.88')).toBeTruthy());
    expect(queryByText('Tap the map to set your drop-off location.')).toBeNull();
  });

  // Gap #14 resolved — booking is now fully live. These replace the old
  // "always disabled" test from when it wasn't.
  async function readyOnSiteScreen() {
    mockCheckPermission.mockResolvedValue('granted');
    mockGetCurrentPosition.mockImplementation((success) => {
      success!({ coords: { latitude: 25.2, longitude: 55.27 }, timestamp: Date.now() });
    });
    mock.onPost('/pricing/estimate').reply(200, {
      success: true,
      data: { ...fareBreakdownPayload(), serviceType: 'JUMP_START' },
    });

    const utils = await renderScreen('JUMP_START');
    await waitFor(() => expect(utils.getByText('AED 227.88')).toBeTruthy());
    return utils;
  }

  it('submits a real job with no companyId field, and navigates to FindingDriver on success', async () => {
    const { getByText } = await readyOnSiteScreen();
    mock.onPost('/jobs').reply(201, {
      success: true,
      data: { _id: 'job-1', jobNumber: 'JOB-20260810-000001', status: 'PENDING' },
    });

    await fireEvent.press(getByText('Request Recovery'));

    await waitFor(() => expect(mock.history.post.filter((req) => req.url === '/jobs').length).toBe(1));
    const body = JSON.parse(mock.history.post.find((req) => req.url === '/jobs')!.data);
    expect(body).toEqual({
      serviceType: 'JUMP_START',
      pickupLocation: { geo: { type: 'Point', coordinates: [55.27, 25.2] }, address: 'Current location' },
      destinationLocation: { geo: { type: 'Point', coordinates: [55.27, 25.2] }, address: 'Current location' },
    });
    expect(body.companyId).toBeUndefined();

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('FindingDriver', { jobId: 'job-1' }));
  });

  it('shows a loading state while the request is in flight, then navigates once it resolves', async () => {
    const { getByText, queryByText } = await readyOnSiteScreen();
    let resolveRequest: (value: any) => void = () => {};
    mock.onPost('/jobs').reply(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    await fireEvent.press(getByText('Request Recovery'));

    // Still on this screen, request not yet resolved, nothing navigated yet.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(queryByText('Unable to request recovery')).toBeNull();

    resolveRequest([201, { success: true, data: { _id: 'job-1', status: 'PENDING' } }]);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('FindingDriver', { jobId: 'job-1' }));
  });

  it('prevents a duplicate submission while one is already pending', async () => {
    const { getByText } = await readyOnSiteScreen();
    let resolveRequest: (value: any) => void = () => {};
    mock.onPost('/jobs').reply(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    await fireEvent.press(getByText('Request Recovery'));
    await fireEvent.press(getByText('Request Recovery'));
    await fireEvent.press(getByText('Request Recovery'));

    resolveRequest([201, { success: true, data: { _id: 'job-1', status: 'PENDING' } }]);
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(mock.history.post.filter((req) => req.url === '/jobs').length).toBe(1);
  });

  it('shows the real backend message on a 500 (e.g. misconfigured operational company) and does not navigate', async () => {
    const { getByText } = await readyOnSiteScreen();
    mock.onPost('/jobs').reply(500, {
      success: false,
      message: 'Booking is temporarily unavailable — no operational company is configured',
    });

    await fireEvent.press(getByText('Request Recovery'));

    await waitFor(() =>
      expect(getByText('Booking is temporarily unavailable — no operational company is configured')).toBeTruthy(),
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the real backend message on a 404 (e.g. service no longer available) and does not navigate', async () => {
    const { getByText } = await readyOnSiteScreen();
    mock.onPost('/jobs').reply(404, { success: false, message: 'This service is not currently available' });

    await fireEvent.press(getByText('Request Recovery'));

    await waitFor(() => expect(getByText('This service is not currently available')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows the real backend message on a 429 (rate limited) and does not navigate', async () => {
    const { getByText } = await readyOnSiteScreen();
    mock.onPost('/jobs').reply(429, { success: false, message: 'Too many job requests, please try again later' });

    await fireEvent.press(getByText('Request Recovery'));

    await waitFor(() => expect(getByText('Too many job requests, please try again later')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('shows an offline-specific message on a network failure and does not navigate', async () => {
    const { getByText } = await readyOnSiteScreen();
    mock.onPost('/jobs').networkError();

    await fireEvent.press(getByText('Request Recovery'));

    await waitFor(() => expect(getByText('No internet connection. Check your network and try again.')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('ignores a press on Request Recovery until a fare estimate has actually loaded', async () => {
    mockCheckPermission.mockResolvedValue('granted');
    mockGetCurrentPosition.mockImplementation((success) => {
      success!({ coords: { latitude: 25.2, longitude: 55.27 }, timestamp: Date.now() });
    });
    // Never resolves — estimate stays loading, so the button should behave
    // as disabled regardless of what's tapped.
    mock.onPost('/pricing/estimate').reply(() => new Promise(() => {}));
    mock.onPost('/jobs').reply(201, { success: true, data: { _id: 'job-1', status: 'PENDING' } });

    const { getByText } = await renderScreen('JUMP_START');

    await waitFor(() => expect(getByText('Request Recovery')).toBeTruthy());
    await fireEvent.press(getByText('Request Recovery'));

    expect(mock.history.post.filter((req) => req.url === '/jobs').length).toBe(0);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
