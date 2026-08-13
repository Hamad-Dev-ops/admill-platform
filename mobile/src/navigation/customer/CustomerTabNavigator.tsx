import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon } from 'react-native-paper';
import { BottomTabBar } from '../../components';
import { CustomerHomeScreen } from '../../features/customer/home/CustomerHomeScreen';
import { CustomerJobsScreen } from '../../features/customer/jobs/CustomerJobsScreen';
import { CustomerProfileScreen } from '../../features/customer/profile/CustomerProfileScreen';
import type { CustomerTabParamList } from './types';

const Tab = createBottomTabNavigator<CustomerTabParamList>();

function homeIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="home-outline" size={size} color={color} />;
}
function tripsIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="clipboard-list-outline" size={size} color={color} />;
}
function profileIcon({ color, size }: { color: string; size: number }) {
  return <Icon source="account-outline" size={size} color={color} />;
}

export function CustomerTabNavigator() {
  return (
    <Tab.Navigator tabBar={BottomTabBar} screenOptions={{ headerShown: false }}>
      <Tab.Screen
        name="Home"
        component={CustomerHomeScreen}
        options={{ tabBarLabel: 'Home', tabBarIcon: homeIcon }}
      />
      <Tab.Screen
        name="Trips"
        component={CustomerJobsScreen}
        options={{ tabBarLabel: 'Trips', tabBarIcon: tripsIcon }}
      />
      <Tab.Screen
        name="Profile"
        component={CustomerProfileScreen}
        options={{ tabBarLabel: 'Profile', tabBarIcon: profileIcon }}
      />
    </Tab.Navigator>
  );
}
