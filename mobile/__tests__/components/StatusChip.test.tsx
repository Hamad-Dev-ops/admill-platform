import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { StatusChip } from '../../src/components';

describe('StatusChip', () => {
  it('renders the given label for a known tone', async () => {
    await render(
      <PaperProvider>
        <StatusChip label="Completed" tone="success" />
      </PaperProvider>,
    );

    expect(screen.getByText('Completed')).toBeTruthy();
  });
});
