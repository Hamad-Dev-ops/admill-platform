import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { ServiceSelectionScreen } from '../../../src/features/customer/request/ServiceSelectionScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
}));

// Paper's real Menu positions itself via anchorRef.measureInWindow(...), but
// @react-native/jest-preset mocks measureInWindow as an empty jest.fn() that
// never invokes its callback (MockNativeMethods.js) — so the real Menu can
// never complete its "measure, then show" sequence in this test renderer,
// regardless of how the trigger is pressed. Confirmed working on a real
// device; this is a test-environment limitation, not an app bug. Swapped
// for a minimal functional equivalent (open state controls whether children
// render, no measurement/animation) so this file tests the actual app logic
// (selection state, Continue gating, navigation) without fighting Paper's
// internals.
jest.mock('react-native-paper', () => {
  const ReactLocal = require('react');
  const RN = require('react-native');
  const actual = jest.requireActual('react-native-paper');
  const MockMenu = ({ visible, anchor, children }: { visible: boolean; anchor: unknown; children: unknown }) =>
    ReactLocal.createElement(
      ReactLocal.Fragment,
      null,
      anchor,
      visible ? ReactLocal.createElement(RN.View, null, children) : null,
    );
  MockMenu.Item = actual.Menu.Item;
  return { ...actual, Menu: MockMenu };
});

function servicePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 's1',
    serviceCode: 'SVC-000001',
    serviceType: 'CAR_TOWING',
    displayName: 'Car Towing',
    description: 'Standard hook & chain',
    baseFare: 180,
    isAvailable: true,
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('ServiceSelectionScreen', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    configureApiClient({
      getAccessToken: () => 'test-token',
      refreshSession: jest.fn(),
      onAuthExpired: jest.fn(),
    });
    mockNavigate.mockReset();
    mockGoBack.mockReset();
  });

  afterEach(() => {
    mock.restore();
  });

  async function renderScreen() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <NavigationContainer>
            <ServiceSelectionScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows a dropdown placeholder, then real catalog entries (backend displayName/baseFare) once opened, filtering out unavailable ones', async () => {
    mock.onGet('/services').reply(200, {
      success: true,
      data: [
        servicePayload({ _id: 's1', displayName: 'Car Towing', baseFare: 180 }),
        servicePayload({ _id: 's2', displayName: 'Jump Start', serviceType: 'JUMP_START', baseFare: 90, isAvailable: false }),
      ],
    });

    const { getByText, getByTestId, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('Select a service')).toBeTruthy());
    await fireEvent.press(getByTestId('service-dropdown-trigger'));

    await waitFor(() => expect(getByText('Car Towing — from AED 180.00')).toBeTruthy(), { timeout: 3000 });
    // isAvailable:false must never be shown as bookable — no server-side filter exists.
    expect(queryByText(/Jump Start/)).toBeNull();
  });

  it('shows an empty state when the catalog has no available entries', async () => {
    mock.onGet('/services').reply(200, { success: true, data: [] });

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('No services available')).toBeTruthy());
  });

  it('shows an error state when the catalog fails to load', async () => {
    mock.onGet('/services').reply(500);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });

  it('disables Continue until a service is picked from the dropdown, then selecting one updates the trigger text', async () => {
    mock.onGet('/services').reply(200, { success: true, data: [servicePayload()] });

    const { getByText, getByTestId } = await renderScreen();

    await waitFor(() => expect(getByText('Select a service')).toBeTruthy());
    await fireEvent.press(getByText('Continue'));
    // Nothing selected yet — Continue must be a no-op.
    expect(mockNavigate).not.toHaveBeenCalled();

    await fireEvent.press(getByTestId('service-dropdown-trigger'));
    await waitFor(() => expect(getByText('Car Towing — from AED 180.00')).toBeTruthy(), { timeout: 3000 });
    await fireEvent.press(getByText('Car Towing — from AED 180.00'));

    // Trigger now shows the selection instead of the placeholder.
    await waitFor(() => expect(getByText('Car Towing')).toBeTruthy());
    expect(getByText('Standard hook & chain')).toBeTruthy();
  });

  it('navigates to FareEstimate with the selected serviceType once Continue is pressed', async () => {
    mock.onGet('/services').reply(200, { success: true, data: [servicePayload()] });

    const { getByText, getByTestId } = await renderScreen();

    await waitFor(() => expect(getByText('Select a service')).toBeTruthy());
    await fireEvent.press(getByTestId('service-dropdown-trigger'));
    await waitFor(() => expect(getByText('Car Towing — from AED 180.00')).toBeTruthy(), { timeout: 3000 });
    await fireEvent.press(getByText('Car Towing — from AED 180.00'));

    await fireEvent.press(getByText('Continue'));

    expect(mockNavigate).toHaveBeenCalledWith('FareEstimate', { serviceType: 'CAR_TOWING' });
  });
});
