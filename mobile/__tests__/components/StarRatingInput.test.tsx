import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { StarRatingInput } from '../../src/components';

describe('StarRatingInput', () => {
  it('labels each star and marks the ones at/under the current value as selected', async () => {
    await render(
      <PaperProvider>
        <StarRatingInput value={3} onChange={() => {}} />
      </PaperProvider>,
    );

    const star3 = screen.getByRole('button', { name: '3 stars' });
    const star4 = screen.getByRole('button', { name: '4 stars' });

    expect(star3.props.accessibilityState).toMatchObject({ selected: true });
    expect(star4.props.accessibilityState).toMatchObject({ selected: false });
  });

  it('calls onChange with the tapped star value', async () => {
    const onChange = jest.fn();
    await render(
      <PaperProvider>
        <StarRatingInput value={0} onChange={onChange} />
      </PaperProvider>,
    );

    await fireEvent.press(screen.getByRole('button', { name: '4 stars' }));

    expect(onChange).toHaveBeenCalledWith(4);
  });

  it('marks stars as disabled and does not call onChange when disabled', async () => {
    const onChange = jest.fn();
    await render(
      <PaperProvider>
        <StarRatingInput value={2} onChange={onChange} disabled />
      </PaperProvider>,
    );

    const star = screen.getByRole('button', { name: '5 stars' });
    expect(star.props.accessibilityState).toMatchObject({ disabled: true });

    await fireEvent.press(star);
    expect(onChange).not.toHaveBeenCalled();
  });
});
