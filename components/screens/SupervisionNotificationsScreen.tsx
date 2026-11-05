import { SrmActionButton, SrmEmptyState, SrmListSkeleton, SrmPanel, SrmScreenHeader, SrmSettingsRow, SrmStatusBadge } from '@/components/ui/srm';
import { useAuth } from '@/contexts/AuthContext';
import { getAdminNotificationStatus, registerAdminPushNotifications, type AdminNotificationStatus } from '@/lib/adminNotifications';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { listAdminNotifications, NOTIFICATION_PAGE_SIZE, type AdminNotification } from '@/src/core/services/adminNotificationService';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, AppState, FlatList, Linking, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SupervisionNotificationsScreen() {
  const { user, isAdmin } = useAuth();
  const profileRoute = isAdmin ? '/(admin)/profile' : '/(director)/profile';
  const incidentsRoute = isAdmin ? '/(admin)/incidents' : '/(director)/incidents';
  const [items, setItems] = useState<AdminNotification[]>([]);
  const [status, setStatus] = useState<AdminNotificationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const pageInFlight = useRef(false);

  const refresh = useCallback(async () => {
    const version = ++generation.current;
    setLoading(true);
    setError(null);
    try {
      const [notifications, deviceStatus] = await Promise.all([listAdminNotifications(), getAdminNotificationStatus()]);
      if (generation.current !== version) return;
      setItems(notifications);
      setHasMore(notifications.length === NOTIFICATION_PAGE_SIZE);
      setStatus(deviceStatus);
    } catch (e) {
      if (generation.current === version) setError(e instanceof Error ? e.message : 'Chargement impossible.');
    } finally {
      if (generation.current === version) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    const received = Platform.OS !== 'web' ? Notifications.addNotificationReceivedListener(() => { void refresh(); }) : null;
    return () => { generation.current += 1; subscription.remove(); received?.remove(); };
  }, [refresh]));

  const loadMore = async () => {
    if (loading || pageInFlight.current || !hasMore || !items.length) return;
    const version = generation.current;
    pageInFlight.current = true;
    setLoadingMore(true);
    try {
      const page = await listAdminNotifications(items[items.length - 1]);
      if (generation.current !== version) return;
      setItems(previous => [...previous, ...page.filter(item => !previous.some(old => old.id === item.id))]);
      setHasMore(page.length === NOTIFICATION_PAGE_SIZE);
    } catch (e) { Alert.alert('Erreur', e instanceof Error ? e.message : 'Chargement impossible.'); }
    finally { pageInFlight.current = false; setLoadingMore(false); }
  };

  const enable = async () => {
    setRegistering(true);
    try {
      const next = await registerAdminPushNotifications();
      setStatus(next);
      if (next.permission === 'denied' || next.channelBlocked) {
        Alert.alert('Notifications bloquées', 'Autorisez les notifications et le son dans les paramètres du téléphone.');
      }
    } catch (e) { Alert.alert('Activation impossible', e instanceof Error ? e.message : 'Réessayez après avoir vérifié votre connexion.'); }
    finally { setRegistering(false); }
  };

  const ready = status?.registered && status.permission === 'granted' && !status.channelBlocked;
  const deviceDescription = !status?.supported ? 'Les alertes sonores nécessitent l’application installée sur un téléphone.'
    : status.channelBlocked || status.permission === 'denied' ? 'Notifications bloquées dans les paramètres du téléphone.'
      : ready && status.soundEnabled ? 'Ce téléphone est enregistré pour les alertes urgentes.'
        : ready ? 'Alertes actives. Le son est désactivé dans les paramètres du téléphone.'
          : 'Activez les alertes urgentes sur ce téléphone.';

  return <SafeAreaView style={styles.screen} edges={['top']}>
    <FlatList key={user?.id} data={items} keyExtractor={item => item.id}
      contentContainerStyle={styles.content} refreshing={loading} onRefresh={refresh}
      ListHeaderComponent={<>
        <SrmScreenHeader kicker="ADMINISTRATION" title="Notifications" subtitle="Incidents BT et MT"
          rightSlot={<TouchableOpacity accessibilityRole="button" accessibilityLabel="Retour aux paramètres" onPress={() => router.replace(profileRoute)} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={COLORS.surface} />
          </TouchableOpacity>} />
        <SrmPanel style={styles.settings}>
          <SrmSettingsRow icon="notifications-outline" title="Alertes sur ce téléphone" description={deviceDescription}
            trailing={<SrmStatusBadge label={ready ? 'ACTIVES' : 'À ACTIVER'} variant={ready ? 'success' : 'warning'} />} isLast />
          {status?.supported && <View style={styles.actions}>
            <SrmActionButton label={ready ? 'Vérifier l’inscription' : 'Activer les alertes'} icon="notifications-outline" loading={registering} onPress={enable} />
            <SrmActionButton label="Paramètres du téléphone" variant="secondary" onPress={() => { void Linking.openSettings().catch(() => Alert.alert('Erreur', 'Ouvrez les paramètres du téléphone manuellement.')); }} />
          </View>}
        </SrmPanel>
        <Text style={styles.explanation}>Un incident signalé hors connexion apparaît après sa synchronisation.</Text>
        {error && <View accessibilityRole="alert" style={styles.error}>
          <Text style={styles.body}>{error}</Text>
          <SrmActionButton label="Réessayer" onPress={refresh} />
        </View>}
      </>}
      ListEmptyComponent={loading ? <SrmListSkeleton count={3} /> : !error ? <SrmEmptyState icon="notifications-outline" title="Aucun nouvel incident" message="Les nouveaux signalements apparaîtront ici après leur synchronisation." /> : null}
      renderItem={({ item }) => <View style={styles.item}>
        <View style={styles.heading}>
          <SrmStatusBadge label={item.incidents?.type ?? 'INCIDENT'} />
        </View>
        <Text style={styles.title}>{item.incidents?.incident_type ?? 'Incident indisponible'}</Text>
        <Text style={styles.body}>{[item.incidents?.communes?.name, item.incidents?.village].filter(Boolean).join(' · ')}</Text>
        {item.incidents?.depart_hta && <Text style={styles.body}>Départ HTA : {item.incidents.depart_hta}</Text>}
        <Text style={styles.meta}>Signalé le {new Date(item.incidents?.date ?? item.created_at).toLocaleString('fr-MA', { timeZone: 'Africa/Casablanca' })}</Text>
        {item.incidents?.status === 'closed' && <Text style={styles.meta}>Incident clôturé</Text>}
        <View style={styles.actions}>
          <SrmActionButton label="Voir l’incident" variant="secondary" disabled={!item.incidents}
            onPress={() => router.push({ pathname: incidentsRoute, params: { incidentId: item.incident_id, notificationId: item.id } })} />
        </View>
      </View>}
      ListFooterComponent={hasMore ? <SrmActionButton label="Charger la suite" loading={loadingMore} onPress={loadMore} /> : null}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.xl, paddingBottom: 40, ...(Platform.OS === 'web' ? { width: '100%', maxWidth: 850, alignSelf: 'center' } as const : {}) },
  back: { padding: SPACING.md, minWidth: 44, minHeight: 44 },
  settings: { marginTop: SPACING.lg, marginBottom: SPACING.md },
  explanation: { ...TYPOGRAPHY.body, color: COLORS.textSecondary, marginBottom: SPACING.xl },
  item: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.lg, padding: SPACING.lg, marginBottom: SPACING.md, gap: SPACING.sm },
  heading: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: SPACING.sm },
  title: { ...TYPOGRAPHY.title, color: COLORS.textPrimary },
  body: { ...TYPOGRAPHY.body, color: COLORS.textPrimary },
  meta: { ...TYPOGRAPHY.body, color: COLORS.textSecondary },
  actions: { padding: SPACING.md, gap: SPACING.sm },
  error: { marginBottom: SPACING.lg, gap: SPACING.md },
});
