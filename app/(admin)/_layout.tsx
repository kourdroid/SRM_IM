import AdminTabBar from '@/components/AdminTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { PENDING_APPROVAL_ROUTE } from '@/src/core/constants/routes';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function AdminLayout() {
  const { loading, role, isApproved } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  if (!isApproved) {
    return <Redirect href={PENDING_APPROVAL_ROUTE} />;
  }

  if (role !== 'admin') {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      tabBar={(props) => <AdminTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Dashboard' }} />
      <Tabs.Screen name="incidents" options={{ title: 'Incidents' }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports' }} />
      <Tabs.Screen name="field-references" options={{ title: 'Référentiels terrain', href: null }} />
      <Tabs.Screen name="communes" options={{ title: 'Communes', href: null }} />
      <Tabs.Screen name="incident-types" options={{ title: "Types d'incidents", href: null }} />
      <Tabs.Screen name="depart-hta" options={{ title: 'Départs HTA', href: null }} />
      <Tabs.Screen name="users" options={{ title: 'Users', href: null }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
