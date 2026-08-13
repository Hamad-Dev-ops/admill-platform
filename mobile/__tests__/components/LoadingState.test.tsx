import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { LoadingState } from '../../src/components';

describe('LoadingState', () => {
  // Previously just an ActivityIndicator with no label — a screen reader
  // user landing on a loading screen with no `label` prop heard nothing at
  // all (accessibility audit, Phase 5).
  it('defaults to an accessible "Loading" announcement when no label is given', async () => {
    await render(
      <PaperProvider>
        <LoadingState />
      </PaperProvider>,
    );

    expect(screen.getByRole('progressbar', { name: 'Loading' })).toBeTruthy();
  });

  it('uses a custom label when given', async () => {
    await render(
      <PaperProvider>
        <LoadingState label="Fetching your jobs…" />
      </PaperProvider>,
    );

    expect(screen.getByRole('progressbar', { name: 'Fetching your jobs…' })).toBeTruthy();
  });
});
