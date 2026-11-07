import { SrmPasswordField } from '@/components/ui/srm';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { supabase, toSupabaseUserMessage } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Link, router, useLocalSearchParams, type Href } from 'expo-router';
import { authStorage } from '@/lib/authStorage';
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
  const { email: prefilledEmail, passwordReset } = useLocalSearchParams<{ email?: string; passwordReset?: string }>();
  const [email, setEmail] = useState(prefilledEmail ?? '');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const passwordInputRef = useRef<TextInput>(null);
  const signingIn = useRef(false);

  useEffect(() => {
    let mounted = true;
    async function loadSavedEmail() {
      const [remember, savedEmail] = await Promise.all([
        authStorage.getItemAsync(REMEMBER_EMAIL_KEY).catch(() => null),
        authStorage.getItemAsync(SAVED_EMAIL_KEY).catch(() => null),
      ]);
      if (!mounted) return;
      if (remember === 'true' && savedEmail) {
        setRememberEmail(true);
        if (!prefilledEmail) {
          setEmail(savedEmail);
          setTimeout(() => passwordInputRef.current?.focus(), 100);
        }
      }
    }
    void loadSavedEmail();
    return () => {
      mounted = false;
    };
  }, [prefilledEmail]);

  // Returning from a reset reuses this screen, so the previous input has to be replaced here.
  useEffect(() => {
    if (!passwordReset) return;
    if (prefilledEmail) setEmail(prefilledEmail);
    setPassword('');
    setTimeout(() => passwordInputRef.current?.focus(), 100);
  }, [passwordReset, prefilledEmail]);

  async function signInWithEmail() {
    if (signingIn.current) return;
    if (!email.trim()) {
      Alert.alert('Champs requis', 'Veuillez saisir votre adresse e-mail.');
      return;
    }
    if (!password) {
      Alert.alert('Champs requis', 'Veuillez saisir votre mot de passe.');
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    signingIn.current = true;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      if (error) {
        Alert.alert('Erreur de connexion', toSupabaseUserMessage(error));
      } else {
        if (rememberEmail) {
          await Promise.all([
            authStorage.setItemAsync(REMEMBER_EMAIL_KEY, 'true'),
            authStorage.setItemAsync(SAVED_EMAIL_KEY, normalizedEmail),
          ]).catch(() => undefined);
        } else {
          await Promise.all([
            authStorage.deleteItemAsync(REMEMBER_EMAIL_KEY).catch(() => undefined),
            authStorage.deleteItemAsync(SAVED_EMAIL_KEY).catch(() => undefined),
          ]);
        }
        router.replace('/');
      }
    } catch (error) {
      Alert.alert('Erreur de connexion', toSupabaseUserMessage(error));
    } finally {
      signingIn.current = false;
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
          <Text style={styles.brandName}>Intervx</Text>
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

          <SrmPasswordField
            inputRef={passwordInputRef}
            value={password}
            onChangeText={setPassword}
            placeholder="Mot de passe"
            autoComplete="current-password"
            onSubmitEditing={signInWithEmail}
          />

          <TouchableOpacity
            style={styles.forgotRow}
            onPress={() => router.push(`/(auth)/forgot-password?email=${encodeURIComponent(email.trim())}` as Href)}
            activeOpacity={0.8}
          >
            <Text style={styles.forgotText}>Mot de passe oublié ?</Text>
          </TouchableOpacity>

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
    letterSpacing: 2,
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
  forgotRow: {
    alignSelf: 'flex-end',
    minHeight: 48,
    justifyContent: 'center',
  },
  forgotText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '700',
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
