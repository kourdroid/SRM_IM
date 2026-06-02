import {
  SrmActionButton,
  SrmEmptyState,
  SrmIconButton,
  SrmMetricStrip,
  SrmScreenHeader,
  SrmSearchField,
  SrmStatusBadge,
} from '@/components/ui/srm';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import {
  AdminCommune,
  CommuneAdminService,
} from '@/src/core/services/communeAdminService';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function CommuneManagement() {
  const [communes, setCommunes] = useState<AdminCommune[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingCommune, setEditingCommune] = useState<AdminCommune | null>(null);
  const [communeName, setCommuneName] = useState('');

  useEffect(() => {
    void loadCommunes();
  }, []);

  const filteredCommunes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return communes;
    return communes.filter(item => item.name.toLowerCase().includes(normalized));
  }, [communes, query]);

  const usedCommunes = communes.filter(item => item.incident_count > 0).length;
  const unusedCommunes = communes.length - usedCommunes;

  const loadCommunes = async () => {
    try {
      const data = await CommuneAdminService.getCommunes();
      setCommunes(data);
    } catch (error) {
      Alert.alert('Erreur', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingCommune(null);
    setCommuneName('');
    setModalVisible(true);
  };

  const openEditModal = (commune: AdminCommune) => {
    setEditingCommune(commune);
    setCommuneName(commune.name);
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditingCommune(null);
    setCommuneName('');
  };

  const handleSave = async () => {
    if (!communeName.trim()) {
      Alert.alert('Champ requis', 'Veuillez saisir le nom de la commune.');
      return;
    }

    setSaving(true);
    try {
      const saved = editingCommune
        ? await CommuneAdminService.updateCommune(editingCommune.id, communeName)
        : await CommuneAdminService.createCommune(communeName);

      setCommunes(prev => {
        if (editingCommune) {
          return prev
            .map(item => item.id === saved.id ? saved : item)
            .sort((a, b) => a.name.localeCompare(b.name));
        }
        return [saved, ...prev].sort((a, b) => a.name.localeCompare(b.name));
      });

      closeModal();
    } catch (error) {
      Alert.alert('Erreur', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (commune: AdminCommune) => {
    if (commune.incident_count > 0) {
      Alert.alert(
        'Suppression bloquée',
        `${commune.name} est liée à ${commune.incident_count} incident(s). Elle doit rester disponible pour les rapports.`
      );
      return;
    }

    Alert.alert(
      'Supprimer la commune',
      `Supprimer définitivement ${commune.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await CommuneAdminService.deleteCommune(commune.id);
              setCommunes(prev => prev.filter(item => item.id !== commune.id));
            } catch (error) {
              Alert.alert('Erreur', getErrorMessage(error));
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const renderCommune = ({ item }: { item: AdminCommune }) => {
    const isUsed = item.incident_count > 0;

    return (
      <View style={styles.communeRow}>
        <View style={styles.communeIcon}>
          <Ionicons name="location-outline" size={20} color={COLORS.textPrimary} />
        </View>

        <View style={styles.communeBody}>
          <Text style={styles.communeName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.communeMeta}>
            {item.incident_count} incident{item.incident_count > 1 ? 's' : ''} lié{item.incident_count > 1 ? 's' : ''}
          </Text>
        </View>

        <SrmStatusBadge label={isUsed ? 'UTILISÉE' : 'LIBRE'} variant={isUsed ? 'success' : 'neutral'} />

        <SrmIconButton icon="create-outline" onPress={() => openEditModal(item)} />

        <SrmIconButton
          icon="trash-outline"
          color={isUsed ? COLORS.textMuted : COLORS.signalRed}
          onPress={() => handleDelete(item)}
          disabled={isUsed}
        />
      </View>
    );
  };

  if (loading && communes.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.textPrimary} />
        <Text style={styles.loadingText}>Chargement des communes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SrmScreenHeader
        kicker="RÉFÉRENTIEL"
        title="Communes"
        subtitle="Utilisé par les incidents et rapports"
        rightSlot={
          <SrmActionButton
            label="Ajouter"
            icon="add"
            onPress={openCreateModal}
            style={styles.headerButton}
          />
        }
      />

      <SrmMetricStrip
        items={[
          { label: 'TOTAL', value: communes.length },
          { label: 'AVEC INCIDENTS', value: usedCommunes },
          { label: 'SUPPRIMABLES', value: unusedCommunes },
        ]}
      />

      <SrmSearchField
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder="Rechercher une commune"
        autoCapitalize="words"
        style={styles.search}
      />

      <FlatList
        data={filteredCommunes}
        keyExtractor={item => item.id}
        renderItem={renderCommune}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadCommunes}
        ListEmptyComponent={
          <SrmEmptyState
            icon="map-outline"
            title="Aucune commune trouvée"
            message="Ajoutez les communes de la zone avant les rapports terrain."
          />
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingCommune ? 'Modifier la commune' : 'Ajouter une commune'}
              </Text>
              <TouchableOpacity onPress={closeModal} disabled={saving}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>Nom de la commune</Text>
              <TextInput
                value={communeName}
                onChangeText={setCommuneName}
                placeholder="Ex. Sidi Bennour"
                placeholderTextColor={COLORS.textMuted}
                style={styles.textInput}
                editable={!saving}
                autoCapitalize="words"
              />
              {editingCommune && editingCommune.incident_count > 0 && (
                <View style={styles.warningBox}>
                  <Ionicons name="information-circle-outline" size={20} color={COLORS.signalBlue} />
                  <Text style={styles.warningText}>
                    Le renommage conserve les incidents existants liés à cette commune.
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal} disabled={saving}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={COLORS.textPrimary} size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={18} color={COLORS.textPrimary} />
                    <Text style={styles.confirmText}>Enregistrer</Text>
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

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerButton: {
    width: 108,
    height: 42,
  },
  search: {
    margin: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 28,
  },
  communeRow: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  communeIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  communeBody: {
    flex: 1,
    minWidth: 0,
  },
  communeName: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
  },
  communeMeta: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    padding: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textPrimary,
  },
  modalForm: {
    padding: SPACING.xl,
  },
  inputLabel: {
    ...TYPOGRAPHY.labelUppercase,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  textInput: {
    height: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  warningBox: {
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: COLORS.signalBlueTint,
    padding: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  warningText: {
    ...TYPOGRAPHY.label,
    flex: 1,
    color: '#1D4ED8',
  },
  modalFooter: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textSecondary,
  },
  confirmButton: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  confirmText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textPrimary,
  },
});
