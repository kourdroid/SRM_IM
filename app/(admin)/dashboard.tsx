import CustomBarChart from '@/components/CustomBarChart';
import { type ChartDataPoint, type DashboardStats } from '@/src/core/entities/admin';
import { AdminService } from '@/src/core/services/adminService';
import { IncidentAdminService, type Incident } from '@/src/core/services/incidentAdminService';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
  Image,
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

  const handleToggleStatusInModal = async (incident: Incident) => {
    const newStatus = incident.status === 'open' ? 'closed' : 'open';
    try {
      await IncidentAdminService.updateIncidentStatus({ id: incident.id, status: newStatus });
      // Update local state
      setLatestIncidents(prev => prev.map(i => i.id === incident.id ? { ...i, status: newStatus } : i));
      setSelectedIncident(prev => prev && prev.id === incident.id ? { ...prev, status: newStatus } : prev);
      
      // Refresh KPI statistics
      const [newStats, resolution] = await Promise.all([
        AdminService.getDashboardStats(),
        AdminService.getResolutionStats()
      ]);
      setStats(newStats);
      setResolutionStats(resolution);
      
      Alert.alert('Succès', `L'incident a été marqué comme ${newStatus === 'closed' ? 'fermé' : 'ouvert'}.`);
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Impossible de mettre à jour le statut');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
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
              <Text style={styles.headerGreeting}>ONEE SRM</Text>
              <Text style={styles.headerTitle}>Tableau de bord</Text>
            </View>
            <View style={styles.headerBadge}>
              <Ionicons name="pulse" size={16} color={COLORS.primaryDark} />
              <Text style={styles.headerBadgeText}>Live</Text>
            </View>
          </View>
        </View>

        {/* ─── Stats Cards ─────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          {/* Total Incidents */}
          <View style={[styles.statCard, { borderLeftColor: COLORS.statBlue }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="layers-outline" size={18} color={COLORS.statBlue} />
            </View>
            <Text style={styles.statLabel}>Total Incidents</Text>
            <Text style={[styles.statValue, { color: COLORS.textPrimary }]}>
              {stats.total}
            </Text>
          </View>

          {/* Open Issues */}
          <View style={[styles.statCard, { borderLeftColor: COLORS.statRed }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="alert-circle-outline" size={18} color={COLORS.statRed} />
            </View>
            <Text style={styles.statLabel}>En cours</Text>
            <Text style={[styles.statValue, { color: COLORS.statRed }]}>
              {stats.open}
            </Text>
          </View>

          {/* Resolved */}
          <View style={[styles.statCard, { borderLeftColor: COLORS.statGreen }]}>
            <View style={[styles.statIconContainer, { backgroundColor: '#F0FDF4' }]}>
              <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.statGreen} />
            </View>
            <Text style={styles.statLabel}>Résolus</Text>
            <Text style={[styles.statValue, { color: COLORS.statGreen }]}>
              {stats.closed}
            </Text>
          </View>

          {/* Reclamations */}
          <View style={[styles.statCard, { borderLeftColor: COLORS.statOrange }]}>
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
          <Text style={styles.sectionTitle}>Performance de Résolution (30j)</Text>
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
                onPress={() => setSelectedIncident(item)}
                activeOpacity={0.7}
              >
                <View style={styles.incidentCardMain}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{item.type}</Text>
                    </View>
                    <Text style={styles.incidentDate}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.incidentTitle} numberOfLines={1}>
                    {item.incident_type}
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
            <Text style={styles.showMoreText}>Voir plus d'incidents</Text>
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
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{selectedIncident.type}</Text>
                    </View>
                    <Text style={styles.modalTitle} numberOfLines={1}>
                      Détails de l'incident
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
                    <View style={[
                      styles.statusBadge,
                      { backgroundColor: selectedIncident.status === 'open' ? '#FEF2F2' : '#F0FDF4' }
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        { color: selectedIncident.status === 'open' ? COLORS.statRed : COLORS.statGreen }
                      ]}>
                        {selectedIncident.status === 'open' ? 'EN COURS' : 'RÉSOLU'}
                      </Text>
                    </View>
                    <Text style={styles.modalDate}>
                      Créé le {new Date(selectedIncident.created_at).toLocaleString()}
                    </Text>
                  </View>

                  {/* Incident Type Details */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Type d'incident</Text>
                    <Text style={styles.detailValue}>{selectedIncident.incident_type}</Text>
                  </View>

                  {/* Commune & Village */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Commune</Text>
                    <Text style={styles.detailValue}>{selectedIncident.commune_name}</Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Village / Quartier</Text>
                    <Text style={styles.detailValue}>{selectedIncident.village}</Text>
                  </View>

                  {/* Creator */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Rapporté par</Text>
                    <Text style={styles.detailValue}>{selectedIncident.created_by_name || 'Agent Terrain'}</Text>
                  </View>

                  {/* Equipment */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Matériel utilisé</Text>
                    <Text style={styles.detailValue}>{selectedIncident.equipment_used || 'Aucun'}</Text>
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
                          />
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </ScrollView>

                {/* Modal Footer Actions */}
                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={[
                      styles.actionStatusBtn,
                      { backgroundColor: selectedIncident.status === 'open' ? COLORS.statGreen : COLORS.statRed }
                    ]}
                    onPress={() => handleToggleStatusInModal(selectedIncident)}
                  >
                    <Ionicons
                      name={selectedIncident.status === 'open' ? "checkmark-circle-outline" : "alert-circle-outline"}
                      size={20}
                      color={COLORS.white}
                    />
                    <Text style={styles.actionStatusBtnText}>
                      {selectedIncident.status === 'open' ? 'Marquer comme Résolu' : 'Rouvrir l\'incident'}
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

// ─── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },

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
    borderLeftWidth: 4,
    borderColor: COLORS.cardBorder,
    borderWidth: 1,
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

  typeBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },

  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primaryDark,
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

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
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
});
