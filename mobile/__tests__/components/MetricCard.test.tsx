import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { MetricCard } from '../../src/components';

describe('MetricCard', () => {
  // Without grouping, a screen reader announces "12" then "Active Jobs" as
  // two disconnected fragments instead of one coherent metric
  // (accessibility audit, Phase 5).
  it('announces the value and label together as one coherent metric', async () => {
    await render(
      <PaperProvider>
        <MetricCard label="Active Jobs" value={12} icon="briefcase-outline" />
      </PaperProvider>,
    );

    expect(screen.getByLabelText('Active Jobs: 12')).toBeTruthy();
  });
});
