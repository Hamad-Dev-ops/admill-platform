import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import { Card, EmptyState, ErrorState, Header, LoadingState } from '../../../components';
import { listNotifications, markNotificationRead } from '../../../api/notifications.api';
import { colors, spacing } from '../../../design-system/tokens';
import { useSocketEvent } from '../../../hooks/useSocketEvent';
import type { Notification } from '../../../types/entities';
import { NOTIFICATION_ICON } from './notificationLabels';

// Role-agnostic by design — GET/PATCH /notifications behave identically for
// every role (frontend-docs/API-CONTRACT.md), so this one screen is reused
// by every role's stack navigator rather than duplicated. Uses plain
// `useNavigation().goBack()` instead of a role-specific StackParamList type
// since goBack() needs no param-list knowledge.
export function NotificationsScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: ['notifications', 'list'],
    queryFn: () => listNotifications({ limit: 50 }),
  });

  useSocketEvent('notification:new', () => {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  const notifications = notificationsQuery.data?.data ?? [];

  return (
    <View style={styles.container}>
      <Header title="Notifications" onBack={() => navigation.goBack()} />

      {notificationsQuery.isLoading && <LoadingState />}
      {notificationsQuery.isError && <ErrorState onRetry={() => notificationsQuery.refetch()} />}
      {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length === 0 && (
        <EmptyState icon="bell-outline" title="No notifications yet" />
      )}
      {!notificationsQuery.isLoading && !notificationsQuery.isError && notifications.length > 0 && (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <NotificationRow
              notification={item}
              onPress={() => {
                if (!item.isRead) markReadMutation.mutate(item._id);
              }}
            />
          )}
        />
      )}
    </View>
  );
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: Notification;
  onPress: () => void;
}) {
  return (
    <Card style={[styles.card, !notification.isRead && styles.unreadCard]} onPress={onPress}>
      <Card.Content style={styles.row}>
        <Icon source={NOTIFICATION_ICON[notification.type]} size={24} color={colors.primary} />
        <View style={styles.textCol}>
          <Text variant="titleSmall">{notification.title}</Text>
          <Text variant="bodySmall" style={styles.muted}>
            {notification.message}
          </Text>
        </View>
        {!notification.isRead && <View style={styles.unreadDot} />}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm },
  unreadCard: { backgroundColor: colors.primaryMuted },
  row: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  textCol: { flex: 1, gap: 2 },
  muted: { color: colors.inkMuted },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
});
