import { UserAdminService, type UserProfile } from '@/src/core/services/userAdminService';
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
  Switch,
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

export default function UserManagement() {
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Create user modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<'field' | 'admin'>('field');
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

  const toggleRole = async (profile: UserProfile, value: boolean) => {
    const newRole = value ? 'admin' : 'field';
    try {
      await UserAdminService.updateUserRole({ id: profile.id, role: newRole });
      setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, role: newRole } : p));
      Alert.alert('Succès', `Rôle de ${profile.name || 'l\'utilisateur'} mis à jour à: ${newRole}`);
    } catch (e: any) {
      if (e.message?.includes('NETWORK_OFFLINE')) {
        Alert.alert('Hors ligne', 'Les mutations administrateur requièrent une connexion active.');
      } else {
        Alert.alert('Erreur de mise à jour', String(e));
      }
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
    } catch (e: any) {
      Alert.alert('Erreur lors de la création', e.message || String(e));
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
    const isAdmin = item.role === 'admin';

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

        {/* Role Switch */}
        <View style={styles.roleToggleSection}>
          <Text style={[styles.roleLabel, isAdmin && styles.roleLabelActive]}>
            {isAdmin ? 'ADMIN' : 'TERRAIN'}
          </Text>
          <Switch
            value={isAdmin}
            onValueChange={(val) => toggleRole(item, val)}
            trackColor={{ false: '#D1D5DB', true: COLORS.primaryDark }}
            thumbColor={COLORS.white}
          />
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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Gestion d'Équipe</Text>
          <Text style={styles.headerSubtitle}>
            {profiles.length} membre{profiles.length > 1 ? 's' : ''} actif{profiles.length > 1 ? 's' : ''}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={20} color={COLORS.primaryDark} />
          <Text style={styles.addButtonText}>Nouveau</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={profiles}
        keyExtractor={p => p.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>Aucun utilisateur enregistré</Text>
          </View>
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

              {/* Role toggle */}
              <Text style={styles.inputLabel}>Rôle de l'utilisateur</Text>
              <View style={styles.roleSelectContainer}>
                <TouchableOpacity
                  style={[
                    styles.roleOptionBtn,
                    newRole === 'field' && styles.roleOptionBtnActive
                  ]}
                  onPress={() => setNewRole('field')}
                  disabled={creating}
                >
                  <Ionicons
                    name="construct"
                    size={18}
                    color={newRole === 'field' ? COLORS.primaryDark : COLORS.textSecondary}
                  />
                  <Text style={[
                    styles.roleOptionText,
                    newRole === 'field' && styles.roleOptionTextActive
                  ]}>
                    Agent Terrain
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleOptionBtn,
                    newRole === 'admin' && styles.roleOptionBtnActive
                  ]}
                  onPress={() => setNewRole('admin')}
                  disabled={creating}
                >
                  <Ionicons
                    name="shield-checkmark"
                    size={18}
                    color={newRole === 'admin' ? COLORS.primaryDark : COLORS.textSecondary}
                  />
                  <Text style={[
                    styles.roleOptionText,
                    newRole === 'admin' && styles.roleOptionTextActive
                  ]}>
                    Administrateur
                  </Text>
                </TouchableOpacity>
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
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
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
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },

  roleOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 10,
  },

  roleOptionBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },

  roleOptionText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  roleOptionTextActive: {
    color: COLORS.primaryDark,
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
