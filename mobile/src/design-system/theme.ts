import { MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { colors } from './tokens';

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: colors.primary,
    onPrimary: colors.ink,
    primaryContainer: colors.primaryMuted,
    background: colors.background,
    surface: colors.surface,
    onSurface: colors.ink,
    onSurfaceVariant: colors.inkMuted,
    outline: colors.border,
    error: colors.danger,
  },
};
