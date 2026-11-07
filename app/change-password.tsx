import { SrmActionButton, SrmPasswordField, SrmScreenHeader } from '@/components/ui/srm';
import { useAuth } from '@/contexts/AuthContext';
import { COLORS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { PasswordService, validateNewPassword } from '@/src/core/services/passwordService';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ChangePassword() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [saving, setSaving] = useState(false);
  const newPasswordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);

  async function handleSave() {
    if (!user?.email) {
      Alert.alert('Erreur', 'Session introuvable. Reconnectez-vous puis réessayez.');
      return;
    }
    if (!currentPassword) {
      Alert.alert('Champ requis', 'Veuillez saisir votre mot de passe actuel.');
      return;
    }
    const issue = validateNewPassword(newPassword, confirmation);
    if (issue) {
      Alert.alert('Mot de passe invalide', issue);
      return;
    }

    setSaving(true);
    try {
      await PasswordService.changePassword(user.email, currentPassword, newPassword);
      Alert.alert('Mot de passe modifié', 'Votre nouveau mot de passe est actif.');
      router.back();
    } catch (error) {
      Alert.alert('Erreur', error instanceof Error ? error.message : 'Une erreur inconnue est survenue.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.screen}>
      <SrmScreenHeader
        kicker="SÉCURITÉ"
        title="Mot de passe"
        subtitle={user?.email ?? undefined}
        rightSlot={
          <SrmActionButton
            label="Retour"
            icon="arrow-back"
            variant="secondary"
            onPress={() => router.back()}
            disabled={saving}
            style={styles.backButton}
          />
        }
      />

      <SafeAreaView style={styles.body} edges={['bottom']}>
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.label}>Mot de passe actuel</Text>
            <SrmPasswordField
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Mot de passe actuel"
              autoComplete="current-password"
              editable={!saving}
              returnKeyType="next"
              onSubmitEditing={() => newPasswordRef.current?.focus()}
            />

            <Text style={styles.label}>Nouveau mot de passe</Text>
            <SrmPasswordField
              inputRef={newPasswordRef}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Au moins 6 caractères"
              autoComplete="new-password"
              editable={!saving}
              returnKeyType="next"
              onSubmitEditing={() => confirmationRef.current?.focus()}
            />

            <Text style={styles.label}>Confirmation</Text>
            <SrmPasswordField
              inputRef={confirmationRef}
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder="Confirmer le nouveau mot de passe"
              autoComplete="new-password"
              editable={!saving}
              onSubmitEditing={handleSave}
            />

            <SrmActionButton
              label="Enregistrer"
              icon="checkmark"
              loading={saving}
              disabled={saving}
              onPress={handleSave}
              style={styles.saveButton}
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  backButton: { width: 104, height: 42 },
  body: { flex: 1 },
  content: { padding: SPACING.xl, gap: SPACING.sm },
  label: { ...TYPOGRAPHY.labelUppercase, color: COLORS.textSecondary, marginTop: SPACING.sm },
  saveButton: { marginTop: SPACING.xl, height: 52 },
});
