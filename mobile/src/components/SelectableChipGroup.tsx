import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';
import { colors, spacing } from '../design-system/tokens';

export interface SelectableChipOption {
  value: string;
  label: string;
}

export interface SelectableChipGroupProps {
  options: SelectableChipOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}

// Dumb by design — doesn't know single vs multi-select, the caller's
// onToggle decides (e.g. replace the whole selection vs add/remove one).
export function SelectableChipGroup({ options, selectedValues, onToggle }: SelectableChipGroupProps) {
  return (
    <View style={styles.row}>
      {options.map((option) => {
        const selected = selectedValues.includes(option.value);
        return (
          <Chip
            key={option.value}
            selected={selected}
            onPress={() => onToggle(option.value)}
            style={selected ? styles.selected : undefined}
            textStyle={selected ? styles.selectedText : undefined}
          >
            {option.label}
          </Chip>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  selected: { backgroundColor: colors.primaryMuted },
  selectedText: { color: colors.ink },
});
