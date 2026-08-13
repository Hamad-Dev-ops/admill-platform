import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { Button } from '../../src/components';

function renderWithTheme(ui: React.ReactElement) {
  return render(<PaperProvider>{ui}</PaperProvider>);
}

describe('Button', () => {
  it('renders its label and responds to press', async () => {
    const onPress = jest.fn();
    await renderWithTheme(<Button onPress={onPress}>Log in</Button>);

    fireEvent.press(screen.getByText('Log in'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', async () => {
    const onPress = jest.fn();
    await renderWithTheme(
      <Button onPress={onPress} disabled>
        Log in
      </Button>,
    );

    fireEvent.press(screen.getByText('Log in'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
