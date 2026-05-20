import { useAuth } from '@/contexts/AuthContext';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

/**
 * Root index - handles initial navigation based on auth state.
 * Redirects to login if unauthenticated, home if authenticated.
 */
export default function Index() {
  const { session, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (isAdmin) {
    return <Redirect href="/(admin)/dashboard" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
