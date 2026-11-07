import { loadClosureDraft, saveClosureDraft } from '@/db/incidentDrafts';
import ClosureMaterialsForm from '@/components/incidents/ClosureMaterialsForm';
import { IncidentPhotoStrip } from '@/components/incidents/IncidentPhotos';
import type { MaterialUsageChoice } from '@/components/MaterialUsageSelector';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { getIncidentMaterialsByLocalId, insertIncidentMaterials, type IncidentMaterialRow } from '../../db/incidentMaterials';
import { enqueueStatusUpdate, enqueueSyncMaterials } from '../../db/syncOperations';
import { useSync } from '../../hooks/useSync';
import { subscribeSyncCompleted } from '../../lib/syncEvents';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { SrmListSkeleton, useSheetBottomPadding } from '@/components/ui/srm';
import IncidentShareButton from '@/components/IncidentShareButton';
import {
  NO_MATERIAL_USED_LABEL,
  buildEquipmentSummary,
  createEmptyMaterialFormRow,
  formatQuantity,
  normalizeMaterialRows,
  type MaterialFormRow,
} from '@/lib/materials';

// ⚡ Bolt: Hoisted pure helper function to prevent recreation on every render
const parseMediaUrls = (value?: string | null) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((url): url is string => typeof url === 'string') : [];
  } catch {
    return [];
  }
};

// ⚡ Bolt: Hoisted pure helper function to prevent recreation on every render
const openIncidentMap = (incident: Incident) => {
  if (incident.latitude == null || incident.longitude == null) return;
  const query = `${incident.latitude},${incident.longitude}`;
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
};

// ⚡ Bolt: Hoisted pure helper function to prevent recreation on every render
// Format incident date for display
const formatIncidentDate = (dateString?: string) => {
  if (!dateString) return 'Date inconnue';
  try {
    const date = new Date(dateString);
    return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')} • ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  } catch {
    return 'Date invalide';
  }
};

// Define the incident type mapping to SQLite schema
interface Incident {
  id: string;
  client_id?: string;
  type: 'BT' | 'MT';
  date: string;
  village: string;
  incident_type?: string;
  depart_hta?: string | null;
  status: 'open' | 'closed';
  commune_id?: string;
  equipment_used?: string;
  reclamation: number;
  reclamation_by?: string;
  reclamation_name?: string;
  created_by?: string;
  latitude?: number | null;
  longitude?: number | null;
  media_urls?: string | null;
  sync_status?: 'pending' | 'syncing' | 'synced' | 'failed';
  sync_error?: string | null;
  created_at?: string;
  material_draft?: string;
  synced: number;
}

const INCIDENT_PAGE_SIZE = 30;
const INCIDENT_LIST_COLUMNS = [
  'id',
  'client_id',
  'type',
  'date',
  'village',
  'incident_type',
  'depart_hta',
  'status',
  'commune_id',
  'equipment_used',
  'material_draft',
  'reclamation',
  'reclamation_by',
  'reclamation_name',
  'created_by',
  'latitude',
  'longitude',
  'media_urls',
  'sync_status',
  'sync_error',
  'created_at',
  'archived_at',
  'synced',
].join(', ');

export default function Home() {
  const sheetBottomPadding = useSheetBottomPadding();
  const { user } = useAuth();
  const db = useSQLiteContext();
  const { isSyncing, syncPendingItems } = useSync(user?.id);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Modal State
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [selectedIncidentMaterials, setSelectedIncidentMaterials] = useState<IncidentMaterialRow[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [showClosureMaterials, setShowClosureMaterials] = useState(false);
  const [materialUsage, setMaterialUsage] = useState<MaterialUsageChoice>(null);
  const [closureMaterialRows, setClosureMaterialRows] = useState<MaterialFormRow[]>([createEmptyMaterialFormRow()]);
  const [isClosingIncident, setIsClosingIncident] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);


  const closureSaveQueue = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!user?.id || !selectedIncident || !isModalVisible || materialsLoading || isClosingIncident
      || selectedIncident.status !== 'open' || selectedIncidentMaterials.length > 0) return;
    const id = Number(selectedIncident.id);
    const userId = user.id;
    const draft = { rows: closureMaterialRows, choice: materialUsage };
    closureSaveQueue.current = closureSaveQueue.current
      .then(() => saveClosureDraft(db, id, userId, draft))
      .catch(() => Alert.alert('Brouillon', 'Le matériel ne peut pas être enregistré. Gardez ce formulaire ouvert.'));
  }, [db, user?.id, selectedIncident, isModalVisible, materialsLoading, isClosingIncident,
    selectedIncidentMaterials.length, closureMaterialRows, materialUsage]);

  // Fetch incidents from SQLite
  const fetchIncidents = useCallback(async (reset = true, cursor?: Incident) => {
    try {
      if (reset) {
        setIsLoading(true);
      } else {
        setIsLoadingMore(true);
      }
      const pageCursor = reset ? null : cursor;
      const rows = await db.getAllAsync<Incident>(
        `SELECT ${INCIDENT_LIST_COLUMNS}
         FROM incidents
         WHERE created_by = ?
           AND archived_at IS NULL
           AND (
             ? IS NULL
             OR date < ?
             OR (date = ? AND id < ?)
           )
         ORDER BY date DESC, id DESC
         LIMIT ?`,
        [
          user?.id ?? '',
          pageCursor?.date ?? null,
          pageCursor?.date ?? null,
          pageCursor?.date ?? null,
          pageCursor?.id ?? null,
          INCIDENT_PAGE_SIZE,
        ]
      );
      setIncidents(current => reset ? rows : [...current, ...rows]);
      setHasMore(rows.length === INCIDENT_PAGE_SIZE);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      if (reset) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, [db, user?.id]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const refresh = async () => {
        await fetchIncidents(true);
        await syncPendingItems({ reason: 'foreground' });
        if (isActive) {
          await fetchIncidents(true);
        }
      };

      void refresh();

      return () => {
        isActive = false;
      };
    }, [fetchIncidents, syncPendingItems])
  );

  useEffect(() => {
    return subscribeSyncCompleted(() => {
      void fetchIncidents(true);
    });
  }, [fetchIncidents]);

  const handleCloseIncident = async (incident: Incident) => {
    if (isClosingIncident || materialsLoading) return;
    const hasExistingMaterials = selectedIncidentMaterials.length > 0;
    if (!hasExistingMaterials && !showClosureMaterials) {
      setShowClosureMaterials(true);
      return;
    }

    if (!hasExistingMaterials && materialUsage === null) {
      Alert.alert('Matériel utilisé', 'Choisissez avec matériel ou aucun matériel utilisé.');
      return;
    }
    const noMaterialUsed = !hasExistingMaterials && materialUsage === 'none';
    const normalizedMaterials = noMaterialUsed ? [] : normalizeMaterialRows(closureMaterialRows);
    if (normalizedMaterials === null) {
      Alert.alert("Matériel invalide", "Chaque ligne de matériel doit avoir un nom et une quantité positive.");
      return;
    }
    if (!hasExistingMaterials && !noMaterialUsed && normalizedMaterials.length === 0) {
      Alert.alert("Matériel requis", "Ajoutez au moins un matériel utilisé pour clôturer l'incident.");
      return;
    }

    try {
      setIsClosingIncident(true);
      const localIncidentId = Number(incident.id);
      const existingSummary = incident.equipment_used || selectedIncidentMaterials
        .map((material) => `${material.material_name} x${formatQuantity(material.quantity)}`)
        .join(', ');
      const equipmentSummary = noMaterialUsed ? NO_MATERIAL_USED_LABEL : normalizedMaterials.length > 0
        ? buildEquipmentSummary(normalizedMaterials)
        : existingSummary;

      await closureSaveQueue.current;
      await db.withExclusiveTransactionAsync(async (txn) => {
        if (normalizedMaterials.length > 0) {
          await insertIncidentMaterials(txn, localIncidentId, normalizedMaterials);
          await enqueueSyncMaterials(txn, localIncidentId);
        }
        await txn.runAsync(
          `UPDATE incidents
           SET status = ?, equipment_used = ?, no_material_used = ?, material_draft = '[]', synced = 0, sync_status = 'pending', sync_error = NULL
           WHERE id = ?`,
          ['closed', equipmentSummary, noMaterialUsed ? 1 : 0, localIncidentId]
        );
        await enqueueStatusUpdate(txn, localIncidentId, 'closed');
      });
      Alert.alert("Succès", "Incident clôturé avec succès");
      setIsModalVisible(false);
      setShowClosureMaterials(false);
      setMaterialUsage(null);
      setClosureMaterialRows([createEmptyMaterialFormRow()]);
      await syncPendingItems({ reason: 'manual', forceReferenceData: true });
      await fetchIncidents(true);
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible de clôturer l'incident");
    } finally {
      setIsClosingIncident(false);
    }
  };



  // ⚡ Bolt: Wrapped in useCallback to provide a stable reference and prevent re-renders in children
  const openIncidentDetails = useCallback(async (incident: Incident) => {
    setSelectedIncident(incident);
    setSelectedIncidentMaterials([]);
    setMaterialsLoading(true);
    setIsModalVisible(true);
    setShowClosureMaterials(false);
    setMaterialUsage(null);
    setClosureMaterialRows([createEmptyMaterialFormRow()]);
    try {
      await closureSaveQueue.current;
      const materials = await getIncidentMaterialsByLocalId(db, Number(incident.id));
      const draft = user?.id ? await loadClosureDraft(db, Number(incident.id), user.id) : null;
      setSelectedIncidentMaterials(materials);
      if (materials.length === 0 && draft) {
        setClosureMaterialRows(draft.rows);
        setMaterialUsage(draft.choice);
      }
    } catch (error) {
      console.warn('Failed to load incident materials:', error);
      setSelectedIncidentMaterials([]);
      Alert.alert('Matériel', 'Lecture du matériel impossible. Fermez puis rouvrez cet incident.');
      setIsModalVisible(false);
    } finally {
      setMaterialsLoading(false);
    }
  }, [db, user?.id]);

  // ⚡ Bolt: Wrapped onEndReached callback in useCallback to prevent continuous recreation during scrolling
  const handleEndReached = useCallback(() => {
    if (hasMore && !isLoadingMore) {
      void fetchIncidents(false, incidents.at(-1));
    }
  }, [hasMore, isLoadingMore, fetchIncidents, incidents]);

  // ⚡ Bolt: Wrapped renderItem in useCallback to prevent re-rendering all list items when parent state changes
  const renderIncidentItem = useCallback(({ item }: { item: Incident }) => {
    const isOpen = item.status !== 'closed';
    const hasMedia = parseMediaUrls(item.media_urls).length > 0;
    const syncStatus = item.sync_status || (item.synced === 1 ? 'synced' : 'pending');

    return (
      <TouchableOpacity
        style={{
          marginHorizontal: SPACING.xl,
          marginBottom: SPACING.lg,
          backgroundColor: COLORS.surface,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: COLORS.border,
          padding: SPACING.xl,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: SPACING.md,
        }}
        activeOpacity={0.8}
        onPress={() => {
          void openIncidentDetails(item);
        }}
      >
        {/* Status dot instead of border-left stripe */}
        <View style={{
          width: 8,
          height: 8,
          borderRadius: RADIUS.full,
          backgroundColor: isOpen ? COLORS.signalOrange : COLORS.accent,
          marginTop: 6,
          flexShrink: 0,
        }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginRight: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textPrimary, textTransform: 'uppercase' }}>{item.type}</Text>
            </View>
            <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {item.village}
            </Text>
          </View>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {formatIncidentDate(item.date)}
          </Text>
          {item.incident_type ? (
            <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' }} numberOfLines={1}>
              {item.incident_type}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 }}>
            {hasMedia ? (
              <Ionicons name="image-outline" size={14} color={COLORS.textSecondary} />
            ) : null}
            {item.latitude != null && item.longitude != null ? (
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
            ) : null}
            {syncStatus === 'failed' ? (
              <Ionicons name="warning-outline" size={14} color={COLORS.signalRed} />
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: SPACING.sm }}>
        <View style={{
          paddingHorizontal: SPACING.sm,
          paddingVertical: SPACING.xs,
          borderRadius: RADIUS.sm,
          backgroundColor: isOpen ? COLORS.signalRedTint : COLORS.signalGreenTint,
          borderWidth: 1,
          borderColor: isOpen ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
          flexShrink: 0,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: isOpen ? COLORS.signalRed : COLORS.signalGreen, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {isOpen ? 'EN COURS' : 'CLÔTURÉ'}
          </Text>
        </View>
        <IncidentShareButton incidentId={Number(item.id)} />
        </View>
      </TouchableOpacity>
    );
  }, [openIncidentDetails]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

      {/* Header */}
      <View style={{
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.xxl,
        backgroundColor: COLORS.textPrimary,
        zIndex: 10,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ color: COLORS.surface, fontSize: 22, fontWeight: '900', letterSpacing: 0.5 }}>
              {user?.email ? user.email.split('@')[0].toUpperCase() : 'AGENT'}
            </Text>
            <Text style={{ color: COLORS.accent, fontSize: 12, marginTop: 4, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
              INCIDENTS TERRAIN
            </Text>
          </View>
          {/* Manual Sync Button */}
          <TouchableOpacity
            onPress={async () => {
              await syncPendingItems({ reason: 'manual', forcePull: true, forceReferenceData: true });
              await fetchIncidents(true);
            }}
            style={{
              backgroundColor: 'rgba(255,255,255,0.08)',
              padding: SPACING.md,
              borderRadius: RADIUS.sm,
              borderWidth: 1,
              borderColor: isSyncing ? COLORS.accent : 'rgba(255,255,255,0.18)',
            }}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size={24} color={COLORS.accent} />
            ) : (
              <Ionicons name="sync-outline" size={24} color={COLORS.surface} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* List Container */}
        <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.xxl }}>
        {isLoading ? (
          <SrmListSkeleton count={6} />
        ) : (
          <FlatList
            data={incidents}
            renderItem={renderIncidentItem}
            keyExtractor={item => String(item.id)}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.4}
            ListFooterComponent={isLoadingMore ? (
              <ActivityIndicator style={{ paddingVertical: SPACING.lg }} color={COLORS.accent} />
            ) : null}
            ListEmptyComponent={
              <View style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: SPACING.xl,
                paddingTop: 60,
              }}>
                <View style={{
                  width: 72,
                  height: 72,
                  borderRadius: RADIUS.full,
                  backgroundColor: COLORS.signalGreenTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: SPACING.xl,
                }}>
                  <Ionicons name="checkmark-done-circle-outline" size={36} color={COLORS.signalGreen} />
                </View>
                <Text style={{
                  ...TYPOGRAPHY.title,
                  color: COLORS.textPrimary,
                  textAlign: 'center',
                  marginBottom: SPACING.sm,
                }}>
                  Aucun incident signalé
                </Text>
                <Text style={{
                  ...TYPOGRAPHY.body,
                  color: COLORS.textSecondary,
                  textAlign: 'center',
                  lineHeight: 20,
                }}>
                  Appuyez sur le bouton + pour signaler un nouvel incident.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 24,
            paddingBottom: sheetBottomPadding,
            height: '80%',
          }}>
            {/* Modal Handle */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 }} />
            </View>

            {selectedIncident && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {(() => {
                  const mediaUrls = parseMediaUrls(selectedIncident.media_urls);
                  const hasLocation = selectedIncident.latitude != null && selectedIncident.longitude != null;

                  return (
                    <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#6B7280', fontWeight: '900', fontSize: 12, letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
                      {selectedIncident.type} • {selectedIncident.village}
                    </Text>
                    <Text style={{ color: '#111827', fontSize: 24, fontWeight: '900', letterSpacing: 0.5 }}>DÉTAILS INCIDENT</Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IncidentShareButton incidentId={Number(selectedIncident.id)} />
                  <TouchableOpacity
                    onPress={() => setIsModalVisible(false)}
                    accessibilityRole="button"
                    accessibilityLabel="Fermer les détails de l’incident"
                    style={{ backgroundColor: '#F3F4F6', padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' }}
                  >
                    <Ionicons name="close" size={24} color="#111827" />
                  </TouchableOpacity>
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
                  <View style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 4,
                    backgroundColor: selectedIncident.status !== 'closed' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 1,
                    borderColor: selectedIncident.status !== 'closed' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  }}>
                    <Text style={{
                      fontWeight: '800',
                      fontSize: 12,
                      letterSpacing: 0.5,
                      color: selectedIncident.status !== 'closed' ? '#EA580C' : '#16A34A'
                    }}>
                      {selectedIncident.status !== 'closed' ? 'EN COURS' : 'CLÔTURÉ'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#F9FAFB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '600' }}>{formatIncidentDate(selectedIncident.date)}</Text>
                  </View>
                </View>

                <View style={{ padding: 20, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                  <Text style={{ color: '#6B7280', fontSize: 11, textTransform: 'uppercase', fontWeight: '900', marginBottom: 8, letterSpacing: 1.5 }}>
                    MATÉRIEL
                  </Text>
                  {selectedIncidentMaterials.length > 0 ? (
                    <View style={{ gap: 8 }}>
                      {selectedIncidentMaterials.map((material) => (
                        <View key={material.client_material_id} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 16 }}>
                          <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700', flex: 1 }}>{material.material_name}</Text>
                          <Text style={{ color: '#111827', fontSize: 16, fontWeight: '900' }}>x{formatQuantity(material.quantity)}</Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>
                      {selectedIncident.equipment_used || "NON SPÉCIFIÉ"}
                    </Text>
                  )}
                </View>

                {selectedIncident.type === 'MT' && selectedIncident.depart_hta ? (
                  <View style={{ padding: 20, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                    <Text style={{ color: '#6B7280', fontSize: 11, textTransform: 'uppercase', fontWeight: '900', marginBottom: 8, letterSpacing: 1.5 }}>
                      DÉPART HTA
                    </Text>
                    <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>
                      {selectedIncident.depart_hta}
                    </Text>
                  </View>
                ) : null}

                {Boolean(selectedIncident.reclamation) && (
                  <View style={{ padding: 20, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                    <Text style={{ color: '#6B7280', fontSize: 11, textTransform: 'uppercase', fontWeight: '900', marginBottom: 8, letterSpacing: 1.5 }}>
                      RÉCLAMATION
                    </Text>
                    <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>
                      {selectedIncident.reclamation_name} ({selectedIncident.reclamation_by})
                    </Text>
                  </View>
                )}

                {hasLocation && (
                  <TouchableOpacity
                    onPress={() => openIncidentMap(selectedIncident)}
                    style={{ padding: 20, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}
                  >
                    <Text style={{ color: '#6B7280', fontSize: 11, textTransform: 'uppercase', fontWeight: '900', marginBottom: 8, letterSpacing: 1.5 }}>
                      POSITION GPS
                    </Text>
                    <Text style={{ color: '#111827', fontSize: 15, fontWeight: '700' }}>
                      {selectedIncident.latitude?.toFixed(6)}, {selectedIncident.longitude?.toFixed(6)}
                    </Text>
                    <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '700', marginTop: 6 }}>
                      Ouvrir dans Google Maps
                    </Text>
                  </TouchableOpacity>
                )}

                {selectedIncident.sync_status === 'failed' && (
                  <View style={{ padding: 16, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#FCA5A5', backgroundColor: '#FEF2F2' }}>
                    <Text style={{ color: '#991B1B', fontSize: 11, textTransform: 'uppercase', fontWeight: '900', marginBottom: 6, letterSpacing: 1.5 }}>
                      ÉCHEC SYNCHRONISATION
                    </Text>
                    <Text style={{ color: '#7F1D1D', fontSize: 13, fontWeight: '600' }}>
                      {selectedIncident.sync_error || 'Erreur inconnue'}
                    </Text>
                  </View>
                )}

                <IncidentPhotoStrip urls={mediaUrls} />

                <View style={{ flex: 1 }} />

                {selectedIncident.status !== 'closed' && showClosureMaterials && selectedIncidentMaterials.length === 0 ? (
                  <ClosureMaterialsForm
                    usage={materialUsage}
                    onUsageChange={setMaterialUsage}
                    rows={closureMaterialRows}
                    onRowsChange={setClosureMaterialRows}
                    disabled={isClosingIncident}
                  />
                ) : null}

                {/* Actions */}
                <View style={{ marginBottom: 32 }}>
                  {selectedIncident.status !== 'closed' && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#DAF22C',
                        paddingVertical: 18,
                        borderRadius: 4,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#DAF22C'
                      }}
                      onPress={() => handleCloseIncident(selectedIncident)}
                      disabled={isClosingIncident || materialsLoading}
                    >
                      {isClosingIncident || materialsLoading ? (
                        <ActivityIndicator color="#111827" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-circle" size={24} color="#111827" style={{ marginRight: 8 }} />
                          <Text style={{ color: '#111827', fontWeight: '900', fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' }}>
                            {showClosureMaterials && selectedIncidentMaterials.length === 0 ? 'VALIDER LA CLÔTURE' : "CLÔTURER L'INCIDENT"}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                    </>
                  );
                })()}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
