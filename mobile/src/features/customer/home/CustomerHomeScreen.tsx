import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MapView from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Card, ErrorState, Header, IconButton, LoadingState, StatusChip } from '../../../components';
import { colors, spacing } from '../../../design-system/tokens';
import { useUnreadNotificationCount } from '../../../hooks/useUnreadNotificationCount';
import type { CustomerStackParamList } from '../../../navigation/customer/types';
import { JOB_STATUS_LABEL, JOB_STATUS_TONE } from '../../../utils/statusPresentation';
import { SERVICE_TYPE_LABEL } from '../../owner/fleet/vehicleLabels';
import { useMyActiveJob } from '../shared/useMyActiveJob';

// Default map region (central Dubai) — decorative only, not a location
// claim. Home deliberately does not request location permission on mount;
// the real, functionally-necessary pickup location is captured in the fare
// estimate screen (4.5), where it's actually used for a job.
const DEFAULT_REGION = {
  latitude: 25.2048,
  longitude: 55.2708,
  latitudeDelta: 0.1,
  longitudeDelta: 0.1,
};

export function CustomerHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<CustomerStackParamList>>();
  const unreadCount = useUnreadNotificationCount();
  const { activeJob, isLoading, isError, refetch } = useMyActiveJob();

  // A PENDING job hasn't been matched yet — that's the "Finding your
  // driver..." experience (4.7), not the tracking/detail screen.
  function goToActiveJob(job: NonNullable<typeof activeJob>) {
    if (job.status === 'PENDING') {
      navigation.navigate('FindingDriver', { jobId: job._id });
    } else {
      navigation.navigate('JobDetail', { jobId: job._id });
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        title="Home"
        right={
          <IconButton
            icon={unreadCount > 0 ? 'bell-badge' : 'bell-outline'}
            accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            onPress={() => navigation.navigate('Notifications')}
          />
        }
      />

      <View style={styles.mapWrap}>
        <MapView style={styles.map} initialRegion={DEFAULT_REGION} pointerEvents="none" />
      </View>

      <View style={styles.sheet}>
        {isLoading && <LoadingState />}
        {!isLoading && isError && <ErrorState onRetry={() => refetch()} />}

        {!isLoading && !isError && activeJob && (
          <Card onPress={() => goToActiveJob(activeJob)}>
            <Card.Content style={styles.activeJobContent}>
              <View style={styles.rowBetween}>
                <Text variant="titleMedium">{activeJob.jobNumber}</Text>
                <StatusChip
                  label={JOB_STATUS_LABEL[activeJob.status]}
                  tone={JOB_STATUS_TONE[activeJob.status]}
                />
              </View>
              <Text variant="bodySmall" style={styles.muted}>
                {SERVICE_TYPE_LABEL[activeJob.serviceType]}
              </Text>
              <Text variant="bodySmall" style={styles.muted} numberOfLines={1}>
                {activeJob.pickupLocation.address}
              </Text>
              <Button variant="secondary" onPress={() => goToActiveJob(activeJob)}>
                {activeJob.status === 'PENDING' ? 'View request' : 'View trip'}
              </Button>
            </Card.Content>
          </Card>
        )}

        {!isLoading && !isError && !activeJob && (
          <Card>
            <Card.Content style={styles.requestContent}>
              <Text variant="titleLarge">Need recovery?</Text>
              <Text variant="bodyMedium" style={styles.muted}>
                Get a fare estimate and request a recovery vehicle.
              </Text>
              <Button variant="primary" onPress={() => navigation.navigate('ServiceSelection')}>
                Request Recovery
              </Button>
            </Card.Content>
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapWrap: { flex: 1 },
  map: { flex: 1 },
  sheet: { padding: spacing.md },
  activeJobContent: { gap: spacing.xs },
  requestContent: { gap: spacing.sm },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { color: colors.inkMuted },
});
