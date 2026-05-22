import { supabase } from '@/lib/supabase';
import { IncidentAdminService, type Incident, type IncidentFilters } from '@/src/core/services/incidentAdminService';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
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

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [communes, setCommunes] = useState<{ id: string; name: string }[]>([]);
  const [showCommuneModal, setShowCommuneModal] = useState(false);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  useEffect(() => {
    loadInitial();
    fetchCommunes();
  }, [status, type, communeId, reclamation, datePreset]);

  // Debounced search trigger
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      loadInitial();
    }, 400);
    return () => clearTimeout(delayDebounce);
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
    try {
      await IncidentAdminService.updateIncidentStatus({ id: item.id, status: newStatus });
      setIncidents(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
      if (selectedIncident?.id === item.id) {
        setSelectedIncident(prev => prev ? { ...prev, status: newStatus } : null);
      }
      Alert.alert('Succès', `Incident marqué comme ${newStatus === 'closed' ? 'fermé' : 'ouvert'}.`);
    } catch (e: any) {
      if (e.message?.includes('NETWORK_OFFLINE')) {
        Alert.alert('Action Hors Ligne Bloquée', 'Les mutations administrateur requièrent une connexion internet active.');
      } else {
        Alert.alert('Erreur', String(e));
      }
    }
  };

  const getCommuneName = (id: string) => {
    if (id === 'all') return 'Toutes les Communes';
    const comm = communes.find(c => c.id === id);
    return comm ? comm.name : 'Commune Inconnue';
  };

  const renderItem = ({ item }: { item: Incident }) => {
    const isOpen = item.status === 'open';

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setSelectedIncident(item)}
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
            {item.incident_type}
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

        <TouchableOpacity
          style={[styles.statusBadge, isOpen ? styles.statusOpen : styles.statusClosed]}
          onPress={() => handleToggleStatus(item)}
          activeOpacity={0.7}
        >
          <Text style={[styles.statusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
            {isOpen ? 'EN COURS' : 'RÉSOLU'}
          </Text>
        </TouchableOpacity>
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
                  {s === 'all' ? 'Tous' : s === 'open' ? 'En cours' : 'Résolus'}
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

          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* ─── Incidents List ─────────────────────────────────────── */}
      {loading && incidents.length === 0 ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryDark} />
        </View>
      ) : (
        <FlashList
          data={incidents}
          renderItem={renderItem}
          // @ts-ignore - estimatedItemSize is missing from v2.0.2 types but required for performance
          estimatedItemSize={120}
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
                      Fiche Incident
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
                        {selectedIncident.status === 'open' ? 'EN COURS' : 'RÉSOLU'}
                      </Text>
                    </View>
                    <Text style={styles.modalDateText}>
                      Rapporté le {new Date(selectedIncident.created_at).toLocaleString()}
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
                    <Text style={styles.detailValue}>{selectedIncident.created_by_name || 'Agent de terrain'}</Text>
                  </View>

                  {/* Equipment */}
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Matériel requis/utilisé</Text>
                    <Text style={styles.detailValue}>{selectedIncident.equipment_used || 'Aucun'}</Text>
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
                    onPress={() => handleToggleStatus(selectedIncident)}
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    fontWeight: '600',
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
    fontWeight: '600',
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
