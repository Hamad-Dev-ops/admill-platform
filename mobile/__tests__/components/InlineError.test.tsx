import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { InlineError } from '../../src/components';

describe('InlineError', () => {
  // The whole point of this component (accessibility audit, Phase 5): a
  // submit/action error must be announced to a screen reader as soon as it
  // appears, not require the user to manually discover it.
  it('renders the message with alert role and a live region so it gets announced', async () => {
    await render(
      <PaperProvider>
        <InlineError>Invalid email or password</InlineError>
      </PaperProvider>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
    expect(alert.props.accessibilityLiveRegion).toBe('polite');
  });
});
