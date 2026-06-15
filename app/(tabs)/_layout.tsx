import { useAuth } from '@/contexts/AuthContext';
import { PENDING_APPROVAL_ROUTE } from '@/src/core/constants/routes';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import CustomTabBar from '../../components/CustomTabBar';

export default function TabLayout() {
  const { loading, role, isApproved } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  if (role === 'admin') {
    return <Redirect href="/(admin)/dashboard" />;
  }

  if (role === 'director') {
    return <Redirect href="/(director)/dashboard" />;
  }

  if (!isApproved) {
    return <Redirect href={PENDING_APPROVAL_ROUTE} />;
  }

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="create-incident-new"
        options={{
          title: 'Signaler',
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <Ionicons size={28} name="person" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
