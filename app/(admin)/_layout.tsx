import { useAuth } from '@/contexts/AuthContext';
import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/**
 * Admin Layout with Route Protection
 * Only users with 'admin' role can access these routes.
 * Non-admins are redirected to the home screen.
 */
export default function AdminLayout() {
  const { isAdmin, loading } = useAuth();

  // Show loading while checking auth state
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // Redirect non-admins to home
  if (!isAdmin) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <Stack>
      <Stack.Screen name="dashboard" options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen name="incidents" options={{ title: 'Manage Incidents' }} />
      <Stack.Screen name="users" options={{ title: 'Manage Users' }} />
    </Stack>
  );
}
