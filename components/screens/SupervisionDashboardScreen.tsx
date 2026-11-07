import { useAuth } from '@/contexts/AuthContext';
import IncidentCard from '@/components/incidents/IncidentCard';
import IncidentDetailSheet from '@/components/incidents/IncidentDetailSheet';
import { SrmKpiCard, SrmSkeletonBlock, SrmSkeletonCard } from '@/components/ui/srm';
import CustomBarChart from '@/components/CustomBarChart';
import { type ChartDataPoint, type DashboardStats } from '@/src/core/entities/admin';
import { AdminService } from '@/src/core/services/adminService';
import { IncidentAdminService, type Incident } from '@/src/core/services/incidentAdminService';
import { countUnreadAdminNotifications } from '@/src/core/services/adminNotificationService';
import { Ionicons } from '@expo/vector-icons';
import { durationPartsFromDays, type DurationPart } from '@/src/core/utils/duration';
import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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

export default function SupervisionDashboardScreen() {
  const { isAdmin } = useAuth();
  const incidentsRoute = isAdmin ? '/(admin)/incidents' : '/(director)/incidents';
  const notificationsRoute = isAdmin ? '/(admin)/notifications' : '/(director)/notifications';
  const [unreadNotifications, setUnreadNotifications] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
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

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
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
      setLoadError('Les données du tableau de bord sont indisponibles. Vérifiez votre connexion et réessayez.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void fetchStats(); }, [fetchStats]));
  useFocusEffect(useCallback(() => {
    let active = true;
    void countUnreadAdminNotifications().then(count => { if (active) setUnreadNotifications(count); }).catch(() => { if (active) setUnreadNotifications(null); });
    return () => { active = false; };
  }, []));

  // Numbers change behind an open sheet, so this refresh must not swap the screen for the skeleton.
  const refreshAfterChange = async () => {
    try {
      const [newStats, chartPoints, resolution, latest] = await Promise.all([
        AdminService.getDashboardStats(),
        AdminService.getMonthlyIncidents(new Date().getFullYear()),
        AdminService.getResolutionStats(),
        IncidentAdminService.getLatestOpenIncidents(3),
      ]);
      setStats(newStats);
      setMonthlyData(chartPoints);
      setResolutionStats(resolution);
      setLatestIncidents(latest);
    } catch (err) {
      console.error('Failed to refresh admin stats', err);
    }
  };

  const handleIncidentUpdated = (id: string, patch: Partial<Incident>) => {
    setSelectedIncident(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
    void refreshAfterChange();
  };

  const handleIncidentArchived = () => {
    setSelectedIncident(null);
    void refreshAfterChange();
  };

  const openIncidents = (filters: { status?: 'open' | 'closed'; reclamation?: 'true'; period?: '30days' }) => {
    router.push({ pathname: incidentsRoute, params: { ...filters, filterAt: String(Date.now()) } } as Href);
  };

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  if (loadError) {
    return <View style={{ flex: 1, backgroundColor: COLORS.background, padding: 24, justifyContent: 'center' }}>
      <Text accessibilityRole="alert" style={{ color: COLORS.textPrimary, marginBottom: 16 }}>{loadError}</Text>
      <TouchableOpacity accessibilityRole="button" onPress={() => { void fetchStats(); }}
        style={{ backgroundColor: COLORS.accent, padding: 16, borderRadius: 12 }}>
        <Text style={{ color: COLORS.textPrimary }}>Réessayer</Text>
      </TouchableOpacity>
    </View>;
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
              <Text style={styles.headerGreeting}>{isAdmin ? 'Intervx' : 'Administrateur'}</Text>
              <Text style={styles.headerTitle}>Tableau de bord</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Notifications${unreadNotifications === null ? '' : `, ${unreadNotifications} à consulter`}`}
              style={[styles.headerBadge, { minWidth: 44, minHeight: 44 }]} onPress={() => router.push(notificationsRoute)}>
              <Ionicons name="notifications-outline" size={20} color={COLORS.white} />
              <Text style={styles.headerBadgeText}>{unreadNotifications === null ? 'Alertes' : unreadNotifications > 99 ? '99+' : unreadNotifications}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ─── Stats Cards ─────────────────────────────────────────── */}
        <View style={styles.statsGrid}>
          <SrmKpiCard
            icon="layers-outline"
            iconColor={COLORS.statBlue}
            iconBackground="#EFF6FF"
            label="Total"
            value={stats.total}
            onPress={() => openIncidents({})}
            style={styles.statCard}
          />
          <SrmKpiCard
            icon="alert-circle-outline"
            iconColor={COLORS.statRed}
            iconBackground="#FEF2F2"
            label="En cours"
            value={stats.open}
            valueColor={COLORS.statRed}
            onPress={() => openIncidents({ status: 'open' })}
            style={styles.statCard}
          />
          <SrmKpiCard
            icon="checkmark-circle-outline"
            iconColor={COLORS.statGreen}
            iconBackground="#F0FDF4"
            label="Clôturés"
            value={stats.closed}
            valueColor={COLORS.statGreen}
            onPress={() => openIncidents({ status: 'closed' })}
            style={styles.statCard}
          />
          <SrmKpiCard
            icon="warning-outline"
            iconColor={COLORS.statOrange}
            iconBackground="#FFFBEB"
            label="Réclamations"
            value={stats.reclamations}
            valueColor={COLORS.statOrange}
            onPress={() => openIncidents({ reclamation: 'true' })}
            style={styles.statCard}
          />
        </View>

        {/* ─── Resolution KPIs (30 days average / max) ─────────────── */}
        <TouchableOpacity
          style={styles.resolutionContainer}
          onPress={() => openIncidents({ status: 'closed', period: '30days' })}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Voir les incidents clôturés sur 30 jours"
        >
          <View style={styles.resolutionTitleRow}>
            <Text style={styles.sectionTitle}>Performance de clôture (30j)</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} />
          </View>
          <View style={styles.resolutionRow}>
            <View style={styles.resolutionKpi}>
              <DurationValue parts={durationPartsFromDays(resolutionStats.avgDays)} />
              <Text style={styles.resolutionLabel}>Durée moyenne</Text>
            </View>
            <View style={styles.resolutionKpiDivider} />
            <View style={styles.resolutionKpi}>
              <DurationValue parts={durationPartsFromDays(resolutionStats.maxDays)} />
              <Text style={styles.resolutionLabel}>Durée maximale</Text>
            </View>
          </View>
        </TouchableOpacity>

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
              <IncidentCard key={item.id} incident={item} onPress={setSelectedIncident} style={styles.incidentCard} />
            ))
          )}

          <TouchableOpacity
            style={styles.showMoreButton}
            onPress={() => router.push(incidentsRoute)}
          >
            <Text style={styles.showMoreText}>{"Voir plus d'incidents"}</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.primaryDark} />
          </TouchableOpacity>
        </View>

        {/* Bottom spacer for safe scroll area */}
        <View style={{ height: 32 }} />
      </ScrollView>

      <IncidentDetailSheet
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onUpdated={handleIncidentUpdated}
        onArchived={handleIncidentArchived}
      />
    </View>
  );
}

function DurationValue({ parts }: { parts: DurationPart[] }) {
  return (
    <Text style={styles.resolutionValue} numberOfLines={1} adjustsFontSizeToFit>
      {parts.map((part, index) => (
        <Text key={part.unit || index}>
          {index > 0 ? ' ' : ''}{part.value}
          {part.unit ? <Text style={styles.resolutionUnit}> {part.unit}</Text> : null}
        </Text>
      ))}
    </Text>
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
            <View key={index} style={styles.statCardSkeleton}>
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
    marginBottom: 12,
  },

  statCardSkeleton: {
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

  resolutionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  resolutionUnit: {
    fontSize: 14,
    fontWeight: '400',
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
  darkSkeletonBlock: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },
  dashboardSkeletonMetric: {
    flex: 1,
    marginBottom: 0,
    backgroundColor: COLORS.background,
  },
});
