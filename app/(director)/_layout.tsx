import DirectorTabBar from '@/components/DirectorTabBar';
import { useAuth } from '@/contexts/AuthContext';
import { Redirect, Tabs } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function DirectorLayout() {
  const { loading, role } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6' }}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
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
