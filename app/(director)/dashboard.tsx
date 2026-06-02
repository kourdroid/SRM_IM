import { clearLocalSupabaseSession } from '@/lib/supabase';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { DirectorService, type DirectorDashboardMetrics, type DirectorIncident } from '@/src/core/services/directorService';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DirectorDashboard() {
  const [metrics, setMetrics] = useState<DirectorDashboardMetrics | null>(null);
  const [latestIncidents, setLatestIncidents] = useState<DirectorIncident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [nextMetrics, nextIncidents] = await Promise.all([
        DirectorService.getDashboardMetrics(),
        DirectorService.getLatestOpenIncidents(5),
      ]);
      setMetrics(nextMetrics);
      setLatestIncidents(nextIncidents);
    } catch (error) {
      Alert.alert('Lecture impossible', error instanceof Error ? error.message : 'Impossible de charger les données.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearLocalSupabaseSession();
    router.replace('/(auth)/login');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>LECTURE SEULE</Text>
            <Text style={styles.title}>Direction</Text>
          </View>
          <TouchableOpacity style={styles.headerAction} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.surface} />
          </TouchableOpacity>
        </View>

        {loading || !metrics ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator color={COLORS.textPrimary} />
            <Text style={styles.loadingText}>Chargement des indicateurs...</Text>
          </View>
        ) : (
          <>
            <View style={styles.kpiGrid}>
              <Kpi label="Total" value={metrics.total} icon="albums-outline" tone="blue" />
              <Kpi label="Ouverts" value={metrics.open} icon="alert-circle-outline" tone="red" />
              <Kpi label="Clôturés" value={metrics.closed} icon="checkmark-done-outline" tone="green" />
              <Kpi label="Réclamations" value={metrics.reclamations} icon="megaphone-outline" tone="orange" />
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Délais de traitement</Text>
                <Ionicons name="time-outline" size={20} color={COLORS.textSecondary} />
              </View>
              <View style={styles.timeRow}>
                <TimeMetric label="Moyenne clôture" value={`${metrics.avgClosureDays.toFixed(1)} j`} />
                <TimeMetric label="Plus ancien ouvert" value={`${Math.round(metrics.longestOpenHours)} h`} />
              </View>
            </View>

            <View style={styles.panel}>
              <View style={styles.panelHeader}>
                <Text style={styles.panelTitle}>Incidents ouverts récents</Text>
                <TouchableOpacity onPress={() => router.push('/(director)/incidents')}>
                  <Text style={styles.linkText}>Tout voir</Text>
                </TouchableOpacity>
              </View>

              {latestIncidents.length === 0 ? (
                <Text style={styles.emptyText}>Aucun incident ouvert.</Text>
              ) : (
                latestIncidents.map((incident) => (
                  <TouchableOpacity
                    key={incident.id}
                    style={styles.incidentRow}
                    onPress={() => router.push('/(director)/incidents')}
                  >
                    <View style={styles.statusDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.incidentTitle} numberOfLines={1}>
                        {incident.title || `${incident.type} - ${incident.village}`}
                      </Text>
                      <Text style={styles.incidentMeta} numberOfLines={1}>
                        {incident.commune_name || 'Commune inconnue'} · {formatDate(incident.created_at)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
                  </TouchableOpacity>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number;
  icon: keyof typeof Ionicons.glyphMap;
  tone: 'blue' | 'red' | 'green' | 'orange';
}) {
  const color = getToneColor(tone);
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={20} color={color} />
      </View>
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function TimeMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.timeMetric}>
      <Text style={styles.timeValue}>{value}</Text>
      <Text style={styles.timeLabel}>{label}</Text>
    </View>
  );
}

function getToneColor(tone: 'blue' | 'red' | 'green' | 'orange'): string {
  if (tone === 'red') return COLORS.signalRed;
  if (tone === 'green') return COLORS.signalGreen;
  if (tone === 'orange') return COLORS.signalOrange;
  return COLORS.signalBlue;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 110,
  },
  header: {
    backgroundColor: COLORS.textPrimary,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xxl,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kicker: {
    ...TYPOGRAPHY.label,
    color: COLORS.accent,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  title: {
    ...TYPOGRAPHY.display,
    color: COLORS.surface,
    marginTop: 4,
  },
  headerAction: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingPanel: {
    margin: SPACING.xl,
    padding: SPACING.xxl,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    padding: SPACING.xl,
  },
  kpiCard: {
    width: '47.5%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  kpiIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  kpiValue: {
    ...TYPOGRAPHY.display,
    color: COLORS.textPrimary,
  },
  kpiLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  panel: {
    marginHorizontal: SPACING.xl,
    marginBottom: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  panelTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
  },
  linkText: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
  },
  timeRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  timeMetric: {
    flex: 1,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    padding: SPACING.md,
  },
  timeValue: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
  },
  timeLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
  incidentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.signalRed,
  },
  incidentTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  incidentMeta: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
});
