import CustomBarChart from '@/components/CustomBarChart';
import { type ChartDataPoint, type DashboardStats } from '@/src/core/entities/admin';
import { AdminService } from '@/src/core/services/adminService';
import { supabase } from '@/lib/supabase';
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

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/(auth)/login');
    }
  };

  const fetchStats = async () => {
    try {
      const [newStats, chartPoints] = await Promise.all([
        AdminService.getDashboardStats(),
        AdminService.getMonthlyIncidents(new Date().getFullYear())
      ]);

      setStats(newStats);
      setMonthlyData(chartPoints);
    } catch (err) {
      console.error('Failed to fetch admin stats', err);
    } finally {
      setLoading(false);
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
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ─── Dark Header Section ─────────────────────────────────── */}
      <View style={styles.headerSection}>
        <View style={styles.headerInner}>
          <View>
            <Text style={styles.headerGreeting}>Admin Panel</Text>
            <Text style={styles.headerTitle}>Dashboard</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.headerBadge}>
              <Ionicons name="pulse" size={20} color={COLORS.primaryDark} />
              <Text style={styles.headerBadgeText}>Live</Text>
            </View>
            <TouchableOpacity
              onPress={handleSignOut}
              style={{
                width: 40,
                height: 40,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 20,
                justifyContent: 'center',
                alignItems: 'center'
              }}
            >
              <Ionicons name="log-out-outline" size={20} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ─── Stats Cards ─────────────────────────────────────────── */}
      <View style={styles.statsGrid}>
        {/* Total Incidents */}
        <View style={[styles.statCard, { borderLeftColor: COLORS.statBlue }]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#EFF6FF' }]}>
            <Ionicons name="layers-outline" size={20} color={COLORS.statBlue} />
          </View>
          <Text style={styles.statLabel}>Total Incidents</Text>
          <Text style={[styles.statValue, { color: COLORS.textPrimary }]}>
            {stats.total}
          </Text>
        </View>

        {/* Open Issues */}
        <View style={[styles.statCard, { borderLeftColor: COLORS.statRed }]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#FEF2F2' }]}>
            <Ionicons name="alert-circle-outline" size={20} color={COLORS.statRed} />
          </View>
          <Text style={styles.statLabel}>Open Issues</Text>
          <Text style={[styles.statValue, { color: COLORS.statRed }]}>
            {stats.open}
          </Text>
        </View>

        {/* Resolved */}
        <View style={[styles.statCard, { borderLeftColor: COLORS.statGreen }]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#F0FDF4' }]}>
            <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.statGreen} />
          </View>
          <Text style={styles.statLabel}>Resolved</Text>
          <Text style={[styles.statValue, { color: COLORS.statGreen }]}>
            {stats.closed}
          </Text>
        </View>

        {/* Reclamations */}
        <View style={[styles.statCard, { borderLeftColor: COLORS.statOrange }]}>
          <View style={[styles.statIconContainer, { backgroundColor: '#FFFBEB' }]}>
            <Ionicons name="warning-outline" size={20} color={COLORS.statOrange} />
          </View>
          <Text style={styles.statLabel}>Reclamations</Text>
          <Text style={[styles.statValue, { color: COLORS.statOrange }]}>
            {stats.reclamations}
          </Text>
        </View>
      </View>

      {/* ─── Charts ──────────────────────────────────────────────── */}
      <View style={styles.chartContainer}>
        <CustomBarChart data={monthlyData} title="Monthly Incidents" />
      </View>

      {/* ─── Quick Actions ───────────────────────────────────────── */}
      <View style={styles.quickActionsSection}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(admin)/incidents')}
          activeOpacity={0.7}
        >
          <View style={styles.actionCardLeft}>
            <View style={[styles.actionIconContainer, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="construct-outline" size={22} color={COLORS.statBlue} />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>Manage Incidents</Text>
              <Text style={styles.actionSubtitle}>View and update all incidents</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/(admin)/users')}
          activeOpacity={0.7}
        >
          <View style={styles.actionCardLeft}>
            <View style={[styles.actionIconContainer, { backgroundColor: '#F5F3FF' }]}>
              <Ionicons name="people-outline" size={22} color="#8B5CF6" />
            </View>
            <View style={styles.actionTextContainer}>
              <Text style={styles.actionTitle}>User Management</Text>
              <Text style={styles.actionSubtitle}>Manage team members and roles</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Bottom spacer for safe scroll area */}
      <View style={{ height: 32 }} />
    </ScrollView>
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
    backgroundColor: COLORS.background,
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
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.white,
    letterSpacing: -0.5,
  },

  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },

  headerBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primaryDark,
  },

  // ── Stats Grid ──
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: -12,
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
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },

  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    letterSpacing: 0.3,
    marginBottom: 4,
  },

  statValue: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // ── Chart ──
  chartContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  // ── Quick Actions ──
  quickActionsSection: {
    paddingHorizontal: 16,
    marginTop: 24,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 12,
  },

  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBg,
    padding: 16,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },

  actionCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },

  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },

  actionTextContainer: {
    flex: 1,
  },

  actionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },

  actionSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: COLORS.textSecondary,
  },
});
