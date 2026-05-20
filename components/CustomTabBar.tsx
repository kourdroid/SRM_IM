import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { LayoutAnimation, Platform, Pressable, Text, UIManager, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function CustomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  // Subtle layout animation on tab change
  useEffect(() => {
    LayoutAnimation.configureNext(
      LayoutAnimation.create(
        150, // Shorter duration for subtlety
        LayoutAnimation.Types.easeOut,
        LayoutAnimation.Properties.opacity
      )
    );
  }, [state.index]);

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: insets.bottom + 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const isAddButton = index === 1;

        // Skip hidden routes
        if ((options as any).href === null) return null;

        const onPress = () => {
          // Haptic feedback - Light tap
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Config
        let label = "";
        let iconMeta: keyof typeof Ionicons.glyphMap = "help";

        if (index === 0) {
          label = "Home";
          iconMeta = isFocused ? "home" : "home-outline";
        } else if (index === 1) {
          label = "Add";
          iconMeta = "add";
        } else if (index === 2) {
          label = "Profile";
          iconMeta = isFocused ? "person" : "person-outline";
        }

        const showLabel = isFocused && !isAddButton;

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
              backgroundColor: isFocused ? '#DAF22C' : '#F3F4F6',
              borderRadius: 8,
            }}
          >
            <Ionicons
              name={iconMeta}
              size={24}
              color={isFocused ? "#111827" : "#9CA3AF"}
            />
            {showLabel && (
              <Text
                numberOfLines={1}
                style={{
                  marginLeft: 8,
                  fontSize: 14,
                  fontWeight: '700',
                  color: '#111827',
                }}
              >
                {label}
              </Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
