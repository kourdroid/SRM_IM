import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useSync } from '../../hooks/useSync';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';

// Define the incident type mapping to SQLite schema
interface Incident {
  id: string;
  type: 'BT' | 'MT';
  date: string;
  village: string;
  incident_type?: string;
  status: 'open' | 'closed';
  commune_id?: string;
  equipment_used?: string;
  reclamation: number;
  reclamation_by?: string;
  reclamation_name?: string;
  created_by?: string;
  created_at?: string;
  synced: number;
}

// Inline styles to avoid NativeWind race condition
const styles = StyleSheet.create({
  modalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
});

export default function Home() {
  const { user } = useAuth();
  const db = useSQLiteContext();
  const { isSyncing, syncPendingItems } = useSync(user?.id);

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Format incident date for display
  const formatIncidentDate = (dateString?: string) => {
    if (!dateString) return 'Date inconnue';
    try {
      const date = new Date(dateString);
      return `${date.getDate().toString().padStart(2, '0')}/${(date.getMonth() + 1).toString().padStart(2, '0')} • ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } catch (error) {
      return 'Date invalide';
    }
  };

  // Fetch incidents from SQLite
  const fetchIncidents = useCallback(async () => {
    try {
      setIsLoading(true);
      const rows = await db.getAllAsync<Incident>(
        'SELECT * FROM incidents WHERE created_by = ? ORDER BY date DESC',
        [user?.id]
      );
      setIncidents(rows);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setIsLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      fetchIncidents();
      syncPendingItems();
    }, [fetchIncidents])
  );

  const handleCloseIncident = async (incidentId: string) => {
    try {
      await db.runAsync('UPDATE incidents SET status = ?, synced = 0 WHERE id = ?', ['closed', incidentId]);
      Alert.alert("Succès", "Incident clôturé avec succès");
      setIsModalVisible(false);
      fetchIncidents();
      syncPendingItems();
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible de clôturer l'incident");
    }
  };

  const renderIncidentItem = ({ item }: { item: Incident }) => {
    const isOpen = item.status !== 'closed';

    return (
      <TouchableOpacity
        style={{
          marginHorizontal: SPACING.xl,
          marginBottom: SPACING.lg,
          backgroundColor: COLORS.surface,
          borderRadius: RADIUS.md,
          borderWidth: 1,
          borderColor: COLORS.border,
          padding: SPACING.xl,
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: SPACING.md,
        }}
        activeOpacity={0.8}
        onPress={() => {
          setSelectedIncident(item);
          setIsModalVisible(true);
        }}
      >
        {/* Status dot instead of border-left stripe */}
        <View style={{
          width: 8,
          height: 8,
          borderRadius: RADIUS.full,
          backgroundColor: isOpen ? COLORS.signalOrange : COLORS.accent,
          marginTop: 6,
          flexShrink: 0,
        }} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
            <View style={{ backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, marginRight: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: COLORS.textPrimary, textTransform: 'uppercase' }}>{item.type}</Text>
            </View>
            <Text style={{ color: COLORS.textPrimary, fontSize: 16, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {item.village}
            </Text>
          </View>
          <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {item.synced === 0 ? 'EN ATTENTE • ' : ''}
            {formatIncidentDate(item.date)}
          </Text>
          {item.incident_type ? (
            <Text style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 4, fontWeight: '600' }} numberOfLines={1}>
              {item.incident_type}
            </Text>
          ) : null}
        </View>
        <View style={{
          paddingHorizontal: SPACING.sm,
          paddingVertical: SPACING.xs,
          borderRadius: RADIUS.sm,
          backgroundColor: isOpen ? COLORS.signalRedTint : COLORS.signalGreenTint,
          borderWidth: 1,
          borderColor: isOpen ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
          flexShrink: 0,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '900', color: isOpen ? COLORS.signalRed : COLORS.signalGreen, letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {isOpen ? 'EN COURS' : 'CLÔTURÉ'}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.surface} />

      {/* Header */}
      <View style={{
        paddingHorizontal: SPACING.xl,
        paddingTop: SPACING.xl,
        paddingBottom: SPACING.xxl,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        zIndex: 10,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ color: COLORS.textPrimary, fontSize: 22, fontWeight: '900', letterSpacing: 0.5 }}>
              {user?.email ? user.email.split('@')[0].toUpperCase() : 'AGENT'}
            </Text>
            <Text style={{ color: COLORS.textSecondary, fontSize: 12, marginTop: 4, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
              INCIDENTS TERRAIN
            </Text>
          </View>
          {/* Manual Sync Button */}
          <TouchableOpacity
            onPress={() => {
              syncPendingItems();
              fetchIncidents();
            }}
            style={{
              backgroundColor: COLORS.background,
              padding: SPACING.md,
              borderRadius: RADIUS.sm,
              borderWidth: 1,
              borderColor: isSyncing ? COLORS.accent : COLORS.border,
            }}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size={24} color={COLORS.accent} />
            ) : (
              <Ionicons name="sync-outline" size={24} color={COLORS.textPrimary} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* List Container */}
        <View style={{ flex: 1, backgroundColor: COLORS.background, paddingTop: SPACING.xxl }}>
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#DAF22C" />
          </View>
        ) : (
          <FlashList
            data={incidents}
            renderItem={renderIncidentItem}
            keyExtractor={(item: Incident) => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            // @ts-ignore - estimatedItemSize is missing from v2.0.2 types but required for performance
            estimatedItemSize={120}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                paddingHorizontal: SPACING.xl,
                paddingTop: 60,
              }}>
                <View style={{
                  width: 72,
                  height: 72,
                  borderRadius: RADIUS.full,
                  backgroundColor: COLORS.signalGreenTint,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: SPACING.xl,
                }}>
                  <Ionicons name="checkmark-done-circle-outline" size={36} color={COLORS.signalGreen} />
                </View>
                <Text style={{
                  ...TYPOGRAPHY.title,
                  color: COLORS.textPrimary,
                  textAlign: 'center',
                  marginBottom: SPACING.sm,
                }}>
                  Aucun incident signalé
                </Text>
                <Text style={{
                  ...TYPOGRAPHY.body,
                  color: COLORS.textSecondary,
                  textAlign: 'center',
                  lineHeight: 20,
                }}>
                  Appuyez sur le bouton + pour signaler un nouvel incident.
                </Text>
              </View>
            }
          />
        )}
      </View>

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <View style={{
            backgroundColor: '#FFFFFF',
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            padding: 24,
            height: '80%',
          }}>
            {/* Modal Handle */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{ width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 }} />
            </View>

            {selectedIncident && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#6B7280', fontWeight: '900', fontSize: 12, letterSpacing: 1.5, marginBottom: 8, textTransform: 'uppercase' }}>
                      {selectedIncident.type} • {selectedIncident.village}
                    </Text>
                    <Text style={{ color: '#111827', fontSize: 24, fontWeight: '900', letterSpacing: 0.5 }}>DÉTAILS INCIDENT</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsModalVisible(false)}
                    style={{ backgroundColor: '#F3F4F6', padding: 8, borderRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' }}
                  >
                    <Ionicons name="close" size={24} color="#111827" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
                  <View style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 4,
                    backgroundColor: selectedIncident.status !== 'closed' ? 'rgba(249, 115, 22, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                    borderWidth: 1,
                    borderColor: selectedIncident.status !== 'closed' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                  }}>
                    <Text style={{
                      fontWeight: '800',
                      fontSize: 12,
                      letterSpacing: 0.5,
                      color: selectedIncident.status !== 'closed' ? '#EA580C' : '#16A34A'
                    }}>
                      {selectedIncident.status !== 'closed' ? 'EN COURS' : 'CLÔTURÉ'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#F9FAFB', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1, borderColor: '#E5E7EB' }}>
                    <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '600' }}>{formatIncidentDate(selectedIncident.date)}</Text>
                  </View>
                </View>

                <View style={{ padding: 20, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                  <Text style={{ color: '#6B7280', fontSize: 11, textTransform: 'uppercase', fontWeight: '900', marginBottom: 8, letterSpacing: 1.5 }}>
                    ÉQUIPEMENT
                  </Text>
                  <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>
                    {selectedIncident.equipment_used || "NON SPÉCIFIÉ"}
                  </Text>
                </View>

                {Boolean(selectedIncident.reclamation) && (
                  <View style={{ padding: 20, borderRadius: 8, marginBottom: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' }}>
                    <Text style={{ color: '#6B7280', fontSize: 11, textTransform: 'uppercase', fontWeight: '900', marginBottom: 8, letterSpacing: 1.5 }}>
                      RÉCLAMATION
                    </Text>
                    <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>
                      {selectedIncident.reclamation_name} ({selectedIncident.reclamation_by})
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1 }} />

                {/* Actions */}
                <View style={{ marginBottom: 32 }}>
                  {selectedIncident.status !== 'closed' && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#DAF22C',
                        paddingVertical: 18,
                        borderRadius: 4,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: '#DAF22C'
                      }}
                      onPress={() => handleCloseIncident(selectedIncident.id)}
                    >
                      <Ionicons name="checkmark-circle" size={24} color="#111827" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#111827', fontWeight: '900', fontSize: 16, letterSpacing: 1, textTransform: 'uppercase' }}>
                        CLÔTURER L&apos;INCIDENT
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
