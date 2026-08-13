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

  // Paper's Chip defaults accessibilityRole to "button" even with no
  // onPress — StatusChip is display-only (a job/driver/vehicle status
  // badge), so a screen reader announcing it as a tappable button would be
  // actively misleading (accessibility audit, Phase 5).
  it('is announced as text, not a button — it is not tappable', async () => {
    await render(
      <PaperProvider>
        <StatusChip label="Pending" tone="warning" />
      </PaperProvider>,
    );

    expect(screen.getAllByRole('text', { name: 'Pending' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Pending' })).toBeNull();
  });
});
