import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { BottomTabBar } from '../../components';
import { DashboardScreen } from '../../features/owner/dashboard/DashboardScreen';
import { FleetListScreen } from '../../features/owner/fleet/FleetListScreen';
import { JobsListScreen } from '../../features/owner/jobs/JobsListScreen';
import { FleetTrackingScreen } from '../../features/owner/tracking/FleetTrackingScreen';
import { MoreScreen } from '../../features/owner/more/MoreScreen';
import type { OwnerTabParamList } from './types';

const Tab = createBottomTabNavigator<OwnerTabParamList>();

function dashboardIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="view-dashboard-outline" size={size} color={color} />;
}
function fleetIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="truck-outline" size={size} color={color} />;
}
function jobsIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="clipboard-list-outline" size={size} color={color} />;
}
function trackingIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="map-marker-radius-outline" size={size} color={color} />;
}
function moreIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="dots-horizontal" size={size} color={color} />;
}

export function OwnerTabNavigator() {
  return (
    <Tab.Navigator tabBar={BottomTabBar} screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Dashboard', tabBarIcon: dashboardIcon }}
      />
      <Tab.Screen
        name="Fleet"
        component={FleetListScreen}
        options={{ tabBarLabel: 'Fleet', tabBarIcon: fleetIcon }}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsListScreen}
        options={{ tabBarLabel: 'Jobs', tabBarIcon: jobsIcon }}
      />
      <Tab.Screen
        name="Tracking"
        component={FleetTrackingScreen}
        options={{ tabBarLabel: 'Tracking', tabBarIcon: trackingIcon }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{ tabBarLabel: 'More', tabBarIcon: moreIcon }}
      />
    </Tab.Navigator>
  );
}
