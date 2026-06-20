import { SrmListSkeleton } from '@/components/ui/srm';
import { clearLocalSupabaseSession } from '@/lib/supabase';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { DirectorService, type DirectorIncident, type DirectorIncidentFilters } from '@/src/core/services/directorService';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function DirectorIncidents() {
  const [incidents, setIncidents] = useState<DirectorIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | 'closed'>('open');
  const [type, setType] = useState<'all' | 'BT' | 'MT'>('all');
  const [selectedIncident, setSelectedIncident] = useState<DirectorIncident | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    void loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, type]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      void loadInitial();
    }, 350);
    return () => clearTimeout(debounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const buildFilters = (lastCreatedAt?: string): DirectorIncidentFilters => ({
    status,
    type,
    search: search.trim() || undefined,
    lastCreatedAt,
  });

  const loadInitial = async () => {
    setLoading(true);
    try {
      const data = await DirectorService.getIncidents(20, buildFilters());
      setIncidents(data);
    } catch (error) {
      Alert.alert('Lecture impossible', error instanceof Error ? error.message : 'Impossible de charger les incidents.');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || incidents.length === 0) return;
    setLoadingMore(true);
    try {
      const last = incidents[incidents.length - 1];
      const data = await DirectorService.getIncidents(20, buildFilters(last.created_at));
      if (data.length > 0) {
        setIncidents(prev => [...prev, ...data]);
      }
    } catch (error) {
      Alert.alert('Lecture impossible', error instanceof Error ? error.message : 'Impossible de charger plus d’incidents.');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleLogout = async () => {
    await clearLocalSupabaseSession();
    router.replace('/(auth)/login');
  };

  const openMap = (incident: DirectorIncident) => {
    if (incident.latitude == null || incident.longitude == null) return;
    const query = `${incident.latitude},${incident.longitude}`;
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>LECTURE SEULE</Text>
          <Text style={styles.title}>Incidents</Text>
        </View>
        <TouchableOpacity style={styles.headerAction} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={22} color={COLORS.surface} />
        </TouchableOpacity>
      </View>

      <View style={styles.filters}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Rechercher village, matériel, description"
            placeholderTextColor={COLORS.textMuted}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="Ouverts" active={status === 'open'} onPress={() => setStatus('open')} />
          <Chip label="Clôturés" active={status === 'closed'} onPress={() => setStatus('closed')} />
          <Chip label="Tous" active={status === 'all'} onPress={() => setStatus('all')} />
          <View style={styles.chipDivider} />
          <Chip label="BT" active={type === 'BT'} onPress={() => setType(type === 'BT' ? 'all' : 'BT')} />
          <Chip label="MT" active={type === 'MT'} onPress={() => setType(type === 'MT' ? 'all' : 'MT')} />
        </ScrollView>
      </View>

      {loading ? (
        <SrmListSkeleton count={7} style={styles.skeletonList} />
      ) : (
        <FlashList
          data={incidents}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <IncidentCard incident={item} onPress={() => setSelectedIncident(item)} />
          )}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={42} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>Aucun incident</Text>
              <Text style={styles.emptyText}>Aucun résultat ne correspond aux filtres.</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footerLoader} color={COLORS.textPrimary} /> : null}
        />
      )}

      <IncidentDetailModal
        incident={selectedIncident}
        onClose={() => setSelectedIncident(null)}
        onOpenMap={openMap}
        onOpenPhoto={setSelectedPhotoUrl}
      />

      <Modal
        visible={selectedPhotoUrl !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedPhotoUrl(null)}
      >
        <View style={styles.photoOverlay}>
          <TouchableOpacity style={styles.photoClose} onPress={() => setSelectedPhotoUrl(null)}>
            <Ionicons name="close" size={26} color={COLORS.surface} />
          </TouchableOpacity>
          {selectedPhotoUrl ? (
            <Image source={{ uri: selectedPhotoUrl }} style={styles.photoFull} contentFit="contain" />
          ) : null}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function IncidentCard({ incident, onPress }: { incident: DirectorIncident; onPress: () => void }) {
  const isOpen = incident.status === 'open';
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.cardDot, { backgroundColor: isOpen ? COLORS.signalRed : COLORS.signalGreen }]} />
      <View style={{ flex: 1 }}>
        <View style={styles.cardTopRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{incident.type}</Text>
          </View>
          <Text style={[styles.statusBadge, { color: isOpen ? COLORS.signalRed : COLORS.signalGreen }]}>
            {isOpen ? 'OUVERT' : 'CLÔTURÉ'}
          </Text>
        </View>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {incident.title || `${incident.type} - ${incident.village}`}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {incident.commune_name || 'Commune inconnue'} · {incident.created_by_name || 'Agent inconnu'}
        </Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {formatDate(incident.created_at)} · {incident.incident_type}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

function IncidentDetailModal({
  incident,
  onClose,
  onOpenMap,
  onOpenPhoto,
}: {
  incident: DirectorIncident | null;
  onClose: () => void;
  onOpenMap: (incident: DirectorIncident) => void;
  onOpenPhoto: (url: string) => void;
}) {
  return (
    <Modal visible={incident !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {incident ? (
            <>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.readOnlyBadge}>LECTURE SEULE</Text>
                  <Text style={styles.modalTitle}>{incident.title || `${incident.type} - ${incident.village}`}</Text>
                </View>
                <TouchableOpacity style={styles.modalClose} onPress={onClose}>
                  <Ionicons name="close" size={22} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                <DetailRow label="Statut" value={incident.status === 'open' ? 'Ouvert' : 'Clôturé'} />
                <DetailRow label="Réseau" value={incident.type} />
                <DetailRow label="Type incident" value={incident.incident_type} />
                {incident.type === 'MT' && incident.depart_hta ? (
                  <DetailRow label="Départ HTA" value={incident.depart_hta} />
                ) : null}
                <DetailRow label="Commune" value={incident.commune_name || 'Commune inconnue'} />
                <DetailRow label="Village" value={incident.village} />
                <DetailRow label="Agent" value={incident.created_by_name || 'Agent inconnu'} />
                <DetailRow label="Créé le" value={formatDate(incident.created_at)} />
                <DetailRow label="Clôturé par" value={incident.closed_by_name || '-'} />
                <DetailRow label="Clôturé le" value={incident.closed_at ? formatDate(incident.closed_at) : '-'} />
                <DetailRow
                  label={incident.status === 'closed' ? 'Durée de traitement' : 'Ouvert depuis'}
                  value={formatIncidentDuration(incident)}
                />
                {incident.materials.length > 0 ? (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Matériel</Text>
                    <View style={styles.materialList}>
                      {incident.materials.map((material) => (
                        <View key={`${material.material_name}-${material.quantity}`} style={styles.materialRow}>
                          <Text style={styles.materialName}>{material.material_name}</Text>
                          <Text style={styles.materialQuantity}>x{formatQuantity(material.quantity)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ) : (
                  <DetailRow label="Matériel" value={incident.equipment_used || '-'} />
                )}
                <DetailRow label="Description" value={incident.description || '-'} />

                {incident.latitude != null && incident.longitude != null ? (
                  <TouchableOpacity style={styles.mapButton} onPress={() => onOpenMap(incident)}>
                    <Ionicons name="location-outline" size={20} color={COLORS.textPrimary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.mapTitle}>Position GPS</Text>
                      <Text style={styles.mapText}>
                        {incident.latitude.toFixed(6)}, {incident.longitude.toFixed(6)}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                ) : null}

                {incident.media_urls.length > 0 ? (
                  <View style={styles.mediaSection}>
                    <Text style={styles.detailLabel}>Photos ({incident.media_urls.length})</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      {incident.media_urls.map((url) => (
                        <TouchableOpacity key={url} onPress={() => onOpenPhoto(url)}>
                          <Image source={{ uri: url }} style={styles.thumbnail} contentFit="cover" />
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ) : null}

                <View style={{ height: 24 }} />
              </ScrollView>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date inconnue';
  return date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatIncidentDuration(incident: DirectorIncident): string {
  const endValue = incident.closed_at || new Date().toISOString();
  const start = new Date(incident.created_at).getTime();
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  filters: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  searchBox: {
    height: 46,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    paddingVertical: 0,
  },
  chipRow: {
    gap: SPACING.sm,
  },
  chip: {
    height: 36,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
  },
  chipTextActive: {
    color: COLORS.textPrimary,
  },
  chipDivider: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.border,
    marginHorizontal: SPACING.xs,
  },
  skeletonList: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: 110,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  cardDot: {
    width: 8,
    height: 8,
    borderRadius: RADIUS.full,
    marginTop: 7,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typeBadge: {
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  typeBadgeText: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
  },
  statusBadge: {
    ...TYPOGRAPHY.label,
    textTransform: 'uppercase',
  },
  cardTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
  },
  cardMeta: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
    marginTop: SPACING.md,
  },
  emptyText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  footerLoader: {
    marginVertical: SPACING.lg,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    height: '84%',
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  readOnlyBadge: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.accent,
    alignSelf: 'flex-start',
    overflow: 'hidden',
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: SPACING.sm,
  },
  modalTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
  },
  modalClose: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingHorizontal: SPACING.xl,
  },
  detailRow: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  detailLabel: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailValue: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '700',
  },
  materialList: {
    gap: SPACING.sm,
  },
  materialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.md,
  },
  materialName: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  materialQuantity: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '900',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  mapTitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textPrimary,
    fontWeight: '800',
  },
  mapText: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  mediaSection: {
    marginTop: SPACING.xl,
  },
  thumbnail: {
    width: 112,
    height: 112,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    marginRight: SPACING.md,
  },
  photoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoClose: {
    position: 'absolute',
    top: 52,
    right: 20,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  photoFull: {
    width: '100%',
    height: '82%',
  },
});
