import {
  SrmPanel,
  SrmScreenHeader,
  SrmSettingsRow,
} from '@/components/ui/srm';
import { useAuth } from '@/contexts/AuthContext';
import { clearLocalSupabaseSession } from '@/lib/supabase';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { router } from 'expo-router';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Profile() {
  const { user, isAdmin } = useAuth();

  const handleSignOut = async () => {
    try {
      await clearLocalSupabaseSession();
      router.replace('/(auth)/login');
    } catch {
      Alert.alert('Erreur', 'Impossible de nettoyer la session locale.');
    }
  };

  const initial = user?.email?.charAt(0).toUpperCase() || 'A';
  const username = user?.email?.split('@')[0] || 'agent';

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <SrmScreenHeader
        avatarText={initial}
        kicker="PROFIL TERRAIN"
        title={username.toUpperCase()}
        subtitle={user?.email || 'Agent connecté'}
      />

      <View style={styles.content}>
        <SrmPanel>
          <SrmSettingsRow
            icon="shield-checkmark-outline"
            title="Rôle"
            description={isAdmin ? 'Administrateur' : 'Agent terrain'}
          />
          <SrmSettingsRow
            icon="cloud-offline-outline"
            title="Mode terrain"
            description="Les incidents sont conservés localement avant synchronisation."
            isLast
          />
        </SrmPanel>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>SESSION</Text>
        </View>

        <SrmPanel>
          <SrmSettingsRow
            icon="log-out-outline"
            iconBackground={COLORS.signalRedTint}
            title="Déconnexion"
            description="Quitter la session terrain sur cet appareil."
            danger
            onPress={handleSignOut}
            isLast
          />
        </SrmPanel>
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>VERSION 1.0.1</Text>
        <Text style={styles.product}>ONEE Incident Management System</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.xl,
  },
  sectionHeader: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    ...TYPOGRAPHY.labelUppercase,
    color: COLORS.textSecondary,
  },
  footer: {
    marginTop: 'auto',
    paddingBottom: SPACING.xl,
    alignItems: 'center',
  },
  version: {
    ...TYPOGRAPHY.labelUppercase,
    color: COLORS.textMuted,
  },
  product: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    marginTop: SPACING.xs,
  },
});
