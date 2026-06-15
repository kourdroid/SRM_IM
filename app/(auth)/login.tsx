import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { supabase, toSupabaseUserMessage } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const REMEMBER_EMAIL_KEY = 'srm_login_remember_email';
const SAVED_EMAIL_KEY = 'srm_login_saved_email';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);

  useEffect(() => {
    let mounted = true;
    async function loadSavedEmail() {
      const [remember, savedEmail] = await Promise.all([
        SecureStore.getItemAsync(REMEMBER_EMAIL_KEY).catch(() => null),
        SecureStore.getItemAsync(SAVED_EMAIL_KEY).catch(() => null),
      ]);
      if (!mounted) return;
      if (remember === 'true' && savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
        setTimeout(() => passwordInputRef.current?.focus(), 100);
      }
    }
    void loadSavedEmail();
    return () => {
      mounted = false;
    };
  }, []);

  async function signInWithEmail() {
    if (!email.trim()) {
      Alert.alert('Champs requis', 'Veuillez saisir votre adresse e-mail.');
      return;
    }
    if (!password) {
      Alert.alert('Champs requis', 'Veuillez saisir votre mot de passe.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        Alert.alert('Erreur de connexion', toSupabaseUserMessage(error));
      } else {
        if (rememberEmail) {
          await Promise.all([
            SecureStore.setItemAsync(REMEMBER_EMAIL_KEY, 'true'),
            SecureStore.setItemAsync(SAVED_EMAIL_KEY, normalizedEmail),
          ]);
        } else {
          await Promise.all([
            SecureStore.deleteItemAsync(REMEMBER_EMAIL_KEY).catch(() => undefined),
            SecureStore.deleteItemAsync(SAVED_EMAIL_KEY).catch(() => undefined),
          ]);
        }
        router.replace('/');
      }
    } catch (error) {
      Alert.alert('Erreur de connexion', toSupabaseUserMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        {/* ── Brand Mark ── */}
        <View style={styles.brandSection}>
          <Text style={styles.brandName}>SRM</Text>
          <Text style={styles.brandSub}>Gestion des Incidents</Text>
          <Text style={styles.welcomeText}>Bon retour</Text>
        </View>

        {/* ── Form ── */}
        <View style={styles.form}>
          <View style={styles.inputRow}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.input}
              placeholder="Adresse e-mail"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordInputRef.current?.focus()}
            />
          </View>

          <View style={styles.inputRow}>
            <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              ref={passwordInputRef}
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={signInWithEmail}
            />
          </View>

          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberEmail(value => !value)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={rememberEmail ? 'checkbox' : 'square-outline'}
              size={22}
              color={rememberEmail ? COLORS.accent : COLORS.textMuted}
            />
            <Text style={styles.rememberText}>Se souvenir de moi</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
            onPress={signInWithEmail}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.textPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>Connexion</Text>
            )}
          </TouchableOpacity>

          <View style={styles.footerRow}>
            <Text style={styles.footerText}>Pas encore de compte ? </Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Créer un compte</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
    justifyContent: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: SPACING.section,
  },
  brandName: {
    ...TYPOGRAPHY.display,
    color: COLORS.textPrimary,
    letterSpacing: 8,
    textTransform: 'uppercase',
    marginBottom: SPACING.sm,
  },
  brandSub: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: SPACING.lg,
  },
  welcomeText: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textSecondary,
  },
  form: {
    gap: SPACING.md,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.lg,
    height: 56,
    backgroundColor: COLORS.surface,
    gap: SPACING.md,
  },
  input: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '400',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  rememberText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  primaryBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.sm,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: SPACING.sm,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  primaryBtnDisabled: {
    opacity: 0.7,
  },
  primaryBtnText: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  footerText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  footerLink: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
});
