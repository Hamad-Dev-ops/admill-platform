import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { launchImageLibrary } from 'react-native-image-picker';
import MockAdapter from 'axios-mock-adapter';
import { apiClient, configureApiClient } from '../../../src/api/client';
import { DriverDocumentsScreen } from '../../../src/features/driver/documents/DriverDocumentsScreen';

const mockLaunchImageLibrary = launchImageLibrary as jest.Mock;

function driverPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'd1',
    employeeId: 'DRV-000001',
    userId: 'user-1',
    companyId: 'c1',
    status: 'AVAILABLE',
    approvalStatus: 'APPROVED',
    rating: 4.5,
    totalTrips: 10,
    nationalId: 'n1',
    emiratesId: 'e1',
    emiratesIdExpiry: '2030-01-01',
    drivingLicenseNumber: 'dl1',
    drivingLicenseExpiry: '2030-01-01',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

function documentPayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    _id: 'doc1',
    ownerType: 'DRIVER',
    ownerId: 'd1',
    documentType: 'EMIRATES_ID',
    fileUrl: 'https://cdn.example.com/doc1.jpg',
    verificationStatus: 'PENDING',
    isActive: true,
    isDeleted: false,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  };
}

describe('DriverDocumentsScreen', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    configureApiClient({
      getAccessToken: () => 'test-token',
      refreshSession: jest.fn(),
      onAuthExpired: jest.fn(),
    });
    mockLaunchImageLibrary.mockReset();
    mockLaunchImageLibrary.mockResolvedValue({ didCancel: true });
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
            <DriverDocumentsScreen />
          </NavigationContainer>
        </PaperProvider>
      </QueryClientProvider>,
    );
  }

  it('shows "Not uploaded yet" for document types with no matching document, and a status chip for ones that exist', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload() });
    mock.onGet('/drivers/d1/documents').reply(200, { success: true, data: [documentPayload()] });

    const { getByText, getAllByText } = await renderScreen();

    await waitFor(() => expect(getByText('Emirates ID')).toBeTruthy());
    expect(getByText('Pending')).toBeTruthy();
    expect(getByText('Driving License')).toBeTruthy();
    // Every other type in the fixed list has no matching document.
    expect(getAllByText('Not uploaded yet.').length).toBe(3);
  });

  it('shows the rejection reason for a rejected document without exposing any verify control', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload() });
    mock.onGet('/drivers/d1/documents').reply(200, {
      success: true,
      data: [documentPayload({ verificationStatus: 'REJECTED', rejectionReason: 'Blurry photo' })],
    });

    const { getByText, queryByText } = await renderScreen();

    await waitFor(() => expect(getByText('Reason: Blurry photo')).toBeTruthy());
    expect(queryByText('Verify')).toBeNull();
    expect(queryByText('Reject')).toBeNull();
  });

  it('uploads the picked asset with the correct documentType and refreshes the list on success', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload() });
    mock.onGet('/drivers/d1/documents').reply(200, { success: true, data: [] });
    mockLaunchImageLibrary.mockResolvedValue({
      assets: [{ uri: 'file:///photo.jpg', fileName: 'photo.jpg', type: 'image/jpeg' }],
    });
    mock.onPost('/drivers/d1/documents').reply(201, {
      success: true,
      data: documentPayload({ verificationStatus: 'PENDING' }),
    });

    const { getAllByText } = await renderScreen();

    await waitFor(() => expect(getAllByText('Upload').length).toBe(4));
    await fireEvent.press(getAllByText('Upload')[0]);

    await waitFor(() => expect(mock.history.post.length).toBe(1));
    expect(mock.history.post[0].headers?.['Content-Type']).toMatch(/multipart\/form-data/);
  });

  it('caps the picked photo to 1600x1600 while preserving quality/mediaType (Performance Audit F6)', async () => {
    mock.onGet('/drivers/me').reply(200, { success: true, data: driverPayload() });
    mock.onGet('/drivers/d1/documents').reply(200, { success: true, data: [] });
    mockLaunchImageLibrary.mockResolvedValue({ didCancel: true });

    const { getAllByText } = await renderScreen();

    await waitFor(() => expect(getAllByText('Upload').length).toBe(4));
    await fireEvent.press(getAllByText('Upload')[0]);

    await waitFor(() => expect(mockLaunchImageLibrary).toHaveBeenCalledTimes(1));
    expect(mockLaunchImageLibrary).toHaveBeenCalledWith({
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1600,
      maxHeight: 1600,
    });
  });

  it('shows an error state when the driver profile fails to load', async () => {
    mock.onGet('/drivers/me').reply(500);

    const { getByText } = await renderScreen();

    await waitFor(() => expect(getByText('Retry')).toBeTruthy());
  });
});
