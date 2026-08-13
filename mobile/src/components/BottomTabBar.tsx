import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors, spacing } from '../design-system/tokens';

// Passed as the `tabBar` prop to a Tab.Navigator so every role navigator gets
// the same themed tab bar instead of Paper/react-navigation's default look.
//
// Deliberately reads `insets` from props rather than calling
// useSafeAreaInsets() itself: BottomTabView invokes the tabBar prop as a
// plain function call inside a context-consumer render prop (see its
// source), not via JSX/createElement, so a hook call inside this component
// breaks React's rules. react-navigation already computes the right insets
// (merging any `safeAreaInsets` override) and hands them to us as a prop —
// use that instead.
export function BottomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const tintColor = isFocused ? colors.primary : colors.inkMuted;
        const label =
          typeof options.tabBarLabel === 'string' ? options.tabBarLabel : route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={onPress}
            style={styles.tab}
          >
            {options.tabBarIcon?.({ focused: isFocused, color: tintColor, size: 22 })}
            <Text variant="labelSmall" style={{ color: tintColor }}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
});
