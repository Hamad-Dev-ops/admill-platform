import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { BottomTabBar } from '../../components';
import { DriverDashboardScreen } from '../../features/driver/dashboard/DriverDashboardScreen';
import { DriverEarningsScreen } from '../../features/driver/earnings/DriverEarningsScreen';
import { DriverJobsScreen } from '../../features/driver/jobs/DriverJobsScreen';
import { DriverProfileScreen } from '../../features/driver/profile/DriverProfileScreen';
import type { DriverTabParamList } from './types';

const Tab = createBottomTabNavigator<DriverTabParamList>();

function dashboardIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="view-dashboard-outline" size={size} color={color} />;
}
function jobsIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="clipboard-list-outline" size={size} color={color} />;
}
function earningsIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="cash-multiple" size={size} color={color} />;
}
function profileIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="account-outline" size={size} color={color} />;
}

export function DriverTabNavigator() {
  return (
    <Tab.Navigator tabBar={BottomTabBar} screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Dashboard"
        component={DriverDashboardScreen}
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: dashboardIcon }}
      />
      <Tab.Screen
        name="Jobs"
        component={DriverJobsScreen}
        options={{ tabBarLabel: 'Jobs', tabBarIcon: jobsIcon }}
      />
      <Tab.Screen
        name="Earnings"
        component={DriverEarningsScreen}
        options={{ tabBarLabel: 'Earnings', tabBarIcon: earningsIcon }}
      />
      <Tab.Screen
        name="Profile"
        component={DriverProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: profileIcon }}
      />
    </Tab.Navigator>
  );
}
