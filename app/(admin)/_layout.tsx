import AdminTabBar from '@/components/AdminTabBar';
import { supabase } from '@/lib/supabase';
import { Tabs } from 'expo-router';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

export default function AdminLayout() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();

      if (error || data?.role !== 'admin') {
        setIsAdmin(false);
      } else {
        setIsAdmin(true);
      }
    } catch {
      setIsAdmin(false);
    }
  };

  if (isAdmin === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  if (!isAdmin) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      tabBar={(props) => <AdminTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="incidents" options={{ title: 'Incidents' }} />
      <Tabs.Screen name="users" options={{ title: 'Users' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
