import { SrmPasswordField } from '@/components/ui/srm';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { createPasswordReset, PasswordService, validateNewPassword } from '@/src/core/services/passwordService';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const RESEND_COOLDOWN_SECONDS = 60;
const CODE_PATTERN = /^\d{6,10}$/;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Une erreur inconnue est survenue.';
}

export default function ForgotPassword() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [passwordReset] = useState(createPasswordReset);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmationInputRef = useRef<TextInput>(null);
  const busy = loading || resending;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendCode() {
    if (!email.trim()) {
      Alert.alert('Champ requis', 'Veuillez saisir votre adresse e-mail.');
      return;
    }
    setLoading(true);
    try {
      await PasswordService.requestPasswordReset(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep('code');
    } catch (error) {
      Alert.alert('Erreur', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    setResending(true);
    try {
      await PasswordService.requestPasswordReset(email);
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      Alert.alert('Code renvoyé', 'Utilisez uniquement le code du dernier e-mail reçu.');
    } catch (error) {
      Alert.alert('Erreur', getErrorMessage(error));
    } finally {
      setResending(false);
    }
  }

  async function resetPassword() {
    if (!CODE_PATTERN.test(code.trim())) {
      Alert.alert('Code invalide', 'Saisissez le code reçu par e-mail.');
      return;
    }
    const passwordIssue = validateNewPassword(password, confirmation);
    if (passwordIssue) {
      Alert.alert('Mot de passe invalide', passwordIssue);
      return;
    }
    setLoading(true);
    try {
      await passwordReset.submit(email, code, password);
      Alert.alert('Mot de passe modifié', 'Connectez-vous avec votre nouveau mot de passe.');
      router.dismissTo(`/(auth)/login?email=${encodeURIComponent(email.trim().toLowerCase())}&passwordReset=${Date.now()}` as Href);
    } catch (error) {
      Alert.alert('Erreur', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <Text style={styles.title}>Mot de passe oublié</Text>
            <Text style={styles.subtitle}>
              {step === 'email'
                ? 'Saisissez votre adresse e-mail pour recevoir un code de réinitialisation.'
                : `Si un compte existe pour ${email.trim().toLowerCase()}, un code vient d’être envoyé. Vérifiez aussi vos courriers indésirables.`}
            </Text>
          </View>

          {step === 'email' ? (
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
                  returnKeyType="send"
                  editable={!loading}
                  onSubmitEditing={sendCode}
                />
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.disabled]}
                onPress={sendCode}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.textPrimary} />
                  : <Text style={styles.primaryBtnText}>Envoyer le code</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.form}>
              <View style={styles.inputRow}>
                <Ionicons name="keypad-outline" size={20} color={COLORS.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Code reçu par e-mail"
                  placeholderTextColor={COLORS.textMuted}
                  value={code}
                  onChangeText={value => setCode(value.replace(/\D/g, ''))}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={10}
                  editable={!loading}
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                />
              </View>

              <SrmPasswordField
                inputRef={passwordInputRef}
                value={password}
                onChangeText={setPassword}
                placeholder="Nouveau mot de passe"
                autoComplete="new-password"
                editable={!loading}
                returnKeyType="next"
                onSubmitEditing={() => confirmationInputRef.current?.focus()}
              />
              <SrmPasswordField
                inputRef={confirmationInputRef}
                value={confirmation}
                onChangeText={setConfirmation}
                placeholder="Confirmer le mot de passe"
                autoComplete="new-password"
                editable={!loading}
                onSubmitEditing={resetPassword}
              />

              <TouchableOpacity
                style={[styles.primaryBtn, busy && styles.disabled]}
                onPress={resetPassword}
                disabled={busy}
                activeOpacity={0.85}
              >
                {loading
                  ? <ActivityIndicator color={COLORS.textPrimary} />
                  : <Text style={styles.primaryBtnText}>Modifier le mot de passe</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.linkBtn}
                onPress={resendCode}
                disabled={busy || cooldown > 0}
              >
                <Text style={[styles.linkText, (resending || cooldown > 0) && styles.linkTextMuted]}>
                  {resending
                    ? 'Envoi en cours…'
                    : cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : 'Renvoyer le code'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.linkBtn} onPress={() => setStep('email')} disabled={busy}>
                <Text style={styles.linkText}>Changer d’adresse e-mail</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity style={styles.linkBtn} onPress={() => router.back()} disabled={busy}>
            <Text style={styles.linkText}>Retour à la connexion</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.surface,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.xxl,
  },
  title: {
    ...TYPOGRAPHY.display,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    ...TYPOGRAPHY.body,
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
  primaryBtnText: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  disabled: {
    opacity: 0.7,
  },
  linkBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  linkText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  linkTextMuted: {
    color: COLORS.textMuted,
  },
});
