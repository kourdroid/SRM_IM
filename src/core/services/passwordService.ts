import {
  hasRemoteNetwork,
  supabase,
  supabaseAnonKey,
  supabaseFetch,
  supabaseUrl,
  toSupabaseUserMessage,
} from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const MIN_PASSWORD_LENGTH = 6;
const OFFLINE_MESSAGE = 'Connexion requise. Vérifiez Internet puis réessayez.';
const GENERIC_MESSAGE = 'L’opération a échoué. Réessayez dans quelques instants.';

// A client without storage leaves the device session and AuthContext untouched.
function createIsolatedAuthClient() {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    global: { fetch: supabaseFetch },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toPasswordError(error: unknown, invalidCredentialsMessage?: string): Error {
  const code = (error as { code?: string } | null)?.code;
  switch (code) {
    case 'invalid_credentials':
      return new Error(invalidCredentialsMessage ?? 'Identifiants incorrects.');
    case 'otp_expired':
      return new Error('Code incorrect ou expiré. Vérifiez le code ou demandez-en un nouveau.');
    case 'same_password':
      return new Error('Le nouveau mot de passe doit être différent de l’ancien.');
    case 'weak_password':
      return new Error('Ce mot de passe est trop faible. Choisissez-en un plus long ou plus complexe.');
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new Error('Trop de tentatives. Patientez quelques minutes puis réessayez.');
    case 'validation_failed':
    case 'email_address_invalid':
      return new Error('Vérifiez les informations saisies, notamment l’adresse e-mail.');
    case 'reauthentication_needed':
    case 'reauthentication_not_valid':
      return new Error('Par sécurité, déconnectez-vous puis reconnectez-vous avant de changer le mot de passe.');
    default: {
      const message = toSupabaseUserMessage(error);
      // An unchanged message is the raw English text from the server.
      if (error instanceof Error && message === error.message) {
        console.warn('Password operation failed:', code, error.message);
        return new Error(GENERIC_MESSAGE);
      }
      return new Error(message);
    }
  }
}

async function assertOnline(): Promise<void> {
  if (!(await hasRemoteNetwork())) throw new Error(OFFLINE_MESSAGE);
}

/** Returns a message to show the user, or null when the new password is acceptable. */
export function validateNewPassword(password: string, confirmation: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
  }
  if (password !== confirmation) {
    return 'Les deux mots de passe ne correspondent pas.';
  }
  return null;
}

/**
 * Holds one reset attempt in memory. Verifying consumes the code, so a rejected new password
 * must retry on the verified client. Nothing is stored, so quitting midway leaves no session.
 */
export function createPasswordReset() {
  let verified: { key: string; client: ReturnType<typeof createIsolatedAuthClient> } | null = null;

  return {
    async submit(email: string, code: string, newPassword: string): Promise<void> {
      await assertOnline();
      const normalizedEmail = normalizeEmail(email);
      const token = code.trim();
      const key = `${normalizedEmail}:${token}`;

      if (verified?.key !== key) {
        const client = createIsolatedAuthClient();
        const { error } = await client.auth.verifyOtp({ email: normalizedEmail, token, type: 'recovery' });
        if (error) throw toPasswordError(error);
        verified = { key, client };
      }

      const { client } = verified;
      const { error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw toPasswordError(error);

      verified = null;
      await client.auth.signOut({ scope: 'local' }).catch(() => undefined);
    },
  };
}

export const PasswordService = {
  async requestPasswordReset(email: string): Promise<void> {
    await assertOnline();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email));
    if (error) throw toPasswordError(error);
  },

  // The update runs on the main client so that this device keeps its session.
  async changePassword(email: string, currentPassword: string, newPassword: string): Promise<void> {
    await assertOnline();
    if (currentPassword === newPassword) {
      throw new Error('Le nouveau mot de passe doit être différent de l’ancien.');
    }

    const verifier = createIsolatedAuthClient();
    const { error: verifyError } = await verifier.auth.signInWithPassword({
      email: normalizeEmail(email),
      password: currentPassword,
    });
    if (verifyError) throw toPasswordError(verifyError, 'Le mot de passe actuel est incorrect.');
    await verifier.auth.signOut({ scope: 'local' }).catch(() => undefined);

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) throw toPasswordError(updateError);
  },
};
