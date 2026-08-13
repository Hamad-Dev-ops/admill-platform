import React from 'react';
import { render } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';
import { Text } from 'react-native-paper';
import { Card } from '../../src/components';

describe('Card', () => {
  // Unlike Paper's own Chip, Paper's Card does NOT set accessibilityRole
  // automatically when onPress is present — every pressable Card in this
  // app (job/driver/vehicle list rows, dashboard shortcuts, ...) was
  // silently missing this before (accessibility audit, Phase 5).
  //
  // Queried via container.queryAll (this project's established pattern for
  // native host components not reliably reachable through getByRole) —
  // Paper's Card nests the element carrying accessibilityRole inside extra
  // wrapper Views that aren't themselves marked `accessible`.
  it('is announced as a button when pressable (onPress is given)', async () => {
    const { container } = await render(
      <PaperProvider>
        <Card onPress={() => {}}>
          <Text>Job JOB-000001</Text>
        </Card>
      </PaperProvider>,
    );

    const [cardContainer] = container.queryAll((instance) => instance.props.testID === 'card-container');
    expect(cardContainer.props.accessibilityRole).toBe('button');
  });

  it('is not announced as a button when it is purely informational (no onPress)', async () => {
    const { container } = await render(
      <PaperProvider>
        <Card>
          <Text>Job JOB-000001</Text>
        </Card>
      </PaperProvider>,
    );

    const [cardContainer] = container.queryAll((instance) => instance.props.testID === 'card-container');
    expect(cardContainer.props.accessibilityRole).toBeUndefined();
  });
});
