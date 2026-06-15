import { SrmListSkeleton } from '@/components/ui/srm';
import {
  buildEquipmentSummary,
  createEmptyMaterialFormRow,
  normalizeMaterialRows,
  type MaterialFormRow,
} from '@/lib/materials';
import { supabase } from '@/lib/supabase';
import { IncidentAdminService, type Incident, type IncidentFilters } from '@/src/core/services/incidentAdminService';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
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

export default function ManageIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Filters State
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'open' | 'closed' | 'all'>('all');
  const [type, setType] = useState<'BT' | 'MT' | 'all'>('all');
  const [communeId, setCommuneId] = useState<string>('all');
  const [reclamation, setReclamation] = useState<boolean | undefined>(undefined);
  const [datePreset, setDatePreset] = useState<'all' | 'today' | '7days' | '30days'>('all');
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
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [showClosureMaterials, setShowClosureMaterials] = useState(false);
  const [closureMaterialRows, setClosureMaterialRows] = useState<MaterialFormRow[]>([createEmptyMaterialFormRow()]);
  const [isClosingIncident, setIsClosingIncident] = useState(false);

  useEffect(() => {
    loadInitial();
    // Search is handled by the debounced effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type, communeId, reclamation, datePreset, agentId, hasGps, hasMedia]);

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
    setLoading(true);
    try {
      const activeFilters = buildFilters();
      const data = await IncidentAdminService.getIncidents(15, undefined, activeFilters);
      setIncidents(data);
    } catch (e) {
      Alert.alert('Erreur', String(e));
    } finally {
      setLoading(false);
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
      const data = await IncidentAdminService.getIncidents(15, last.created_at, activeFilters);
      if (data.length > 0) {
        setIncidents(prev => [...prev, ...data]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleToggleStatus = async (item: Incident) => {
    const newStatus = item.status === 'open' ? 'closed' : 'open';
    const existingMaterials = item.materials || [];
    const normalizedMaterials = normalizeMaterialRows(closureMaterialRows);
    if (item.status === 'open' && existingMaterials.length === 0 && !showClosureMaterials) {
      setShowClosureMaterials(true);
      return;
    }
    if (item.status === 'open' && normalizedMaterials === null) {
      Alert.alert('Matériel invalide', 'Chaque ligne de matériel doit avoir un nom et une quantité positive.');
      return;
    }
    if (item.status === 'open' && existingMaterials.length === 0 && (normalizedMaterials?.length ?? 0) === 0) {
      Alert.alert('Matériel requis', "Ajoutez au moins un matériel utilisé pour clôturer l'incident.");
      return;
    }
    const closureMaterials = normalizedMaterials ?? [];

    try {
      setIsClosingIncident(true);
      const nextMaterials = item.status === 'open' && closureMaterials.length > 0
        ? closureMaterials.map(material => ({
          material_name: material.material_name,
          quantity: material.quantity,
        }))
        : existingMaterials;
      const nextEquipmentUsed = closureMaterials.length > 0
        ? buildEquipmentSummary(closureMaterials)
        : item.equipment_used;

      if (item.status === 'open' && closureMaterials.length > 0) {
        await IncidentAdminService.closeIncidentWithMaterials({
          id: item.id,
          materials: closureMaterials,
        });
      } else {
        await IncidentAdminService.updateIncidentStatus({ id: item.id, status: newStatus });
      }

      setIncidents(prev => prev.map(i => i.id === item.id ? {
        ...i,
        status: newStatus,
        materials: nextMaterials,
        equipment_used: nextEquipmentUsed,
        materials_summary: nextEquipmentUsed,
      } : i));
      if (selectedIncident?.id === item.id) {
        setSelectedIncident(prev => prev ? {
          ...prev,
          status: newStatus,
          materials: nextMaterials,
          equipment_used: nextEquipmentUsed,
          materials_summary: nextEquipmentUsed,
        } : null);
      }
      setShowClosureMaterials(false);
      setClosureMaterialRows([createEmptyMaterialFormRow()]);
      Alert.alert('Succès', `Incident ${newStatus === 'closed' ? 'clôturé' : 'rouvert'}.`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes('NETWORK_OFFLINE')) {
        Alert.alert('Action Hors Ligne Bloquée', 'Les mutations administrateur requièrent une connexion internet active.');
      } else {
        Alert.alert('Erreur', message);
      }
    } finally {
      setIsClosingIncident(false);
    }
  };

  const openIncidentMap = (incident: Incident) => {
    if (incident.latitude == null || incident.longitude == null) return;
    const query = `${incident.latitude},${incident.longitude}`;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  const formatIncidentAge = (incident: Incident) => {
    const end = incident.closed_at || new Date().toISOString();
    return formatDurationBetween(incident.created_at, end);
  };

  const getCommuneName = (id: string) => {
    if (id === 'all') return 'Toutes les Communes';
    const comm = communes.find(c => c.id === id);
    return comm ? comm.name : 'Commune Inconnue';
  };

  const fetchAgents = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, name')
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

  const renderItem = ({ item }: { item: Incident }) => {
    const isOpen = item.status === 'open';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => openIncidentDetails(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardContent}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={styles.typeBadge}>
              <Text style={styles.typeBadgeText}>{item.type}</Text>
            </View>
            <Text style={styles.date}>
              {new Date(item.created_at).toLocaleDateString()}
            </Text>
          </View>
          <Text style={styles.incidentTypeTitle} numberOfLines={1}>
            {item.title || item.incident_type}
          </Text>
          <Text style={styles.description} numberOfLines={2}>
            {item.description || 'Aucune description fournie.'}
          </Text>
          
          <View style={styles.locationContainer}>
            <Ionicons name="navigate-outline" size={13} color={COLORS.textSecondary} />
            <Text style={styles.locationText}>
              {item.commune_name} • {item.village}
            </Text>
          </View>

          <View style={styles.cardFooter}>
            <Text style={styles.createdBy}>
              Par: {item.created_by_name || 'Agent Terrain'}
            </Text>
            {item.reclamation && (
              <View style={styles.reclamationBadge}>
                <Text style={styles.reclamationBadgeText}>RÉC</Text>
              </View>
            )}
          </View>
        </View>

        <View
          style={[styles.statusBadge, isOpen ? styles.statusOpen : styles.statusClosed]}
        >
          <Text style={[styles.statusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
            {isOpen ? 'EN COURS' : 'CLÔTURÉ'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* ─── Header ────────────────────────────────────────────── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Gestion des Incidents</Text>
        <Text style={styles.headerSubtitle}>Supervision et clôture des rapports</Text>
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
      <Modal
        visible={showCommuneModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowCommuneModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.communeModalContainer}>
            <View style={styles.communeModalHeader}>
              <Text style={styles.communeModalTitle}>Sélectionner la Commune</Text>
              <TouchableOpacity onPress={() => setShowCommuneModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: 'all', name: 'Toutes les Communes' }, ...communes]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
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
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showAgentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAgentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.communeModalContainer}>
            <View style={styles.communeModalHeader}>
              <Text style={styles.communeModalTitle}>Sélectionner l&apos;Agent</Text>
              <TouchableOpacity onPress={() => setShowAgentModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={[{ id: 'all', name: 'Tous les Agents' }, ...agents]}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
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
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>

      {/* ─── Incident Detail Modal ─────────────────────────────── */}
      <Modal
        visible={selectedIncident !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedIncident(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModalContainer}>
            {selectedIncident && (
              <>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeBadgeText}>{selectedIncident.type}</Text>
                    </View>
                    <Text style={styles.detailModalTitle} numberOfLines={1}>
                      {selectedIncident.title || 'Fiche Incident'}
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
                      styles.modalStatusBadge,
                      { backgroundColor: selectedIncident.status === 'open' ? '#FEF2F2' : '#F0FDF4' }
                    ]}>
                      <Text style={[
                        styles.modalStatusBadgeText,
                        { color: selectedIncident.status === 'open' ? COLORS.statRed : COLORS.statGreen }
                      ]}>
                        {selectedIncident.status === 'open' ? 'EN COURS' : 'CLÔTURÉ'}
                      </Text>
                    </View>
                    <Text style={styles.modalDateText}>
                      Rapporté le {new Date(selectedIncident.created_at).toLocaleString()}
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
                    <Text style={styles.detailValue}>{selectedIncident.created_by_name || 'Agent de terrain'}</Text>
                  </View>

                  {selectedIncident.status === 'closed' && (
                    <>
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
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Durée de traitement</Text>
                        <Text style={styles.detailValue}>{formatIncidentAge(selectedIncident)}</Text>
                      </View>
                    </>
                  )}

                  {selectedIncident.status === 'open' && (
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Ouvert depuis</Text>
                      <Text style={styles.detailValue}>{formatIncidentAge(selectedIncident)}</Text>
                    </View>
                  )}

                  {/* Equipment */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Matériel requis/utilisé</Text>
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

                  {/* Reclamation Details */}
                  {selectedIncident.reclamation && (
                    <View style={styles.reclamationDetailsBlock}>
                      <Text style={styles.reclamationDetailsTitle}>Informations Réclamation</Text>
                      <View style={{ marginTop: 8 }}>
                        <Text style={styles.reclamationTextItem}>
                          <Text style={{ fontWeight: 'bold' }}>Nom du réclamant: </Text>
                          {selectedIncident.reclamation_name || 'Non spécifié'}
                        </Text>
                        <Text style={styles.reclamationTextItem}>
                          <Text style={{ fontWeight: 'bold' }}>Déposée par: </Text>
                          {selectedIncident.reclamation_by || 'Non spécifié'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {/* Media attachments */}
                  {selectedIncident.media_urls && selectedIncident.media_urls.length > 0 && (
                    <View style={{ marginTop: 16, marginBottom: 24 }}>
                      <Text style={styles.detailLabel}>Photos Jointes ({selectedIncident.media_urls.length})</Text>
                      <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                        {selectedIncident.media_urls.map((url, i) => (
                          <TouchableOpacity key={url || i} onPress={() => setSelectedPhotoUrl(url)}>
                          <Image
                            source={{ uri: url }}
                            style={styles.attachmentThumbnail}
                            contentFit="cover"
                          />
                          </TouchableOpacity>
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
                    onPress={() => handleToggleStatus(selectedIncident)}
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

      <Modal
        visible={selectedPhotoUrl !== null}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedPhotoUrl(null)}
      >
        <View style={styles.photoViewerOverlay}>
          <TouchableOpacity
            style={styles.photoViewerClose}
            onPress={() => setSelectedPhotoUrl(null)}
          >
            <Ionicons name="close" size={26} color={COLORS.white} />
          </TouchableOpacity>
          {selectedPhotoUrl && (
            <Image
              source={{ uri: selectedPhotoUrl }}
              style={styles.photoViewerImage}
              contentFit="contain"
            />
          )}
        </View>
      </Modal>
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
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: {
        elevation: 1,
      },
    }),
  },

  cardContent: {
    flex: 1,
    paddingRight: 12,
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

  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },

  incidentTypeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 6,
  },

  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 18,
  },

  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
  },

  locationText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },

  createdBy: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },

  reclamationBadge: {
    backgroundColor: '#FFFBEB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },

  reclamationBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.statOrange,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    width: 90,
    alignItems: 'center',
  },

  statusOpen: {
    backgroundColor: '#FEF2F2',
  },

  statusClosed: {
    backgroundColor: '#F0FDF4',
  },

  statusText: {
    fontWeight: '800',
    fontSize: 11,
  },

  statusTextOpen: {
    color: COLORS.statRed,
  },

  statusTextClosed: {
    color: COLORS.statGreen,
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

  // ── Commune Modal ──
  communeModalContainer: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    minHeight: '40%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },

  communeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  communeModalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
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

  // ── Detail Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },

  detailModalContainer: {
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

  detailModalTitle: {
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

  modalStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },

  modalStatusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },

  modalDateText: {
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

  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.96)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  photoViewerClose: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 32,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  photoViewerImage: {
    width: '100%',
    height: '82%',
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

function formatDurationBetween(startValue: string, endValue: string): string {
  const start = new Date(startValue).getTime();
  const end = new Date(endValue).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return 'Durée inconnue';
  }

  const totalMinutes = Math.max(0, Math.round((end - start) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} j ${hours} h`;
  if (hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}

function formatQuantity(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
}
