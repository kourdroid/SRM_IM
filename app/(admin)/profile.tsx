import {
  SrmPanel,
  SrmScreenHeader,
  SrmSettingsRow,
  SrmStatusBadge,
} from '@/components/ui/srm';
import { useAuth } from '@/contexts/AuthContext';
import { clearLocalSupabaseSession } from '@/lib/supabase';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminProfile() {
  const { user, isAdmin } = useAuth();
  const appVersion = Constants.expoConfig?.version ?? '1.0.5';

  const handleSignOut = async () => {
    try {
      await clearLocalSupabaseSession();
      router.replace('/(auth)/login');
    } catch {
      Alert.alert('Erreur', 'Impossible de nettoyer la session locale.');
    }
  };

  const initial = user?.email?.charAt(0).toUpperCase() || 'A';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SrmScreenHeader
          avatarText={initial}
          kicker="PARAMÈTRES"
          title="Administration"
          subtitle={user?.email || 'Administrateur'}
          rightSlot={<SrmStatusBadge label={isAdmin ? 'ADMIN' : 'TERRAIN'} />}
          style={styles.header}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>ADMINISTRATION</Text>
          <Text style={styles.sectionHint}>Données de référence et accès équipe</Text>
        </View>

        <SrmPanel style={styles.panel}>
          <SrmSettingsRow
            icon="people-outline"
            iconColor={COLORS.signalBlue}
            iconBackground={COLORS.signalBlueTint}
            title="Utilisateurs"
            description="Créer les comptes, changer les rôles et supprimer les accès."
            onPress={() => router.push('/(admin)/users')}
          />
          <SrmSettingsRow
            icon="options-outline"
            iconColor={COLORS.signalGreen}
            iconBackground={COLORS.signalGreenTint}
            title="Référentiels terrain"
            description="Communes, types d'incidents et départs HTA utilisés par les agents."
            onPress={() => router.push('/(admin)/field-references')}
            isLast
          />
        </SrmPanel>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>SESSION</Text>
        </View>

        <SrmPanel style={styles.panel}>
          <SrmSettingsRow
            icon="log-out-outline"
            iconBackground={COLORS.signalRedTint}
            title="Déconnexion"
            description="Quitter la session administrateur sur cet appareil."
            danger
            onPress={handleSignOut}
            isLast
          />
        </SrmPanel>

        <View style={styles.footer}>
          <Text style={styles.version}>VERSION {appVersion}</Text>
          <Text style={styles.product}>SRM Incident Management System</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: 36,
  },
  header: {
    borderRadius: 16,
    marginBottom: 22,
    paddingTop: SPACING.xxl,
  },
  sectionHeader: {
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  sectionLabel: {
    ...TYPOGRAPHY.labelUppercase,
    color: COLORS.textSecondary,
  },
  sectionHint: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  panel: {
    marginBottom: SPACING.lg,
  },
  footer: {
    alignItems: 'center',
    marginTop: 14,
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
