import { SrmActionButton, SrmEmptyState, SrmScreenHeader, SrmStatusBadge } from '@/components/ui/srm';
import { UserAdminService, type UserProfile, type UserRole } from '@/src/core/services/userAdminService';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const COLORS = {
  primaryDark: '#111827',
  background: '#F3F4F6',
  accent: '#DAF22C',
  cardBg: '#FFFFFF',
  cardBorder: '#E5E7EB',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  statBlue: '#3B82F6',
  statRed: '#EF4444',
  statGreen: '#22C55E',
  white: '#FFFFFF',
} as const;

const ROLE_OPTIONS: {
  role: UserRole;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    role: 'field',
    label: 'Terrain',
    description: 'Crée et synchronise les incidents depuis le terrain.',
    icon: 'construct',
  },
  {
    role: 'director',
    label: 'Directeur',
    description: 'Consulte le tableau de bord et les incidents en lecture seule.',
    icon: 'eye',
  },
  {
    role: 'admin',
    label: 'Administrateur',
    description: 'Gère les incidents, utilisateurs, communes et paramètres.',
    icon: 'shield-checkmark',
  },
];

export default function UserManagement() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolePickerProfile, setRolePickerProfile] = useState<UserProfile | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);
  
  // Create user modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('field');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadProfiles(); }, []);

  const loadProfiles = async () => {
    try {
      const data = await UserAdminService.getProfiles();
      setProfiles(data);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setLoading(false);
    }
  };

  const updateRole = async (profile: UserProfile, nextRole: UserRole) => {
    if (profile.role === nextRole) return;
    setRoleUpdating(true);
    try {
      await UserAdminService.updateUserRole({ id: profile.id, role: nextRole });
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: nextRole } : p));
      setRolePickerProfile(null);
      Alert.alert('Succès', `Rôle de ${profile.name || 'l\'utilisateur'} mis à jour.`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes('NETWORK_OFFLINE')) {
        Alert.alert('Hors ligne', 'Les mutations administrateur requièrent une connexion active.');
      } else {
        Alert.alert('Erreur de mise à jour', message);
      }
    } finally {
      setRoleUpdating(false);
    }
  };

  const handleDeleteUser = (profile: UserProfile) => {
    Alert.alert(
      'Supprimer l\'utilisateur',
      `Êtes-vous sûr de vouloir supprimer définitivement le compte de ${profile.name || 'cet utilisateur'} ? Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await UserAdminService.deleteUser(profile.id);
              setProfiles(prev => prev.filter(p => p.id !== profile.id));
              Alert.alert('Succès', 'Utilisateur supprimé avec succès.');
            } catch (e) {
              Alert.alert('Erreur', String(e));
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleCreateUser = async () => {
    if (!newEmail.trim() || !newPassword.trim() || !newName.trim()) {
      Alert.alert('Erreur', 'Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Erreur', 'Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    setCreating(true);
    try {
      const createdUser = await UserAdminService.createUser(
        newEmail.trim().toLowerCase(),
        newPassword,
        newName.trim(),
        newRole
      );
      setProfiles(prev => [createdUser, ...prev]);
      setShowAddModal(false);
      // Reset form fields
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewRole('field');
      Alert.alert('Succès', `Compte créé avec succès pour ${newName}.`);
    } catch (e: unknown) {
      Alert.alert('Erreur lors de la création', e instanceof Error ? e.message : String(e));
    } finally {
      setCreating(false);
    }
  };

  const getInitials = (name: string | null): string => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
  };

  const getAvatarColor = (id: string): string => {
    const colors = ['#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#06B6D4'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const renderItem = ({ item }: { item: UserProfile }) => {
    return (
      <View style={styles.card}>
        {/* Avatar */}
        <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.id) }]}>
          <Text style={styles.avatarText}>{getInitials(item.name)}</Text>
        </View>

        {/* User Info */}
        <View style={styles.userInfo}>
          <Text style={styles.userName} numberOfLines={1}>
            {item.name || 'Utilisateur Anonyme'}
          </Text>
          <Text style={styles.userEmail} numberOfLines={1}>
            {item.email || 'Aucune adresse e-mail'}
          </Text>
        </View>

        {/* Role */}
        <View style={styles.roleToggleSection}>
          <SrmStatusBadge label={getRoleLabel(item.role)} variant={getRoleVariant(item.role)} />
          <TouchableOpacity
            style={styles.changeRoleButton}
            onPress={() => setRolePickerProfile(item)}
            activeOpacity={0.78}
          >
            <Ionicons name="swap-horizontal" size={14} color={COLORS.textSecondary} />
            <Text style={styles.changeRoleText}>Changer</Text>
          </TouchableOpacity>
        </View>

        {/* Delete action */}
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteUser(item)}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={20} color={COLORS.statRed} />
        </TouchableOpacity>
      </View>
    );
  };

  if (loading && profiles.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primaryDark} />
        <Text style={styles.loadingText}>Chargement des utilisateurs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SrmScreenHeader
        kicker="ADMINISTRATION"
        title="Utilisateurs"
        subtitle={`${profiles.length} membre${profiles.length > 1 ? 's' : ''} actif${profiles.length > 1 ? 's' : ''}`}
        rightSlot={
          <SrmActionButton
            label="Nouveau"
            icon="add"
            onPress={() => setShowAddModal(true)}
            style={styles.headerButton}
          />
        }
      />

      <FlatList
        data={profiles}
        keyExtractor={p => p.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <SrmEmptyState
            icon="people-outline"
            title="Aucun utilisateur enregistré"
            message="Créez un compte technicien pour commencer."
          />
        }
      />

      {/* Add User Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Créer un Compte Membre</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} disabled={creating}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              {/* Full name input */}
              <Text style={styles.inputLabel}>Nom Complet *</Text>
              <TextInput
                placeholder="Ex. Ahmed Alami"
                value={newName}
                onChangeText={newName => setNewName(newName)}
                style={styles.textInput}
                placeholderTextColor={COLORS.textMuted}
                editable={!creating}
              />

              {/* Email input */}
              <Text style={styles.inputLabel}>Adresse E-mail *</Text>
              <TextInput
                placeholder="Ex. a.alami@onee.ma"
                value={newEmail}
                onChangeText={newEmail => setNewEmail(newEmail)}
                style={styles.textInput}
                placeholderTextColor={COLORS.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!creating}
              />

              {/* Password input */}
              <Text style={styles.inputLabel}>Mot de passe (Min 6 car.) *</Text>
              <TextInput
                placeholder="Entrez le mot de passe temporaire"
                value={newPassword}
                onChangeText={newPassword => setNewPassword(newPassword)}
                style={styles.textInput}
                placeholderTextColor={COLORS.textMuted}
                secureTextEntry
                editable={!creating}
              />

              {/* Role selector */}
              <Text style={styles.inputLabel}>Rôle de l&apos;utilisateur</Text>
              <View style={styles.roleSelectContainer}>
                {ROLE_OPTIONS.map(option => (
                  <RoleOption
                    key={option.role}
                    role={option.role}
                    activeRole={newRole}
                    label={option.label}
                    description={option.description}
                    icon={option.icon}
                    disabled={creating}
                    onPress={setNewRole}
                  />
                ))}
              </View>

              <View style={{ height: 24 }} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowAddModal(false)}
                disabled={creating}
              >
                <Text style={styles.cancelBtnText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleCreateUser}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color={COLORS.primaryDark} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color={COLORS.primaryDark} />
                    <Text style={styles.confirmBtnText}>Créer</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={rolePickerProfile !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => !roleUpdating && setRolePickerProfile(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.roleSheet}>
            <View style={styles.modalHeader}>
              <View style={styles.roleSheetTitleBlock}>
                <Text style={styles.modalTitle}>Changer le rôle</Text>
                <Text style={styles.roleSheetSubtitle} numberOfLines={1}>
                  {rolePickerProfile?.name || rolePickerProfile?.email || 'Utilisateur'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setRolePickerProfile(null)}
                disabled={roleUpdating}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.roleSheetBody}>
              {rolePickerProfile ? ROLE_OPTIONS.map(option => (
                <RoleOption
                  key={option.role}
                  role={option.role}
                  activeRole={rolePickerProfile.role}
                  label={option.label}
                  description={option.description}
                  icon={option.icon}
                  disabled={roleUpdating}
                  onPress={role => updateRole(rolePickerProfile, role)}
                />
              )) : null}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function RoleOption({
  role,
  activeRole,
  label,
  description,
  icon,
  disabled,
  onPress,
}: {
  role: UserRole;
  activeRole: UserRole;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled: boolean;
  onPress: (role: UserRole) => void;
}) {
  const active = role === activeRole;
  return (
    <TouchableOpacity
      style={[styles.roleOptionBtn, active && styles.roleOptionBtnActive]}
      onPress={() => onPress(role)}
      disabled={disabled}
      activeOpacity={0.78}
    >
      <View style={[styles.roleOptionIcon, active && styles.roleOptionIconActive]}>
        <Ionicons
          name={icon}
          size={19}
          color={active ? COLORS.primaryDark : COLORS.textSecondary}
        />
      </View>
      <View style={styles.roleOptionCopy}>
        <Text style={[styles.roleOptionText, active && styles.roleOptionTextActive]}>
          {label}
        </Text>
        <Text style={styles.roleOptionDescription}>{description}</Text>
      </View>
      {active ? (
        <Ionicons name="checkmark-circle" size={22} color={COLORS.primaryDark} />
      ) : (
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      )}
    </TouchableOpacity>
  );
}

function getRoleLabel(role: UserRole): string {
  if (role === 'admin') return 'ADMIN';
  if (role === 'director') return 'DIRECTEUR';
  return 'TERRAIN';
}

function getRoleVariant(role: UserRole): 'neutral' | 'info' {
  return role === 'field' ? 'neutral' : 'info';
}

// ─── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerButton: {
    width: 112,
    height: 42,
  },

  // ── Header ──
  header: {
    backgroundColor: COLORS.primaryDark,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },

  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },

  addButton: {
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },

  addButtonText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },

  // ── List ──
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },

  // ── Card ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },

  // ── Avatar ──
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
  },

  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: 0.5,
  },

  // ── User Info ──
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },

  userName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  userEmail: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // ── Role Toggle Section ──
  roleToggleSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    gap: 6,
  },

  roleLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  roleLabelActive: {
    color: COLORS.primaryDark,
  },

  changeRoleButton: {
    height: 28,
    borderRadius: 8,
    paddingHorizontal: 9,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  changeRoleText: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
  },

  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },

  // ── Loading ──
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  // ── Empty ──
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 12,
  },

  // ── Add Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },

  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalForm: {
    padding: 20,
  },

  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 12,
  },

  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 8,
  },

  roleSelectContainer: {
    gap: 10,
    marginTop: 4,
  },

  roleOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 12,
    borderRadius: 10,
  },

  roleOptionBtnActive: {
    backgroundColor: '#F7FEE7',
    borderColor: COLORS.accent,
  },

  roleOptionIcon: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  roleOptionIconActive: {
    backgroundColor: COLORS.accent,
  },

  roleOptionCopy: {
    flex: 1,
    minWidth: 0,
  },

  roleOptionText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  roleOptionTextActive: {
    color: COLORS.primaryDark,
  },

  roleOptionDescription: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginTop: 2,
  },

  roleSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },

  roleSheetTitleBlock: {
    flex: 1,
    minWidth: 0,
  },

  roleSheetSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 3,
  },

  roleSheetBody: {
    padding: 20,
    gap: 10,
  },

  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 20,
    gap: 12,
  },

  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
  },

  cancelBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  confirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    flexDirection: 'row',
    gap: 6,
  },

  confirmBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },
});
