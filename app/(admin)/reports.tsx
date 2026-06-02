import CustomBarChart from '@/components/CustomBarChart';
import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { ReportService, type IncidentReport, type ReportFilters } from '@/src/core/services/reportService';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface SelectOption {
  id: string;
  name: string;
}

const today = new Date();
const firstDayOfYear = `${today.getFullYear()}-01-01`;
const todayIso = today.toISOString().slice(0, 10);

export default function ReportsScreen() {
  const [startDate, setStartDate] = useState(firstDayOfYear);
  const [endDate, setEndDate] = useState(todayIso);
  const [communeId, setCommuneId] = useState('all');
  const [agentId, setAgentId] = useState('all');
  const [type, setType] = useState<'all' | 'BT' | 'MT'>('all');
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('all');
  const [reclamation, setReclamation] = useState<'all' | 'yes' | 'no'>('all');
  const [communes, setCommunes] = useState<SelectOption[]>([]);
  const [agents, setAgents] = useState<SelectOption[]>([]);
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  useEffect(() => {
    void loadOptions();
  }, []);

  const filters = useMemo<ReportFilters>(() => ({
    startDate,
    endDate,
    communeId: communeId === 'all' ? undefined : communeId,
    agentId: agentId === 'all' ? undefined : agentId,
    type: type === 'all' ? undefined : type,
    status: status === 'all' ? undefined : status,
    reclamation: reclamation === 'all' ? undefined : reclamation === 'yes',
  }), [agentId, communeId, endDate, reclamation, startDate, status, type]);

  const loadOptions = async () => {
    const [{ data: communeRows }, { data: agentRows }] = await Promise.all([
      supabase.from('communes').select('id, name').order('name'),
      supabase.from('user_profiles').select('id, name').order('name'),
    ]);

    setCommunes((communeRows || []).map(row => ({ id: row.id, name: row.name })));
    setAgents((agentRows || []).map(row => ({ id: row.id, name: row.name || 'Agent sans nom' })));
  };

  const generateReport = async () => {
    if (!isValidDate(startDate) || !isValidDate(endDate)) {
      Alert.alert('Dates invalides', 'Utilisez le format AAAA-MM-JJ.');
      return;
    }
    if (new Date(startDate) > new Date(endDate)) {
      Alert.alert('Période invalide', 'La date de début doit précéder la date de fin.');
      return;
    }

    setLoading(true);
    try {
      const nextReport = await ReportService.getIncidentReport(filters);
      setReport(nextReport);
    } catch (error) {
      Alert.alert('Erreur rapport', error instanceof Error ? error.message : 'Impossible de générer le rapport.');
    } finally {
      setLoading(false);
    }
  };

  const exportPdf = async () => {
    if (!report) return;
    setExporting('pdf');
    try {
      await ReportService.exportPdf(report);
    } catch (error) {
      Alert.alert('Export PDF', error instanceof Error ? error.message : 'Export impossible.');
    } finally {
      setExporting(null);
    }
  };

  const exportExcel = async () => {
    if (!report) return;
    setExporting('excel');
    try {
      await ReportService.exportExcel(report);
    } catch (error) {
      Alert.alert('Export Excel', error instanceof Error ? error.message : 'Export impossible.');
    } finally {
      setExporting(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>Archives administratives</Text>
            <Text style={styles.title}>Rapports</Text>
          </View>
          <Ionicons name="document-text-outline" size={28} color={COLORS.accent} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Période et filtres</Text>
          <View style={styles.dateRow}>
            <Field label="Début">
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="AAAA-MM-JJ"
                style={styles.input}
                autoCapitalize="none"
              />
            </Field>
            <Field label="Fin">
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="AAAA-MM-JJ"
                style={styles.input}
                autoCapitalize="none"
              />
            </Field>
          </View>

          <Select label="Commune" value={communeId} onValueChange={setCommuneId}>
            <Picker.Item label="Toutes les communes" value="all" />
            {communes.map(item => <Picker.Item key={item.id} label={item.name} value={item.id} />)}
          </Select>

          <Select label="Agent" value={agentId} onValueChange={setAgentId}>
            <Picker.Item label="Tous les agents" value="all" />
            {agents.map(item => <Picker.Item key={item.id} label={item.name} value={item.id} />)}
          </Select>

          <View style={styles.dateRow}>
            <Select label="Réseau" value={type} onValueChange={(value) => setType(value as 'all' | 'BT' | 'MT')}>
              <Picker.Item label="BT et MT" value="all" />
              <Picker.Item label="BT" value="BT" />
              <Picker.Item label="MT" value="MT" />
            </Select>
            <Select label="Statut" value={status} onValueChange={(value) => setStatus(value as 'all' | 'open' | 'closed')}>
              <Picker.Item label="Tous" value="all" />
              <Picker.Item label="En cours" value="open" />
              <Picker.Item label="Clôturé" value="closed" />
            </Select>
          </View>

          <Select label="Réclamation" value={reclamation} onValueChange={(value) => setReclamation(value as 'all' | 'yes' | 'no')}>
            <Picker.Item label="Toutes" value="all" />
            <Picker.Item label="Avec réclamation" value="yes" />
            <Picker.Item label="Sans réclamation" value="no" />
          </Select>

          <TouchableOpacity style={styles.primaryButton} onPress={generateReport} disabled={loading}>
            {loading ? <ActivityIndicator color={COLORS.textPrimary} /> : (
              <>
                <Ionicons name="analytics-outline" size={20} color={COLORS.textPrimary} />
                <Text style={styles.primaryButtonText}>Générer le rapport</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {report && (
          <>
            <View style={styles.kpiGrid}>
              <Kpi label="Total" value={report.summary.total} tone="blue" />
              <Kpi label="En cours" value={report.summary.open} tone="red" />
              <Kpi label="Clôturés" value={report.summary.closed} tone="green" />
              <Kpi label="Réclamations" value={report.summary.reclamations} tone="orange" />
              <Kpi label="GPS manquant" value={report.summary.missingGps} tone="orange" />
              <Kpi label="Photo manquante" value={report.summary.missingPhoto} tone="red" />
            </View>

            <View style={styles.panel}>
              <Text style={styles.sectionTitle}>Exports</Text>
              <View style={styles.exportRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={exportPdf} disabled={exporting !== null}>
                  {exporting === 'pdf' ? <ActivityIndicator color={COLORS.textPrimary} /> : <Ionicons name="print-outline" size={19} color={COLORS.textPrimary} />}
                  <Text style={styles.secondaryButtonText}>PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryButton} onPress={exportExcel} disabled={exporting !== null}>
                  {exporting === 'excel' ? <ActivityIndicator color={COLORS.textPrimary} /> : <Ionicons name="grid-outline" size={19} color={COLORS.textPrimary} />}
                  <Text style={styles.secondaryButtonText}>Excel</Text>
                </TouchableOpacity>
              </View>
            </View>

            <CustomBarChart
              title="Tendance mensuelle"
              data={report.breakdowns.monthly.map(item => ({ label: item.label.slice(5), value: item.value, frontColor: COLORS.signalBlue }))}
            />

            <Breakdown title="Communes" data={report.breakdowns.byCommune} />
            <Breakdown title="Agents" data={report.breakdowns.byAgent} />
            <Breakdown title="Types d'incidents" data={report.breakdowns.byIncidentType} />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function Select({
  label,
  value,
  onValueChange,
  children,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <Field label={label}>
      <View style={styles.pickerWrap}>
        <Picker selectedValue={value} onValueChange={onValueChange} style={styles.picker} dropdownIconColor={COLORS.textPrimary}>
          {children}
        </Picker>
      </View>
    </Field>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'red' | 'green' | 'orange' }) {
  const color = tone === 'blue' ? COLORS.signalBlue : tone === 'red' ? COLORS.signalRed : tone === 'green' ? COLORS.signalGreen : COLORS.signalOrange;
  const tint = tone === 'blue' ? COLORS.signalBlueTint : tone === 'red' ? COLORS.signalRedTint : tone === 'green' ? COLORS.signalGreenTint : COLORS.signalOrangeTint;
  return (
    <View style={styles.kpiCard}>
      <View style={[styles.kpiIcon, { backgroundColor: tint }]}>
        <Ionicons name="stats-chart-outline" size={17} color={color} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
    </View>
  );
}

function Breakdown({ title, data }: { title: string; data: { label: string; value: number }[] }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {data.length === 0 ? (
        <Text style={styles.emptyText}>Aucune donnée pour cette période.</Text>
      ) : data.slice(0, 8).map(item => (
        <View key={item.label} style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel} numberOfLines={1}>{item.label}</Text>
          <Text style={styles.breakdownValue}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime());
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: 110,
  },
  header: {
    backgroundColor: COLORS.textPrimary,
    borderRadius: RADIUS.lg,
    padding: SPACING.xl,
    marginBottom: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  kicker: {
    ...TYPOGRAPHY.labelUppercase,
    color: COLORS.accent,
    marginBottom: SPACING.xs,
  },
  title: {
    ...TYPOGRAPHY.display,
    color: COLORS.surface,
  },
  panel: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    ...TYPOGRAPHY.heading,
    color: COLORS.textPrimary,
    marginBottom: SPACING.md,
  },
  dateRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  field: {
    flex: 1,
    marginBottom: SPACING.md,
  },
  label: {
    ...TYPOGRAPHY.labelUppercase,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  input: {
    height: 50,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.sm,
    overflow: 'hidden',
    height: 50,
    justifyContent: 'center',
  },
  picker: {
    color: COLORS.textPrimary,
  },
  primaryButton: {
    height: 52,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  primaryButtonText: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
    textTransform: 'uppercase',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  kpiCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  kpiLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
  },
  kpiValue: {
    ...TYPOGRAPHY.display,
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
  },
  exportRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  secondaryButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  secondaryButtonText: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: SPACING.sm,
  },
  breakdownLabel: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textPrimary,
    flex: 1,
    marginRight: SPACING.md,
  },
  breakdownValue: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
  },
});
