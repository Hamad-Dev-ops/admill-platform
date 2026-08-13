import React from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, EmptyState } from '../../components';
import { useAuth } from '../../auth/AuthContext';
import { colors, spacing } from '../../design-system/tokens';

export interface ProfileIncompleteScreenProps {
  icon?: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Shared "no role profile yet" / "pending approval" / "rejected" placeholder.
// Real onboarding forms (company creation, driver registration, customer
// profile) are built in Phase 2/3/4 — this just proves the navigation branch
// exists and works end-to-end (architecture-baseline.md §5.2).
export function ProfileIncompleteScreen({
  icon = 'account-clock-outline',
  title,
  description,
  actionLabel,
  onAction,
}: ProfileIncompleteScreenProps) {
  const { logout } = useAuth();

  return (
    <SafeAreaView style={styles.container}>
      <EmptyState
        icon={icon}
        title={title}
        description={description}
        actionLabel={actionLabel}
        onAction={onAction}
      />
      <View style={styles.footer}>
        <Button variant="text" onPress={() => logout().catch(() => {})}>
          Log out
        </Button>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  footer: {
    padding: spacing.lg,
    alignItems: 'center',
  },
});
