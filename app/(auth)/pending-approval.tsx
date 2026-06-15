import { clearLocalSupabaseSession } from '@/lib/supabase';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PendingApproval() {
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await clearLocalSupabaseSession();
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Déconnexion impossible.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="time-outline" size={34} color={COLORS.textPrimary} />
        </View>
        <Text style={styles.kicker}>COMPTE EN ATTENTE</Text>
        <Text style={styles.title}>Approbation administrateur requise</Text>
        <Text style={styles.message}>
          Votre compte a été créé. Un administrateur doit l&apos;approuver avant l&apos;accès aux incidents SRM.
        </Text>

        <TouchableOpacity
          style={[styles.secondaryButton, signingOut && styles.disabledButton]}
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.8}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color={COLORS.textPrimary} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={COLORS.textPrimary} />
              <Text style={styles.secondaryButtonText}>Changer de compte</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.xl,
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
  },
  kicker: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },
  title: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  message: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.xl,
  },
  secondaryButton: {
    minWidth: 210,
    height: 52,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
  },
  disabledButton: {
    opacity: 0.65,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
  },
});
