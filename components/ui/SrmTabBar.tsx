import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type IconName = keyof typeof Ionicons.glyphMap;

export interface SrmTabItemConfig {
  label: string;
  focusedIcon: IconName;
  icon: IconName;
  hideLabelWhenFocused?: boolean;
}

interface SrmTabBarProps extends BottomTabBarProps {
  items: Record<string, SrmTabItemConfig>;
  hiddenRoutes?: string[];
  activeRouteFor?: (routeName: string, currentRouteName: string) => boolean;
}

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function SrmTabBar({
  state,
  navigation,
  items,
  hiddenRoutes = [],
  activeRouteFor,
}: SrmTabBarProps) {
  const insets = useSafeAreaInsets();
  const currentRouteName = state.routes[state.index]?.name;
  const hiddenRouteSet = new Set(hiddenRoutes);

  useEffect(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        150,
        LayoutAnimation.Types.easeOut,
        LayoutAnimation.Properties.opacity
      )
    );
  }, [state.index]);

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.md,
        paddingBottom: insets.bottom + 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.md,
      }}
    >
      {state.routes.map((route, index) => {
        if (hiddenRouteSet.has(route.name)) return null;

        const item = items[route.name];
        if (!item) return null;

        const isRouteFocused = state.index === index;
        const isFocused = isRouteFocused || activeRouteFor?.(route.name, currentRouteName) === true;
        const showLabel = isFocused && item.hideLabelWhenFocused !== true;

        const onPress = () => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (route.name !== currentRouteName && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{
              flex: showLabel ? 2 : 1,
              height: 50,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isFocused ? COLORS.accent : COLORS.background,
              borderRadius: RADIUS.md,
            }}
          >
            <Ionicons
              name={isFocused ? item.focusedIcon : item.icon}
              size={22}
              color={isFocused ? COLORS.textPrimary : COLORS.textMuted}
            />
            {showLabel ? (
              <Text
                numberOfLines={1}
                style={{
                  marginLeft: SPACING.sm,
                  ...TYPOGRAPHY.label,
                  color: COLORS.textPrimary,
                }}
              >
                {item.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
