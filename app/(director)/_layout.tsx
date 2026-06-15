import DirectorTabBar from '@/components/DirectorTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { PENDING_APPROVAL_ROUTE } from '@/src/core/constants/routes';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function DirectorLayout() {
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

  if (role !== 'director') {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      tabBar={(props) => <DirectorTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Accueil' }} />
      <Tabs.Screen name="incidents" options={{ title: 'Incidents' }} />
    </Tabs>
  );
}
