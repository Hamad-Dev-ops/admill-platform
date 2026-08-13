import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { NavigationContainer } from '@react-navigation/native';
import { MoreScreen } from '../../../src/features/owner/more/MoreScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockLogout = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', firstName: 'Owen', lastName: 'Erson', email: 'o@x.com', phone: '1', role: 'OWNER' },
    logout: mockLogout,
  }),
}));

function renderScreen() {
  return render(
    <PaperProvider>
      <NavigationContainer>
        <MoreScreen />
      </NavigationContainer>
    </PaperProvider>,
  );
}

describe('MoreScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockLogout.mockClear();
  });

  it('renders the real signed-in owner name and every menu item', async () => {
    const { getByText } = await renderScreen();

    expect(getByText('Owen Erson')).toBeTruthy();
    expect(getByText('Notifications')).toBeTruthy();
    expect(getByText('Reports & Analytics')).toBeTruthy();
    expect(getByText('Company Settings')).toBeTruthy();
    expect(getByText('Log out')).toBeTruthy();
  });

  it('navigates to each destination screen when its menu item is pressed', async () => {
    const { getByText } = await renderScreen();

    await fireEvent.press(getByText('Notifications'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Notifications');

    await fireEvent.press(getByText('Reports & Analytics'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Analytics');

    await fireEvent.press(getByText('Company Settings'));
    expect(mockNavigate).toHaveBeenLastCalledWith('Settings');
  });

  it('logs out when "Log out" is pressed', async () => {
    const { getByText } = await renderScreen();

    await fireEvent.press(getByText('Log out'));
    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
