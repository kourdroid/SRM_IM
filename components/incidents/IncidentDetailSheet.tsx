import AdminIncidentEditModal, { type IncidentEditPatch } from '@/components/AdminIncidentEditModal';
import ClosureMaterialsForm from '@/components/incidents/ClosureMaterialsForm';
import { IncidentPhotoStrip } from '@/components/incidents/IncidentPhotos';
import type { MaterialUsageChoice } from '@/components/MaterialUsageSelector';
import { SrmBottomSheet } from '@/components/ui/srm';
import { useAuth } from '@/contexts/AuthContext';
import {
  NO_MATERIAL_USED_LABEL,
  buildEquipmentSummary,
  createEmptyMaterialFormRow,
  formatQuantity,
  normalizeMaterialRows,
  type MaterialFormRow,
} from '@/lib/materials';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { IncidentAdminService, type Incident } from '@/src/core/services/incidentAdminService';
import { formatDurationBetween } from '@/src/core/utils/duration';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  incident: Incident | null;
  onClose: () => void;
  onUpdated: (id: string, patch: Partial<Incident>) => void;
  onArchived: (id: string) => void;
}

function showMutationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('NETWORK_OFFLINE')) {
    Alert.alert('Action Hors Ligne Bloquée', 'Les mutations administrateur requièrent une connexion internet active.');
  } else {
    Alert.alert('Erreur', message);
  }
}

function DetailRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
      {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
    </View>
  );
}

export default function IncidentDetailSheet({ incident, onClose, onUpdated, onArchived }: Props) {
  const { isAdmin } = useAuth();
  const [editing, setEditing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [showClosureMaterials, setShowClosureMaterials] = useState(false);
  const [materialUsage, setMaterialUsage] = useState<MaterialUsageChoice>(null);
  const [materialRows, setMaterialRows] = useState<MaterialFormRow[]>([createEmptyMaterialFormRow()]);
  const incidentId = incident?.id;
  const busy = isClosing || isArchiving;

  useEffect(() => {
    setShowClosureMaterials(false);
    setMaterialUsage(null);
    setMaterialRows([createEmptyMaterialFormRow()]);
  }, [incidentId]);

  const handleToggleStatus = async (item: Incident) => {
    if (!isAdmin || isClosing) return;
    const newStatus = item.status === 'open' ? 'closed' : 'open';
    const existingMaterials = item.materials || [];
    const needsDeclaration = item.status === 'open' && existingMaterials.length === 0;
    const noMaterialUsed = needsDeclaration && materialUsage === 'none';
    const normalizedMaterials = noMaterialUsed ? [] : normalizeMaterialRows(materialRows);

    if (needsDeclaration && !showClosureMaterials) {
      setShowClosureMaterials(true);
      return;
    }
    if (needsDeclaration && materialUsage === null) {
      Alert.alert('Matériel utilisé', 'Choisissez avec matériel ou aucun matériel utilisé.');
      return;
    }
    if (item.status === 'open' && normalizedMaterials === null) {
      Alert.alert('Matériel invalide', 'Chaque ligne de matériel doit avoir un nom et une quantité positive.');
      return;
    }
    if (needsDeclaration && !noMaterialUsed && (normalizedMaterials?.length ?? 0) === 0) {
      Alert.alert('Matériel requis', "Ajoutez au moins un matériel utilisé pour clôturer l'incident.");
      return;
    }
    const closureMaterials = normalizedMaterials ?? [];

    try {
      setIsClosing(true);
      const materials = item.status === 'open' && closureMaterials.length > 0
        ? closureMaterials.map(material => ({ material_name: material.material_name, quantity: material.quantity }))
        : existingMaterials;
      let equipmentUsed = item.equipment_used;
      if (noMaterialUsed) equipmentUsed = NO_MATERIAL_USED_LABEL;
      else if (closureMaterials.length > 0) equipmentUsed = buildEquipmentSummary(closureMaterials);
      else if (item.status === 'closed' && item.no_material_used) equipmentUsed = '';

      if (item.status === 'open' && (closureMaterials.length > 0 || noMaterialUsed)) {
        await IncidentAdminService.closeIncidentWithMaterials({
          id: item.id,
          materials: closureMaterials,
          no_material_used: noMaterialUsed,
        });
      } else {
        await IncidentAdminService.updateIncidentStatus({ id: item.id, status: newStatus });
      }

      onUpdated(item.id, {
        status: newStatus,
        closed_at: newStatus === 'closed' ? new Date().toISOString() : undefined,
        no_material_used: noMaterialUsed,
        materials,
        equipment_used: equipmentUsed,
        materials_summary: equipmentUsed,
      });
      setShowClosureMaterials(false);
      setMaterialUsage(null);
      setMaterialRows([createEmptyMaterialFormRow()]);
      Alert.alert('Succès', `Incident ${newStatus === 'closed' ? 'clôturé' : 'rouvert'}.`);
    } catch (error) {
      showMutationError(error);
    } finally {
      setIsClosing(false);
    }
  };

  const handleArchive = (item: Incident) => {
    if (!isAdmin) return;
    Alert.alert(
      "Supprimer l'incident",
      "L'incident sera retiré des listes, des statistiques et des rapports. Son historique reste conservé.",
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsArchiving(true);
              await IncidentAdminService.archiveIncident(item.id);
              onArchived(item.id);
            } catch (error) {
              showMutationError(error);
            } finally {
              setIsArchiving(false);
            }
          },
        },
      ],
    );
  };

  const handleEdited = (id: string, patch: IncidentEditPatch) => {
    onUpdated(id, patch);
    Alert.alert('Succès', 'Incident modifié.');
  };

  const openMap = (item: Incident) => {
    if (item.latitude == null || item.longitude == null) return;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`);
  };

  const isOpen = incident?.status === 'open';
  const hasMaterials = Boolean(incident?.materials?.length);

  return (
    <>
      <SrmBottomSheet
        visible={incident !== null}
        onClose={onClose}
        minHeight="60%"
        header={incident ? (
          <View style={styles.header}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{incident.type}</Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>{incident.title || 'Fiche Incident'}</Text>
          </View>
        ) : null}
        headerActions={isAdmin && incident ? (
          <TouchableOpacity
            onPress={() => setEditing(true)}
            style={styles.editButton}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Modifier l'incident"
          >
            <Ionicons name="create-outline" size={19} color={COLORS.textPrimary} />
          </TouchableOpacity>
        ) : null}
        footer={isAdmin && incident ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.statusButton, { backgroundColor: isOpen ? COLORS.signalGreen : COLORS.signalRed }]}
              onPress={() => handleToggleStatus(incident)}
              disabled={busy}
            >
              {isClosing ? <ActivityIndicator size="small" color={COLORS.surface} /> : (
                <>
                  <Ionicons name={isOpen ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={20} color={COLORS.surface} />
                  <Text style={styles.statusButtonText}>
                    {!isOpen ? "Rouvrir l'incident" : showClosureMaterials ? 'Valider la clôture' : "Clôturer l'incident"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.archiveButton}
              onPress={() => handleArchive(incident)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Supprimer l'incident"
            >
              {isArchiving
                ? <ActivityIndicator size="small" color={COLORS.signalRed} />
                : <Ionicons name="trash-outline" size={18} color={COLORS.signalRed} />}
              <Text style={styles.archiveButtonText}>Supprimer l&apos;incident</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      >
        {incident ? (
          <>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: isOpen ? COLORS.signalRedTint : COLORS.signalGreenTint }]}>
                <Text style={[styles.statusBadgeText, { color: isOpen ? COLORS.signalRed : COLORS.signalGreen }]}>
                  {isOpen ? 'EN COURS' : 'CLÔTURÉ'}
                </Text>
              </View>
              <Text style={styles.date}>Rapporté le {new Date(incident.created_at).toLocaleString()}</Text>
            </View>

            <DetailRow label="Type d'incident" value={incident.incident_type} />
            {incident.type === 'MT' && incident.depart_hta ? <DetailRow label="Départ HTA" value={incident.depart_hta} /> : null}
            <DetailRow label="Commune" value={incident.commune_name ?? 'Non renseignée'} />
            <DetailRow label="Village / Quartier" value={incident.village} />

            {incident.latitude != null && incident.longitude != null ? (
              <TouchableOpacity onPress={() => openMap(incident)} accessibilityRole="link">
                <DetailRow
                  label="Position GPS"
                  value={`${incident.latitude.toFixed(6)}, ${incident.longitude.toFixed(6)}`}
                  hint="Ouvrir dans Google Maps"
                />
              </TouchableOpacity>
            ) : null}

            <DetailRow label="Rapporté par" value={incident.created_by_name || 'Agent Terrain'} />

            {incident.status === 'closed' ? (
              <>
                <DetailRow
                  label="Clôturé par"
                  value={incident.closed_by_name || 'Utilisateur inconnu'}
                  hint={incident.closed_at ? new Date(incident.closed_at).toLocaleString() : undefined}
                />
                <DetailRow
                  label="Durée de traitement"
                  value={formatDurationBetween(incident.created_at, incident.closed_at || new Date().toISOString())}
                />
              </>
            ) : (
              <DetailRow label="Ouvert depuis" value={formatDurationBetween(incident.created_at, new Date().toISOString())} />
            )}

            <View style={styles.row}>
              <Text style={styles.rowLabel}>Matériel utilisé</Text>
              {hasMaterials ? (
                <View style={styles.materials}>
                  {incident.materials?.map(material => (
                    <View key={`${material.material_name}-${material.quantity}`} style={styles.material}>
                      <Text style={styles.materialName}>{material.material_name}</Text>
                      <Text style={styles.materialQuantity}>x{formatQuantity(material.quantity)}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.rowValue}>{incident.equipment_used || 'Non renseigné'}</Text>
              )}
            </View>

            <View style={[styles.row, styles.lastRow]}>
              <Text style={styles.rowLabel}>Description</Text>
              <Text style={styles.description}>{incident.description || 'Aucune description fournie.'}</Text>
            </View>

            {incident.reclamation ? (
              <View style={styles.reclamation}>
                <Text style={styles.reclamationTitle}>Informations Réclamation</Text>
                <Text style={styles.reclamationItem}>
                  <Text style={styles.reclamationKey}>Nom du réclamant: </Text>
                  {incident.reclamation_name || 'Non spécifié'}
                </Text>
                <Text style={styles.reclamationItem}>
                  <Text style={styles.reclamationKey}>Déposée par: </Text>
                  {incident.reclamation_by || 'Non spécifié'}
                </Text>
              </View>
            ) : null}

            <IncidentPhotoStrip urls={incident.media_urls ?? []} />

            {isAdmin && isOpen && showClosureMaterials && !hasMaterials ? (
              <ClosureMaterialsForm
                usage={materialUsage}
                onUsageChange={setMaterialUsage}
                rows={materialRows}
                onRowsChange={setMaterialRows}
                disabled={isClosing}
              />
            ) : null}
          </>
        ) : null}
      </SrmBottomSheet>

      <AdminIncidentEditModal
        incident={editing ? incident : null}
        onClose={() => setEditing(false)}
        onSaved={handleEdited}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  typeBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  title: {
    ...TYPOGRAPHY.heading,
    flex: 1,
    color: COLORS.textPrimary,
  },
  editButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statusBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  date: {
    flexShrink: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
    textAlign: 'right',
  },
  row: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  rowValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  rowHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginTop: SPACING.xs,
  },
  materials: {
    gap: SPACING.sm,
  },
  material: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: SPACING.md,
  },
  materialName: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  materialQuantity: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '900',
  },
  description: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  reclamation: {
    backgroundColor: COLORS.signalOrangeTint,
    borderRadius: RADIUS.md,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginTop: SPACING.sm,
  },
  reclamationTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.signalOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  reclamationItem: {
    fontSize: 13,
    color: '#78350F',
    marginTop: SPACING.xs,
  },
  reclamationKey: {
    fontWeight: '700',
  },
  actions: {
    flex: 1,
    gap: 10,
  },
  statusButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
  },
  statusButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.surface,
  },
  archiveButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    gap: SPACING.sm,
  },
  archiveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.signalRed,
  },
});
