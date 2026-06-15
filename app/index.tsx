import { useAuth } from '@/contexts/AuthContext';
import { PENDING_APPROVAL_ROUTE } from '@/src/core/constants/routes';
import { Redirect } from 'expo-router';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';

/**
 * Root index - handles initial navigation based on auth state.
 * Redirects to login if unauthenticated, home if authenticated.
 */
export default function Index() {
  const { session, loading, startupIssue, role, approvalStatus, isApproved, retryStartup } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  if (startupIssue && startupIssue !== 'INVALID_SESSION' && (!session || approvalStatus === null)) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#F3F4F6' }}>
        <View style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8, padding: 20 }}>
          <Text style={{ color: '#111827', fontWeight: '900', fontSize: 18, marginBottom: 8 }}>
            Connexion à vérifier
          </Text>
          <Text style={{ color: '#4B5563', fontSize: 14, lineHeight: 20, marginBottom: 16 }}>
            Impossible de confirmer votre rôle maintenant. Vérifiez la connexion puis réessayez. Les incidents locaux ne sont pas supprimés.
          </Text>
          <TouchableOpacity
            onPress={retryStartup}
            style={{ backgroundColor: '#DAF22C', borderRadius: 6, paddingVertical: 14, alignItems: 'center' }}
          >
            <Text style={{ color: '#111827', fontWeight: '900', textTransform: 'uppercase' }}>
              Réessayer
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!isApproved) {
    return <Redirect href={PENDING_APPROVAL_ROUTE} />;
  }

  if (role === 'admin') {
    return <Redirect href="/(admin)/dashboard" />;
  }

  if (role === 'director') {
    return <Redirect href="/(director)/dashboard" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
