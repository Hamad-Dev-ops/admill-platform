import React from 'react';
import { StyleSheet, View } from 'react-native';
import { List } from 'react-native-paper';
import type { StyleProp, ViewStyle } from 'react-native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '../../../components';
import { useAuth } from '../../../auth/AuthContext';
import { colors } from '../../../design-system/tokens';
import type { OwnerStackParamList } from '../../../navigation/owner/types';

type ListLeftIconProps = { color: string; style: StyleProp<ViewStyle> };

function notificationsIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="bell-outline" />;
}
function analyticsIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="chart-bar" />;
}
function settingsIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="cog-outline" />;
}
function logoutIcon(props: ListLeftIconProps) {
  return <List.Icon {...props} icon="logout" />;
}

export function MoreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OwnerStackParamList>>();
  const { user, logout } = useAuth();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header title="More" />
      <View style={styles.content}>
        <List.Section>
          <List.Subheader>{user?.firstName} {user?.lastName}</List.Subheader>
          <List.Item
            title="Notifications"
            left={notificationsIcon}
            onPress={() => navigation.navigate('Notifications')}
          />
          <List.Item
            title="Reports & Analytics"
            left={analyticsIcon}
            onPress={() => navigation.navigate('Analytics')}
          />
          <List.Item
            title="Company Settings"
            left={settingsIcon}
            onPress={() => navigation.navigate('Settings')}
          />
          <List.Item title="Log out" left={logoutIcon} onPress={() => logout().catch(() => {})} />
        </List.Section>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1 },
});
