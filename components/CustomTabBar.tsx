import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { Platform, Pressable, View } from "react-native";

export default function CustomTabBar({
  state,
  descriptors,
  navigation,
}: BottomTabBarProps) {
  return (
    <View
      style={{
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 30 : 20,
        left: 40,
        right: 40,
        height: 70,
        backgroundColor: '#191820',
        borderRadius: 35,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 20,
      }}
    >
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        // Skip hidden routes (Expo Router uses href: null)
        if ((options as any).href === null) return null;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        // Icons
        let iconName: keyof typeof Ionicons.glyphMap = "home";
        if (index === 0) iconName = isFocused ? "home" : "home-outline";
        if (index === 1) iconName = "add";
        if (index === 2) iconName = isFocused ? "person" : "person-outline";

        // Center Button (Report)
        if (index === 1) {
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={{ top: -20 }}
            >
              <View
                style={{
                  width: 70,
                  height: 70,
                  borderRadius: 35,
                  backgroundColor: '#DAF22C',
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderWidth: 6,
                  borderColor: '#f9fafb',
                  shadowColor: '#DAF22C',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 10,
                  elevation: 10,
                }}
              >
                <Ionicons name="add" size={36} color="#191820" />
              </View>
            </Pressable>
          );
        }

        // Side Buttons
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: '100%' }}
          >
            <Ionicons
              name={iconName}
              size={28}
              color={isFocused ? "#DAF22C" : "#6B7280"}
            />
            {isFocused && (
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#DAF22C', marginTop: 4 }} />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}
