import {
  SrmActionButton,
  SrmEmptyState,
  SrmIconButton,
  SrmListSkeleton,
  SrmMetricStrip,
  SrmScreenHeader,
  SrmSearchField,
  SrmStatusBadge,
} from '@/components/ui/srm';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import {
  IncidentTypeAdminService,
  type AdminIncidentTypeOption,
  type NetworkType,
} from '@/src/core/services/referenceAdminService';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
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

export default function IncidentTypeOptionsScreen() {
  const [options, setOptions] = useState<AdminIncidentTypeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingOption, setEditingOption] = useState<AdminIncidentTypeOption | null>(null);
  const [networkType, setNetworkType] = useState<NetworkType>('BT');
  const [name, setName] = useState('');
  const [sortOrder, setSortOrder] = useState('0');

  useEffect(() => {
    void loadOptions();
  }, []);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter(item =>
      item.name.toLowerCase().includes(normalized) ||
      item.network_type.toLowerCase().includes(normalized)
    );
  }, [options, query]);

  const activeCount = options.filter(item => item.active).length;
  const usedCount = options.filter(item => item.incident_count > 0).length;

  const loadOptions = async () => {
    try {
      const data = await IncidentTypeAdminService.getOptions();
      setOptions(data);
    } catch (error) {
      Alert.alert('Erreur', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingOption(null);
    setNetworkType('BT');
    setName('');
    setSortOrder('0');
    setModalVisible(true);
  };

  const openEditModal = (option: AdminIncidentTypeOption) => {
    setEditingOption(option);
    setNetworkType(option.network_type);
    setName(option.name);
    setSortOrder(String(option.sort_order));
    setModalVisible(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalVisible(false);
    setEditingOption(null);
    setName('');
  };

  const handleSave = async () => {
    const nextSortOrder = Number.parseInt(sortOrder, 10);
    if (!name.trim()) {
      Alert.alert('Champ requis', "Veuillez saisir le type d'incident.");
      return;
    }
    if (!Number.isFinite(nextSortOrder) || nextSortOrder < 0) {
      Alert.alert('Ordre invalide', 'Utilisez un nombre positif pour l’ordre.');
      return;
    }

    setSaving(true);
    try {
      const saved = editingOption
        ? await IncidentTypeAdminService.updateOption({
          id: editingOption.id,
          network_type: editingOption.incident_count > 0 ? editingOption.network_type : networkType,
          name: editingOption.incident_count > 0 ? editingOption.name : name,
          active: editingOption.active,
          sort_order: nextSortOrder,
        })
        : await IncidentTypeAdminService.createOption(networkType, name);

      setOptions(prev => {
        const next = editingOption
          ? prev.map(item => item.id === saved.id ? saved : item)
          : [...prev, saved];
        return sortOptions(next);
      });
      closeModal();
    } catch (error) {
      Alert.alert('Erreur', getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (option: AdminIncidentTypeOption) => {
    try {
      setLoading(true);
      const saved = await IncidentTypeAdminService.updateOption({
        id: option.id,
        network_type: option.network_type,
        name: option.name,
        active: !option.active,
        sort_order: option.sort_order,
      });
      setOptions(prev => sortOptions(prev.map(item => item.id === saved.id ? saved : item)));
    } catch (error) {
      Alert.alert('Erreur', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (option: AdminIncidentTypeOption) => {
    if (option.incident_count > 0) {
      Alert.alert(
        'Suppression bloquée',
        `${option.name} est lié à ${option.incident_count} incident(s). Désactivez-le pour les nouveaux incidents.`
      );
      return;
    }

    Alert.alert(
      "Supprimer le type d'incident",
      `Supprimer définitivement ${option.name} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              await IncidentTypeAdminService.deleteOption(option.id);
              setOptions(prev => prev.filter(item => item.id !== option.id));
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

  const renderOption = ({ item }: { item: AdminIncidentTypeOption }) => {
    const used = item.incident_count > 0;
    return (
      <View style={styles.row}>
        <View style={[styles.networkBadge, { backgroundColor: item.network_type === 'BT' ? '#EFF6FF' : '#FFF7ED' }]}>
          <Text style={[styles.networkText, { color: item.network_type === 'BT' ? '#2563EB' : '#EA580C' }]}>
            {item.network_type}
          </Text>
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowTitle} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.rowMeta}>
            Ordre {item.sort_order} · {item.incident_count} incident{item.incident_count > 1 ? 's' : ''}
          </Text>
        </View>
        <SrmStatusBadge label={item.active ? 'ACTIF' : 'INACTIF'} variant={item.active ? 'success' : 'neutral'} />
        <SrmIconButton icon="create-outline" onPress={() => openEditModal(item)} />
        <SrmIconButton
          icon={item.active ? 'pause-outline' : 'play-outline'}
          color={item.active ? COLORS.signalOrange : COLORS.signalGreen}
          onPress={() => toggleActive(item)}
        />
        <SrmIconButton
          icon="trash-outline"
          color={used ? COLORS.textMuted : COLORS.signalRed}
          onPress={() => handleDelete(item)}
          disabled={used}
        />
      </View>
    );
  };

  if (loading && options.length === 0) {
    return (
      <View style={styles.screen}>
        <SrmScreenHeader kicker="RÉFÉRENTIEL TERRAIN" title="Types d'incidents" subtitle="BT et MT" />
        <SrmMetricStrip items={[{ label: 'TOTAL', value: '-' }, { label: 'ACTIFS', value: '-' }, { label: 'UTILISÉS', value: '-' }]} />
        <SrmListSkeleton count={6} style={styles.skeletonList} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <SrmScreenHeader
        kicker="RÉFÉRENTIEL TERRAIN"
        title="Types d'incidents"
        subtitle="Disponibles dans le formulaire terrain après synchronisation"
        rightSlot={<SrmActionButton label="Ajouter" icon="add" onPress={openCreateModal} style={styles.headerButton} />}
      />

      <SrmMetricStrip items={[
        { label: 'TOTAL', value: options.length },
        { label: 'ACTIFS', value: activeCount },
        { label: 'UTILISÉS', value: usedCount },
      ]} />

      <SrmSearchField
        value={query}
        onChangeText={setQuery}
        onClear={() => setQuery('')}
        placeholder="Rechercher un type"
        style={styles.search}
      />

      <FlatList
        data={filteredOptions}
        keyExtractor={item => item.id}
        renderItem={renderOption}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshing={loading}
        onRefresh={loadOptions}
        ListEmptyComponent={
          <SrmEmptyState
            icon="list-outline"
            title="Aucun type trouvé"
            message="Ajoutez les types BT et MT utilisés par le terrain."
          />
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingOption ? 'Modifier le type' : "Ajouter un type d'incident"}</Text>
              <TouchableOpacity onPress={closeModal} disabled={saving}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>Réseau</Text>
              <View style={[styles.pickerWrap, editingOption?.incident_count ? styles.disabledInput : null]}>
                <Picker
                  selectedValue={networkType}
                  enabled={!saving && !editingOption?.incident_count}
                  onValueChange={(value) => setNetworkType(value as NetworkType)}
                  style={styles.picker}
                  dropdownIconColor={COLORS.textPrimary}
                >
                  <Picker.Item label="BT - Basse tension" value="BT" />
                  <Picker.Item label="MT - Moyenne tension" value="MT" />
                </Picker>
              </View>

              <Text style={styles.inputLabel}>Nom</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ex. Manque phase"
                placeholderTextColor={COLORS.textMuted}
                style={[styles.textInput, editingOption?.incident_count ? styles.disabledInput : null]}
                editable={!saving && !editingOption?.incident_count}
              />

              <Text style={styles.inputLabel}>Ordre</Text>
              <TextInput
                value={sortOrder}
                onChangeText={setSortOrder}
                placeholder="0"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="number-pad"
                style={styles.textInput}
                editable={!saving}
              />

              {editingOption?.incident_count ? (
                <View style={styles.warningBox}>
                  <Ionicons name="information-circle-outline" size={20} color={COLORS.signalBlue} />
                  <Text style={styles.warningText}>
                    Ce type est utilisé par des incidents. Vous pouvez changer l’ordre ou l’état, pas le nom ni le réseau.
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelButton} onPress={closeModal} disabled={saving}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmButton} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.textPrimary} size="small" /> : (
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

function sortOptions(options: AdminIncidentTypeOption[]): AdminIncidentTypeOption[] {
  return [...options].sort((a, b) =>
    a.network_type.localeCompare(b.network_type) ||
    a.sort_order - b.sort_order ||
    a.name.localeCompare(b.name)
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  headerButton: { width: 108, height: 42 },
  search: { margin: SPACING.lg, marginBottom: SPACING.sm },
  listContent: { paddingHorizontal: SPACING.lg, paddingBottom: 28 },
  row: {
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
  networkBadge: {
    width: 42,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  networkText: { ...TYPOGRAPHY.title, fontWeight: '900' },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { ...TYPOGRAPHY.title, color: COLORS.textPrimary },
  rowMeta: { ...TYPOGRAPHY.label, color: COLORS.textSecondary, marginTop: 2 },
  skeletonList: { paddingTop: SPACING.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
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
  modalTitle: { ...TYPOGRAPHY.heading, color: COLORS.textPrimary },
  modalForm: { padding: SPACING.xl, gap: SPACING.sm },
  inputLabel: { ...TYPOGRAPHY.labelUppercase, color: COLORS.textSecondary },
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
    marginBottom: SPACING.sm,
  },
  pickerWrap: {
    height: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    overflow: 'hidden',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  picker: { color: COLORS.textPrimary },
  disabledInput: { opacity: 0.65 },
  warningBox: {
    marginTop: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: COLORS.signalBlueTint,
    padding: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  warningText: { ...TYPOGRAPHY.label, flex: 1, color: '#1D4ED8' },
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
  cancelText: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
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
  confirmText: { ...TYPOGRAPHY.bodyBold, color: COLORS.textPrimary },
});
