import { useAuth } from '@/contexts/AuthContext';
import IncidentCard from '@/components/incidents/IncidentCard';
import IncidentDetailSheet from '@/components/incidents/IncidentDetailSheet';
import { SrmBottomSheet, SrmListSkeleton } from '@/components/ui/srm';
import { supabase } from '@/lib/supabase';
import { IncidentAdminService, type Incident, type IncidentFilters } from '@/src/core/services/incidentAdminService';
import { acknowledgeAdminNotification } from '@/src/core/services/adminNotificationService';
import { router, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

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

type StatusFilter = 'open' | 'closed' | 'all';
type DatePreset = 'all' | 'today' | '7days' | '30days';

const parseStatusFilter = (value?: string): StatusFilter => value === 'open' || value === 'closed' ? value : 'all';
const parseDatePreset = (value?: string): DatePreset => value === 'today' || value === '7days' || value === '30days' ? value : 'all';
const DATE_PRESET_LABELS: Record<DatePreset, string> = { all: 'Toujours', today: "Aujourd'hui", '7days': '7j', '30days': '30j' };

export default function SupervisionIncidentsScreen() {
  const { isAdmin } = useAuth();
  const {
    incidentId,
    notificationId,
    status: statusParam,
    reclamation: reclamationParam,
    period: periodParam,
    filterAt,
  } = useLocalSearchParams<{
    incidentId?: string;
    notificationId?: string;
    status?: string;
    reclamation?: string;
    period?: string;
    filterAt?: string;
  }>();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>(() => parseStatusFilter(statusParam));
  const [type, setType] = useState<'BT' | 'MT' | 'all'>('all');
  const [communeId, setCommuneId] = useState<string>('all');
  const [reclamation, setReclamation] = useState<boolean | undefined>(reclamationParam === 'true' ? true : undefined);
  const [datePreset, setDatePreset] = useState<DatePreset>(() => parseDatePreset(periodParam));
  const [agentId, setAgentId] = useState<string>('all');
  const [hasGps, setHasGps] = useState<boolean | undefined>(undefined);
  const [hasMedia, setHasMedia] = useState<boolean | undefined>(undefined);

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [communes, setCommunes] = useState<{ id: string; name: string }[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string | null }[]>([]);
  const [showCommuneModal, setShowCommuneModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const appliedFilterAt = useRef(filterAt);
  const latestLoad = useRef(0);

  const handleIncidentUpdated = (id: string, patch: Partial<Incident>) => {
    setIncidents(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));
    setSelectedIncident(prev => prev && prev.id === id ? { ...prev, ...patch } : prev);
  };

  const handleIncidentArchived = (id: string) => {
    setIncidents(prev => prev.filter(i => i.id !== id));
    setSelectedIncident(null);
  };

  useEffect(() => {
    loadInitial();
    // Search is handled by the debounced effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type, communeId, reclamation, datePreset, agentId, hasGps, hasMedia, reloadKey]);

  // A dashboard KPI opens this screen on exactly what it counted, whatever was filtered before.
  useEffect(() => {
    if (!filterAt || filterAt === appliedFilterAt.current) return;
    appliedFilterAt.current = filterAt;
    setStatus(parseStatusFilter(statusParam));
    setReclamation(reclamationParam === 'true' ? true : undefined);
    setDatePreset(parseDatePreset(periodParam));
    setType('all');
    setCommuneId('all');
    setAgentId('all');
    setHasGps(undefined);
    setHasMedia(undefined);
    setSearch('');
    setIncidents([]);
    setReloadKey(key => key + 1);
  }, [filterAt, statusParam, reclamationParam, periodParam]);

  useEffect(() => {
    fetchCommunes();
    fetchAgents();
  }, []);

  // Debounced search trigger
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadInitial();
    }, 400);
    return () => clearTimeout(delayDebounce);
    // Keep search debounce isolated from the other filter effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const fetchCommunes = async () => {
    try {
      const { data, error } = await supabase.from('communes').select('id, name').order('name');
      if (error) throw error;
      if (data) setCommunes(data);
    } catch (e) {
      console.error('Failed to load communes:', e);
    }
  };

  const getDateRange = () => {
    let startDate: string | undefined = undefined;
    const endDate = new Date().toISOString().split('T')[0];

    if (datePreset === 'today') {
      startDate = new Date().toISOString().split('T')[0];
    } else if (datePreset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      startDate = d.toISOString().split('T')[0];
    } else if (datePreset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startDate = d.toISOString().split('T')[0];
    }

    return { startDate, endDate: startDate ? endDate : undefined };
  };

  const buildFilters = (): IncidentFilters => {
    const { startDate, endDate } = getDateRange();
    return {
      status,
      type,
      communeId,
      reclamation,
      startDate,
      endDate,
      agentId,
      hasGps,
      hasMedia,
      search: search.trim() !== '' ? search : undefined,
    };
  };

  const loadInitial = async () => {
    const load = ++latestLoad.current;
    setLoading(true);
    try {
      const activeFilters = buildFilters();
      const data = await IncidentAdminService.getIncidents(15, undefined, activeFilters);
      if (load === latestLoad.current) setIncidents(data);
    } catch (e) {
      if (load === latestLoad.current) Alert.alert('Erreur', String(e));
    } finally {
      if (load === latestLoad.current) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const activeFilters = buildFilters();
      const data = await IncidentAdminService.getIncidents(15, undefined, activeFilters);
      setIncidents(data);
    } catch (e) {
      console.error(e);
    } finally {
      setRefreshing(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || incidents.length === 0) return;
    setLoadingMore(true);
    try {
      const last = incidents[incidents.length - 1];
      const activeFilters = buildFilters();
      const data = await IncidentAdminService.getIncidents(15, { createdAt: last.created_at, id: last.id }, activeFilters);
      if (data.length > 0) {
        setIncidents(prev => [...prev, ...data]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const getCommuneName = (id: string) => {
    if (id === 'all') return 'Toutes les Communes';
    const comm = communes.find(c => c.id === id);
    return comm ? comm.name : 'Commune Inconnue';
  };

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_supervision_profiles')
        .order('name');
      if (error) throw error;
      setAgents(data || []);
    } catch (e) {
      console.error('Failed to load agents:', e);
    }
  };

  const getAgentName = (id: string) => {
    if (id === 'all') return 'Tous les Agents';
    const agent = agents.find(a => a.id === id);
    return agent?.name || 'Agent inconnu';
  };

  const openIncidentDetails = useCallback((incident: Incident) => {
    setSelectedIncident(incident);
  }, []);

  useEffect(() => {
    if (!incidentId) return;
    let active = true;
    const openNotificationIncident = async () => {
      try {
        const id = z.uuid().parse(incidentId);
        const results = await IncidentAdminService.getIncidents(1, undefined, { incidentId: id });
        if (!active) return;
        if (!results[0]) throw new Error('Cet incident est indisponible ou votre accès a changé.');
        openIncidentDetails(results[0]);
        // Opening the incident is the read signal: it clears the unread count and cancels the reminder push.
        if (notificationId) void acknowledgeAdminNotification(z.uuid().parse(notificationId)).catch(() => undefined);
      } catch {
        if (active) Alert.alert('Notification', 'Impossible d’ouvrir cette notification. Vérifiez votre connexion et réessayez depuis la liste des notifications.');
      } finally {
        if (active) router.setParams({ incidentId: '', notificationId: '' });
      }
    };
    void openNotificationIncident();
    return () => { active = false; };
  }, [incidentId, notificationId, openIncidentDetails]);

  // Prevent unnecessary re-renders in FlashList/FlatList by memoizing the renderItem callback
  const renderItem = useCallback(({ item }: { item: Incident }) => (
    <IncidentCard incident={item} onPress={openIncidentDetails} style={styles.card} />
  ), [openIncidentDetails]);

  // Prevent unnecessary re-renders in FlashList/FlatList by memoizing the renderItem callback
  const renderAgentItem = useCallback(({ item }: { item: { id: string; name: string | null } }) => (
    <TouchableOpacity
      style={[
        styles.communeRow,
        agentId === item.id && styles.communeRowActive
      ]}
      onPress={() => {
        setAgentId(item.id);
        setShowAgentModal(false);
      }}
    >
      <Text style={[
        styles.communeRowText,
        agentId === item.id && styles.communeRowTextActive
      ]}>
        {item.name || 'Agent inconnu'}
      </Text>
      {agentId === item.id && (
        <Ionicons name="checkmark" size={20} color={COLORS.primaryDark} />
      )}
    </TouchableOpacity>
  ), [agentId]);

  // Prevent unnecessary re-renders in FlashList/FlatList by memoizing the renderItem callback
  const renderCommuneItem = useCallback(({ item }: { item: { id: string; name: string } }) => (
    <TouchableOpacity
      style={[
        styles.communeRow,
        communeId === item.id && styles.communeRowActive
      ]}
      onPress={() => {
        setCommuneId(item.id);
        setShowCommuneModal(false);
      }}
    >
      <Text style={[
        styles.communeRowText,
        communeId === item.id && styles.communeRowTextActive
      ]}>
        {item.name}
      </Text>
      {communeId === item.id && (
        <Ionicons name="checkmark" size={20} color={COLORS.primaryDark} />
      )}
    </TouchableOpacity>
  ), [communeId]);

  const activeFilters = [
    status === 'open' ? 'En cours' : status === 'closed' ? 'Clôturés' : null,
    type !== 'all' ? type : null,
    datePreset !== 'all' ? DATE_PRESET_LABELS[datePreset] : null,
    reclamation === true ? 'Réclamations' : reclamation === false ? 'Rapports standards' : null,
    communeId !== 'all' ? getCommuneName(communeId) : null,
    agentId !== 'all' ? getAgentName(agentId) : null,
    hasGps === false ? 'GPS manquant' : null,
    hasMedia === false ? 'Photo manquante' : null,
  ].filter((label): label is string => label !== null);

  const clearFilters = () => {
    setStatus('all');
    setType('all');
    setDatePreset('all');
    setReclamation(undefined);
    setCommuneId('all');
    setAgentId('all');
    setHasGps(undefined);
    setHasMedia(undefined);
  };

  return (
    <View style={styles.container}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des Incidents</Text>
        <Text style={styles.headerSubtitle}>{isAdmin ? 'Supervision et clôture des rapports' : 'Administrateur'}</Text>
      </View>

      {/* ─── Search & Toggle Filters Bar ────────────────────────── */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputWrapper}>
          <Ionicons name="search" size={20} color={COLORS.textSecondary} />
          <TextInput
            placeholder="Rechercher village ou description..."
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor={COLORS.textMuted}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="funnel-outline" size={20} color={showFilters ? COLORS.primaryDark : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ─── Collapsible Filter Panel ───────────────────────────── */}
      {showFilters && (
        <ScrollView style={styles.filterPanel} showsVerticalScrollIndicator={false}>
          {/* Status filter */}
          <Text style={styles.filterSectionTitle}>Statut</Text>
          <View style={styles.chipsRow}>
            {(['all', 'open', 'closed'] as const).map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.chip, status === s && styles.chipActive]}
                onPress={() => setStatus(s)}
              >
                <Text style={[styles.chipLabel, status === s && styles.chipLabelActive]}>
                  {s === 'all' ? 'Tous' : s === 'open' ? 'En cours' : 'Clôturés'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Network Type filter */}
          <Text style={styles.filterSectionTitle}>Réseau</Text>
          <View style={styles.chipsRow}>
            {(['all', 'BT', 'MT'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, type === t && styles.chipActive]}
                onPress={() => setType(t)}
              >
                <Text style={[styles.chipLabel, type === t && styles.chipLabelActive]}>
                  {t === 'all' ? 'Tous' : t}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Date presets */}
          <Text style={styles.filterSectionTitle}>Période de création</Text>
          <View style={styles.chipsRow}>
            {(['all', 'today', '7days', '30days'] as const).map((d) => (
              <TouchableOpacity
                key={d}
                style={[styles.chip, datePreset === d && styles.chipActive]}
                onPress={() => setDatePreset(d)}
              >
                <Text style={[styles.chipLabel, datePreset === d && styles.chipLabelActive]}>
                  {d === 'all' ? 'Toujours' : d === 'today' ? "Aujourd'hui" : d === '7days' ? '7j' : '30j'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Reclamation filter */}
          <Text style={styles.filterSectionTitle}>Type de Fiche</Text>
          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.chip, reclamation === undefined && styles.chipActive]}
              onPress={() => setReclamation(undefined)}
            >
              <Text style={[styles.chipLabel, reclamation === undefined && styles.chipLabelActive]}>Tous</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, reclamation === false && styles.chipActive]}
              onPress={() => setReclamation(false)}
            >
              <Text style={[styles.chipLabel, reclamation === false && styles.chipLabelActive]}>Rapports Standards</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, reclamation === true && styles.chipActive]}
              onPress={() => setReclamation(true)}
            >
              <Text style={[styles.chipLabel, reclamation === true && styles.chipLabelActive]}>Réclamations Seules</Text>
            </TouchableOpacity>
          </View>

          {/* Commune Selector Button */}
          <Text style={styles.filterSectionTitle}>Commune</Text>
          <TouchableOpacity
            style={styles.communeSelectorButton}
            onPress={() => setShowCommuneModal(true)}
          >
            <Text style={styles.communeSelectorButtonText}>
              {getCommuneName(communeId)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.filterSectionTitle}>Agent</Text>
          <TouchableOpacity
            style={styles.communeSelectorButton}
            onPress={() => setShowAgentModal(true)}
          >
            <Text style={styles.communeSelectorButtonText}>
              {getAgentName(agentId)}
            </Text>
            <Ionicons name="chevron-down" size={16} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <Text style={styles.filterSectionTitle}>Qualité du Rapport</Text>
          <View style={styles.chipsRow}>
            <TouchableOpacity
              style={[styles.chip, hasGps === undefined && hasMedia === undefined && styles.chipActive]}
              onPress={() => {
                setHasGps(undefined);
                setHasMedia(undefined);
              }}
            >
              <Text style={[styles.chipLabel, hasGps === undefined && hasMedia === undefined && styles.chipLabelActive]}>Tous</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, hasGps === false && styles.chipActive]}
              onPress={() => setHasGps(false)}
            >
              <Text style={[styles.chipLabel, hasGps === false && styles.chipLabelActive]}>GPS manquant</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, hasMedia === false && styles.chipActive]}
              onPress={() => setHasMedia(false)}
            >
              <Text style={[styles.chipLabel, hasMedia === false && styles.chipLabelActive]}>Photo manquante</Text>
            </TouchableOpacity>
          </View>

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {!showFilters && activeFilters.length > 0 ? (
        <View style={styles.activeFilters}>
          <Ionicons name="funnel" size={14} color={COLORS.textSecondary} />
          <Text style={styles.activeFiltersText} numberOfLines={1}>{activeFilters.join(' · ')}</Text>
          <TouchableOpacity onPress={clearFilters} style={styles.activeFiltersClear} accessibilityRole="button">
            <Text style={styles.activeFiltersClearText}>Effacer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* ─── Incidents List ─────────────────────────────────────── */}
      {loading && incidents.length === 0 ? (
        <SrmListSkeleton count={7} style={styles.skeletonList} />
      ) : (
        <FlashList
          data={incidents}
          renderItem={renderItem}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          onRefresh={handleRefresh}
          refreshing={refreshing}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>Aucun incident ne correspond aux filtres</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footerLoader} /> : null
          }
        />
      )}

      {/* ─── Commune Selection Modal ────────────────────────────── */}
      <SrmBottomSheet
        visible={showCommuneModal}
        title="Sélectionner la Commune"
        onClose={() => setShowCommuneModal(false)}
        animationType="fade"
        scrollable={false}
        minHeight="40%"
      >
        <FlatList
          data={[{ id: 'all', name: 'Toutes les Communes' }, ...communes]}
          keyExtractor={(item) => item.id}
          renderItem={renderCommuneItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </SrmBottomSheet>

      <SrmBottomSheet
        visible={showAgentModal}
        title="Sélectionner l'Agent"
        onClose={() => setShowAgentModal(false)}
        animationType="fade"
        scrollable={false}
        minHeight="40%"
      >
        <FlatList
          data={[{ id: 'all', name: 'Tous les Agents' }, ...agents]}
          keyExtractor={(item) => item.id}
          renderItem={renderAgentItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </SrmBottomSheet>

      <IncidentDetailSheet
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onUpdated={handleIncidentUpdated}
        onArchived={handleIncidentArchived}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  skeletonList: {
    flex: 1,
    paddingTop: 10,
  },

  // ── Header ──
  header: {
    backgroundColor: COLORS.primaryDark,
    paddingTop: Platform.OS === 'ios' ? 60 : 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },

  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.white,
  },

  headerSubtitle: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginTop: 2,
    fontWeight: '500',
  },

  // ── Search Bar ──
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    gap: 10,
  },

  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
    fontWeight: '600',
  },

  filterToggleBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
  },

  filterToggleBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },

  // ── Filter Panel ──
  filterPanel: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.cardBorder,
    maxHeight: 300,
  },

  filterSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },

  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  chipActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },

  chipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  chipLabelActive: {
    color: COLORS.accent,
  },

  communeSelectorButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    borderRadius: 8,
    marginTop: 4,
    backgroundColor: '#F9FAFB',
  },

  communeSelectorButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  // ── Incidents List ──
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
  },

  footerLoader: {
    marginVertical: 16,
  },

  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
  },

  communeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },

  communeRowActive: {
    backgroundColor: '#F9FAFB',
  },

  communeRowText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  communeRowTextActive: {
    fontWeight: '800',
  },

  separator: {
    height: 1,
    backgroundColor: '#F3F4F6',
  },

  activeFilters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 4,
    paddingLeft: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    backgroundColor: COLORS.cardBg,
  },

  activeFiltersText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  activeFiltersClear: {
    minHeight: 44,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },

  activeFiltersClearText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
});
