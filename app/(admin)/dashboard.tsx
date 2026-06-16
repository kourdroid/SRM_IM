import { SrmSkeletonBlock, SrmSkeletonCard, SrmStatusBadge } from '@/components/ui/srm';
import CustomBarChart from '@/components/CustomBarChart';
import {
  buildEquipmentSummary,
  createEmptyMaterialFormRow,
  normalizeMaterialRows,
  type MaterialFormRow,
} from '@/lib/materials';
import { type ChartDataPoint, type DashboardStats } from '@/src/core/entities/admin';
import { AdminService } from '@/src/core/services/adminService';
import { IncidentAdminService, type Incident } from '@/src/core/services/incidentAdminService';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Modal,
} from 'react-native';

// ─── Color Palette ───────────────────────────────────────────────
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
  statOrange: '#F59E0B',
  white: '#FFFFFF',
} as const;

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    open: 0,
    closed: 0,
    reclamations: 0,
  });
  const [monthlyData, setMonthlyData] = useState<ChartDataPoint[]>([]);
  const [resolutionStats, setResolutionStats] = useState({ avgDays: 0, maxDays: 0 });
  const [latestIncidents, setLatestIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [showClosureMaterials, setShowClosureMaterials] = useState(false);
  const [closureMaterialRows, setClosureMaterialRows] = useState<MaterialFormRow[]>([createEmptyMaterialFormRow()]);
  const [isClosingIncident, setIsClosingIncident] = useState(false);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [newStats, chartPoints, resolution, latest] = await Promise.all([
        AdminService.getDashboardStats(),
        AdminService.getMonthlyIncidents(new Date().getFullYear()),
        AdminService.getResolutionStats(),
        IncidentAdminService.getLatestOpenIncidents(3)
      ]);

      setStats(newStats);
      setMonthlyData(chartPoints);
      setResolutionStats(resolution);
      setLatestIncidents(latest);
    } catch (err) {
      console.error('Failed to fetch admin stats', err);
    } finally {
      setLoading(false);
    }
  };

  const openIncidentDetails = (incident: Incident) => {
    setSelectedIncident(incident);
    setShowClosureMaterials(false);
    setClosureMaterialRows([createEmptyMaterialFormRow()]);
  };

  const addClosureMaterialRow = () => {
    setClosureMaterialRows(rows => [...rows, createEmptyMaterialFormRow()]);
  };

  const removeClosureMaterialRow = (id: string) => {
    setClosureMaterialRows(rows => rows.length > 1 ? rows.filter(row => row.id !== id) : rows);
  };

  const updateClosureMaterialRow = (id: string, patch: Partial<MaterialFormRow>) => {
    setClosureMaterialRows(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  };

  const handleToggleStatusInModal = async (incident: Incident) => {
    const newStatus = incident.status === 'open' ? 'closed' : 'open';
    const existingMaterials = incident.materials || [];
    const normalizedMaterials = normalizeMaterialRows(closureMaterialRows);
    if (incident.status === 'open' && existingMaterials.length === 0 && !showClosureMaterials) {
      setShowClosureMaterials(true);
      return;
    }
    if (incident.status === 'open' && normalizedMaterials === null) {
      Alert.alert('Matériel invalide', 'Chaque ligne de matériel doit avoir un nom et une quantité positive.');
      return;
    }
    if (incident.status === 'open' && existingMaterials.length === 0 && (normalizedMaterials?.length ?? 0) === 0) {
      Alert.alert('Matériel requis', "Ajoutez au moins un matériel utilisé pour clôturer l'incident.");
      return;
    }
    const closureMaterials = normalizedMaterials ?? [];

    try {
      setIsClosingIncident(true);
      const nextMaterials = incident.status === 'open' && closureMaterials.length > 0
        ? closureMaterials.map(material => ({
          material_name: material.material_name,
          quantity: material.quantity,
        }))
        : existingMaterials;
      const nextEquipmentUsed = closureMaterials.length > 0
        ? buildEquipmentSummary(closureMaterials)
        : incident.equipment_used;

      if (incident.status === 'open' && closureMaterials.length > 0) {
        await IncidentAdminService.closeIncidentWithMaterials({
          id: incident.id,
          materials: closureMaterials,
        });
      } else {
        await IncidentAdminService.updateIncidentStatus({ id: incident.id, status: newStatus });
      }
      // Update local state
      setLatestIncidents(prev => prev.map(i => i.id === incident.id ? {
        ...i,
        status: newStatus,
        materials: nextMaterials,
        equipment_used: nextEquipmentUsed,
        materials_summary: nextEquipmentUsed,
      } : i));
      setSelectedIncident(prev => prev && prev.id === incident.id ? {
        ...prev,
        status: newStatus,
        materials: nextMaterials,
        equipment_used: nextEquipmentUsed,
        materials_summary: nextEquipmentUsed,
      } : prev);
      setShowClosureMaterials(false);
      setClosureMaterialRows([createEmptyMaterialFormRow()]);
      
      // Refresh KPI statistics
      const [newStats, resolution] = await Promise.all([
        AdminService.getDashboardStats(),
        AdminService.getResolutionStats()
      ]);
      setStats(newStats);
      setResolutionStats(resolution);
      
      Alert.alert('Succès', `L'incident a été ${newStatus === 'closed' ? 'clôturé' : 'rouvert'}.`);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de mettre à jour le statut');
    } finally {
      setIsClosingIncident(false);
    }
  };

  const openIncidentMap = (incident: Incident) => {
    if (incident.latitude == null || incident.longitude == null) return;
    const query = `${incident.latitude},${incident.longitude}`;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ─── Dark Header Section ─────────────────────────────────── */}
        <View style={styles.headerSection}>
          <View style={styles.headerInner}>
            <View>
              <Text style={styles.headerGreeting}>SRM</Text>
              <Text style={styles.headerTitle}>Tableau de bord</Text>
            </View>
            <View style={styles.headerBadge}>
              <Ionicons name="time-outline" size={14} color={COLORS.white} />
              <Text style={styles.headerBadgeText}>{"Aujourd'hui"}</Text>
            </View>
          </View>
        </View>

        {/* ─── Stats Cards ─────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          {/* Total Incidents */}
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="layers-outline" size={18} color={COLORS.statBlue} />
            </View>
            <Text style={styles.statLabel}>Total</Text>
            <Text style={[styles.statValue, { color: COLORS.textPrimary }]}>
              {stats.total}
            </Text>
          </View>

          {/* Open Issues */}
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="alert-circle-outline" size={18} color={COLORS.statRed} />
            </View>
            <Text style={styles.statLabel}>En cours</Text>
            <Text style={[styles.statValue, { color: COLORS.statRed }]}>
              {stats.open}
            </Text>
          </View>

          {/* Resolved */}
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.statGreen} />
            </View>
            <Text style={styles.statLabel}>Clôturés</Text>
            <Text style={[styles.statValue, { color: COLORS.statGreen }]}>
              {stats.closed}
            </Text>
          </View>

          {/* Reclamations */}
          <View style={styles.statCard}>
            <View style={[styles.statIconContainer, { backgroundColor: '#FFFBEB' }]}>
              <Ionicons name="warning-outline" size={18} color={COLORS.statOrange} />
            </View>
            <Text style={styles.statLabel}>Réclamations</Text>
            <Text style={[styles.statValue, { color: COLORS.statOrange }]}>
              {stats.reclamations}
            </Text>
          </View>
        </View>

        {/* ─── Resolution KPIs (30 days average / max) ─────────────── */}
        <View style={styles.resolutionContainer}>
          <Text style={styles.sectionTitle}>Performance de clôture (30j)</Text>
          <View style={styles.resolutionRow}>
            <View style={styles.resolutionKpi}>
              <Text style={styles.resolutionValue}>
                {resolutionStats.avgDays.toFixed(1)} <Text style={{ fontSize: 14, fontWeight: 'normal' }}>Jours</Text>
              </Text>
              <Text style={styles.resolutionLabel}>Durée moyenne</Text>
            </View>
            <View style={styles.resolutionKpiDivider} />
            <View style={styles.resolutionKpi}>
              <Text style={styles.resolutionValue}>
                {resolutionStats.maxDays.toFixed(1)} <Text style={{ fontSize: 14, fontWeight: 'normal' }}>Jours</Text>
              </Text>
              <Text style={styles.resolutionLabel}>Durée maximale</Text>
            </View>
          </View>
        </View>

        {/* ─── Charts ──────────────────────────────────────────────── */}
        <View style={styles.chartContainer}>
          <CustomBarChart data={monthlyData} title="Incidents Mensuels" />
        </View>

        {/* ─── Latest Open Incidents ───────────────────────────────── */}
        <View style={styles.latestIncidentsSection}>
          <Text style={styles.sectionTitle}>Derniers Incidents Ouverts</Text>
          
          {latestIncidents.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-done-circle-outline" size={40} color={COLORS.statGreen} />
              <Text style={styles.emptyText}>Aucun incident ouvert</Text>
            </View>
          ) : (
            latestIncidents.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.incidentCard}
                onPress={() => openIncidentDetails(item)}
                activeOpacity={0.7}
              >
                <View style={styles.incidentCardMain}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <SrmStatusBadge label={item.type} style={{ marginRight: 8 }} />
                    <Text style={styles.incidentDate}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.incidentTitle} numberOfLines={1}>
                    {item.title || item.incident_type}
                  </Text>
                  <Text style={styles.incidentDesc} numberOfLines={2}>
                    {item.description || 'Aucune description fournie'}
                  </Text>
                  <View style={styles.incidentCardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Ionicons name="navigate-outline" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.incidentLocation}>
                        {item.commune_name} • {item.village}
                      </Text>
                    </View>
                    {item.reclamation && (
                      <View style={styles.reclamationBadge}>
                        <Text style={styles.reclamationBadgeText}>RÉCLAMATION</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            ))
          )}

          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => router.push('/(admin)/incidents')}
          >
            <Text style={styles.showMoreText}>{"Voir plus d'incidents"}</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.primaryDark} />
          </TouchableOpacity>
        </View>

        {/* Bottom spacer for safe scroll area */}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ─── Incident Detail Modal ─────────────────────────────── */}
      <Modal
        visible={selectedIncident !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedIncident(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedIncident && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <SrmStatusBadge label={selectedIncident.type} style={{ marginRight: 8 }} />
                    <Text style={styles.modalTitle} numberOfLines={1}>
                      {selectedIncident.title || "Détails de l'incident"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setSelectedIncident(null)}
                    style={styles.closeModalButton}
                  >
                    <Ionicons name="close" size={24} color={COLORS.textPrimary} />
                  </TouchableOpacity>
                </View>

                {/* Modal Scroll Content */}
                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  {/* Status Badge */}
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <SrmStatusBadge variant={selectedIncident.status === 'open' ? 'danger' : 'success'} label={selectedIncident.status === 'open' ? 'EN COURS' : 'CLÔTURÉ'} />
                    <Text style={styles.modalDate}>
                      Créé le {new Date(selectedIncident.created_at).toLocaleString()}
                    </Text>
                  </View>

                  {/* Incident Type Details */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>{"Type d'incident"}</Text>
                    <Text style={styles.detailValue}>{selectedIncident.incident_type}</Text>
                  </View>

                  {selectedIncident.type === 'MT' && selectedIncident.depart_hta ? (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Départ HTA</Text>
                      <Text style={styles.detailValue}>{selectedIncident.depart_hta}</Text>
                    </View>
                  ) : null}

                  {/* Commune & Village */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Commune</Text>
                    <Text style={styles.detailValue}>{selectedIncident.commune_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Village / Quartier</Text>
                    <Text style={styles.detailValue}>{selectedIncident.village}</Text>
                  </View>

                  {selectedIncident.latitude != null && selectedIncident.longitude != null && (
                    <TouchableOpacity
                      style={styles.detailRow}
                      onPress={() => openIncidentMap(selectedIncident)}
                    >
                      <Text style={styles.detailLabel}>Position GPS</Text>
                      <Text style={styles.detailValue}>
                        {selectedIncident.latitude.toFixed(6)}, {selectedIncident.longitude.toFixed(6)}
                      </Text>
                      <Text style={styles.mapLinkText}>Ouvrir dans Google Maps</Text>
                    </TouchableOpacity>
                  )}

                  {/* Creator */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rapporté par</Text>
                    <Text style={styles.detailValue}>{selectedIncident.created_by_name || 'Agent Terrain'}</Text>
                  </View>

                  {selectedIncident.status === 'closed' && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Clôturé par</Text>
                      <Text style={styles.detailValue}>
                        {selectedIncident.closed_by_name || 'Utilisateur inconnu'}
                      </Text>
                      {selectedIncident.closed_at && (
                        <Text style={styles.mapLinkText}>
                          {new Date(selectedIncident.closed_at).toLocaleString()}
                        </Text>
                      )}
                    </View>
                  )}

                  {/* Equipment */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Matériel utilisé</Text>
                    {selectedIncident.materials && selectedIncident.materials.length > 0 ? (
                      <View style={styles.materialList}>
                        {selectedIncident.materials.map((material) => (
                          <View key={`${material.material_name}-${material.quantity}`} style={styles.materialRow}>
                            <Text style={styles.materialName}>{material.material_name}</Text>
                            <Text style={styles.materialQuantity}>x{formatQuantity(material.quantity)}</Text>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={styles.detailValue}>{selectedIncident.equipment_used || 'Aucun'}</Text>
                    )}
                  </View>

                  {/* Description */}
                  <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailDescValue}>{selectedIncident.description || 'Aucune description fournie.'}</Text>
                  </View>

                  {/* Reclamation Info if applicable */}
                  {selectedIncident.reclamation && (
                    <View style={styles.reclamationDetailsBlock}>
                      <Text style={styles.reclamationDetailsTitle}>Informations Réclamation</Text>
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.reclamationTextItem}>
                          <Text style={{ fontWeight: 'bold' }}>Nom réclamant: </Text>
                          {selectedIncident.reclamation_name || 'N/A'}
                        </Text>
                        <Text style={styles.reclamationTextItem}>
                          <Text style={{ fontWeight: 'bold' }}>Déposée par: </Text>
                          {selectedIncident.reclamation_by || 'N/A'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Media attachments */}
                  {selectedIncident.media_urls && selectedIncident.media_urls.length > 0 && (
                    <View style={{ marginTop: 16, marginBottom: 24 }}>
                      <Text style={styles.detailLabel}>Pièces jointes ({selectedIncident.media_urls.length})</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                        {selectedIncident.media_urls.map((url, i) => (
                          <Image
                            key={i}
                            source={{ uri: url }}
                            style={styles.attachmentThumbnail}
                            contentFit="cover"
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </ScrollView>

                {selectedIncident.status === 'open' && showClosureMaterials && (!selectedIncident.materials || selectedIncident.materials.length === 0) ? (
                  <View style={styles.closureMaterialBlock}>
                    <Text style={styles.closureMaterialTitle}>MATÉRIEL OBLIGATOIRE</Text>
                    <Text style={styles.closureMaterialHelp}>
                      Renseignez le matériel utilisé avant de clôturer cet incident.
                    </Text>
                    <View style={styles.closureMaterialRows}>
                      {closureMaterialRows.map((row, index) => (
                        <View key={row.id} style={styles.closureMaterialRow}>
                          <TextInput
                            style={styles.closureMaterialNameInput}
                            value={row.materialName}
                            onChangeText={(value) => updateClosureMaterialRow(row.id, { materialName: value })}
                            placeholder={index === 0 ? 'Matériel' : 'Autre matériel'}
                            placeholderTextColor={COLORS.textMuted}
                            editable={!isClosingIncident}
                          />
                          <TextInput
                            style={styles.closureMaterialQuantityInput}
                            value={row.quantity}
                            onChangeText={(value) => updateClosureMaterialRow(row.id, { quantity: value })}
                            placeholder="Qté"
                            placeholderTextColor={COLORS.textMuted}
                            keyboardType="decimal-pad"
                            editable={!isClosingIncident}
                          />
                          {closureMaterialRows.length > 1 ? (
                            <TouchableOpacity
                              style={styles.closureMaterialRemove}
                              onPress={() => removeClosureMaterialRow(row.id)}
                              disabled={isClosingIncident}
                            >
                              <Ionicons name="trash-outline" size={18} color="#991B1B" />
                            </TouchableOpacity>
                          ) : null}
                        </View>
                      ))}
                      <TouchableOpacity
                        style={styles.closureMaterialAdd}
                        onPress={addClosureMaterialRow}
                        disabled={isClosingIncident}
                      >
                        <Ionicons name="add" size={18} color={COLORS.textPrimary} />
                        <Text style={styles.closureMaterialAddText}>Ajouter un matériel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : null}

                {/* Modal Footer Actions */}
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[
                      styles.actionStatusBtn,
                      { backgroundColor: selectedIncident.status === 'open' ? COLORS.statGreen : COLORS.statRed }
                    ]}
                    onPress={() => handleToggleStatusInModal(selectedIncident)}
                    disabled={isClosingIncident}
                  >
                    <Ionicons
                      name={selectedIncident.status === 'open' ? "checkmark-circle-outline" : "alert-circle-outline"}
                      size={20}
                      color={COLORS.white}
                    />
                    <Text style={styles.actionStatusBtnText}>
                      {selectedIncident.status === 'open' ? 'Clôturer l\'incident' : 'Rouvrir l\'incident'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function AdminDashboardSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerSection}>
          <View style={styles.headerInner}>
            <View style={{ flex: 1 }}>
              <SrmSkeletonBlock width={48} height={12} style={styles.darkSkeletonBlock} />
              <SrmSkeletonBlock width="58%" height={28} style={[styles.darkSkeletonBlock, { marginTop: 8 }]} />
            </View>
            <SrmSkeletonBlock width={92} height={30} radius={20} style={styles.darkSkeletonBlock} />
          </View>
        </View>

        <View style={styles.statsGrid}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={styles.statCard}>
              <SrmSkeletonBlock width={34} height={34} radius={8} style={{ marginBottom: 10 }} />
              <SrmSkeletonBlock width="56%" height={12} />
              <SrmSkeletonBlock width="42%" height={28} style={{ marginTop: 8 }} />
            </View>
          ))}
        </View>

        <View style={styles.resolutionContainer}>
          <SrmSkeletonBlock width="66%" height={18} />
          <View style={styles.resolutionRow}>
            <SrmSkeletonCard rows={2} style={styles.dashboardSkeletonMetric} />
            <SrmSkeletonCard rows={2} style={styles.dashboardSkeletonMetric} />
          </View>
        </View>

        <View style={styles.chartContainer}>
          <SrmSkeletonBlock width="52%" height={18} />
          <SrmSkeletonBlock width="100%" height={180} radius={8} style={{ marginTop: 16 }} />
        </View>

        <View style={styles.latestIncidentsSection}>
          <SrmSkeletonBlock width="62%" height={18} style={{ marginBottom: 12 }} />
          <SrmSkeletonCard rows={3} />
          <SrmSkeletonCard rows={3} />
          <SrmSkeletonCard rows={3} />
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },

  scrollContent: {
    paddingBottom: 24,
  },

  // ── Header ──
  headerSection: {
    backgroundColor: COLORS.primaryDark,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },

  headerInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerGreeting: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.accent,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },

  headerBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },

  // ── Stats Grid ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: -16,
    paddingTop: 0,
  },

  statCard: {
    width: '48%',
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
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
        elevation: 2,
      },
    }),
  },

  statIconContainer: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 4,
  },

  statValue: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // ── Resolution KPIs ──
  resolutionContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  resolutionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: 12,
  },

  resolutionKpi: {
    alignItems: 'center',
    flex: 1,
  },

  resolutionKpiDivider: {
    width: 1,
    height: 40,
    backgroundColor: COLORS.cardBorder,
  },

  resolutionValue: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.primaryDark,
  },

  resolutionLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: '600',
  },

  // ── Chart ──
  chartContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  // ── Latest Open Incidents ──
  latestIncidentsSection: {
    paddingHorizontal: 16,
    marginTop: 20,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.primaryDark,
    letterSpacing: -0.3,
    marginBottom: 12,
  },

  incidentCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  incidentCardMain: {
    flex: 1,
  },

  incidentDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  incidentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primaryDark,
    marginTop: 8,
  },

  incidentDesc: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginTop: 4,
  },

  incidentCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  incidentLocation: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  reclamationBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },

  reclamationBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.statOrange,
  },

  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },

  showMoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },

  emptyCard: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginTop: 8,
  },

  // ── Modal Styles ──
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
    minHeight: '60%',
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

  closeModalButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  modalScroll: {
    padding: 20,
  },

  modalDate: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  detailRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  detailLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },

  detailValue: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },
  materialList: {
    gap: 8,
  },

  materialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },

  materialName: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '700',
    flex: 1,
  },

  materialQuantity: {
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '900',
  },

  closureMaterialBlock: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },

  closureMaterialTitle: {
    fontSize: 11,
    fontWeight: '900',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 6,
  },

  closureMaterialHelp: {
    fontSize: 13,
    fontWeight: '600',
    color: '#78350F',
    marginBottom: 12,
  },

  closureMaterialRows: {
    gap: 10,
  },

  closureMaterialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  closureMaterialNameInput: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  closureMaterialQuantityInput: {
    width: 84,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCD34D',
    padding: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },

  closureMaterialRemove: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  closureMaterialAdd: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },

  closureMaterialAddText: {
    color: COLORS.textPrimary,
    fontWeight: '900',
  },

  mapLinkText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginTop: 4,
  },

  detailDescValue: {
    fontSize: 14,
    color: COLORS.textPrimary,
    lineHeight: 20,
  },

  reclamationDetailsBlock: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    marginTop: 10,
  },

  reclamationDetailsTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.statOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  reclamationTextItem: {
    fontSize: 13,
    color: '#78350F',
    marginTop: 4,
  },

  attachmentThumbnail: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },

  modalFooter: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 20,
  },

  actionStatusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },

  actionStatusBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.white,
  },
  darkSkeletonBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  dashboardSkeletonMetric: {
    flex: 1,
    marginBottom: 0,
    backgroundColor: COLORS.background,
  },
});

function formatQuantity(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
