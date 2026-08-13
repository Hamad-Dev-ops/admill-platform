import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { SettingsScreen } from '../../../src/features/owner/settings/SettingsScreen';

const companyPayload = {
  _id: 'c1',
  companyCode: 'CMP-000001',
  companyName: 'Admill Recovery',
  email: 'owner@admill.test',
  phone: '1234567',
  address: '123 Sheikh Zayed Rd',
  city: 'Dubai',
  country: 'UAE',
  tradeLicenseNumber: 'TL-1',
  tradeLicenseExpiry: '2030-01-01',
  serviceAreas: ['Dubai'],
  ownerId: 'owner-1',
  isActive: true,
  isDeleted: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const settingsPayload = {
  _id: 's1',
  companyId: 'c1',
  operatingHours: { open: '08:00', close: '20:00' },
  defaultServiceRadiusKm: 15,
  notificationPreferences: { email: true, sms: false, push: true },
  invoiceBranding: {},
  isActive: true,
  isDeleted: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

const pricingPayload = {
  _id: 'p1',
  version: 3,
  effectiveFrom: '2026-01-01',
  isActive: true,
  currentFuelPrice: 3.2,
  fuelConsumptionPerKm: 0.15,
  perKmRate: 2.5,
  peakHourWindows: [],
  peakHourSurcharge: 5,
  lowSupplyThreshold: 2,
  maxDemandSurcharge: 10,
  surgeEnabled: true,
  isDeleted: false,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
};

describe('SettingsScreen', () => {
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
            <SettingsScreen navigation={{ goBack: jest.fn() } as never} route={{} as never} />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('renders company profile, operating settings, and a clear platform-wide pricing warning', async () => {
    mock.onGet('/companies/me').reply(200, { success: true, data: companyPayload });
    mock.onGet('/companies/me/settings').reply(200, { success: true, data: settingsPayload });
    mock.onGet('/pricing/config').reply(200, { success: true, data: pricingPayload });

    await renderScreen();

    await waitFor(() => expect(screen.getByDisplayValue('Admill Recovery')).toBeTruthy());
    expect(screen.getByDisplayValue('15')).toBeTruthy(); // service radius
    // The pricing config must never be presented as company-private.
    expect(
      screen.getByText(/platform-wide.*not isolated to your company/i),
    ).toBeTruthy();
  });
});
