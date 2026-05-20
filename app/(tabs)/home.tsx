import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import { useSync } from '../../hooks/useSync';

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
  statusBadgeOpen: {
    backgroundColor: 'rgba(249, 115, 22, 0.2)', // orange-500/20
  },
  statusBadgeClosed: {
    backgroundColor: 'rgba(218, 242, 44, 0.2)', // #DAF22C/20
  },
  statusBadgeGreen: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)', // green-500/20
  },
  modalOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)', // bg-black/50
  },
  grayOverlay: {
    backgroundColor: 'rgba(31, 41, 55, 0.5)', // gray-800/50
  },
});

export default function Home() {
  const { user } = useAuth();
  const db = useSQLiteContext();
  const { isSyncing, syncPendingItems } = useSync();

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
      const rows = await db.getAllAsync<Incident>('SELECT * FROM incidents ORDER BY date DESC');
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
          marginHorizontal: 20,
          marginBottom: 16,
          backgroundColor: '#FFFFFF',
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#D1D5DB',
          borderLeftWidth: 4,
          borderLeftColor: isOpen ? '#F97316' : '#DAF22C',
          padding: 24,
        }}
        activeOpacity={0.8}
        onPress={() => {
          setSelectedIncident(item);
          setIsModalVisible(true);
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#111827', fontSize: 18, fontWeight: '900', letterSpacing: 0.5, marginBottom: 6, textTransform: 'uppercase' }}>
              {item.type} • {item.village}
            </Text>
            <Text style={{ color: '#6B7280', fontSize: 13, fontWeight: '600', letterSpacing: 1 }}>
              {item.synced === 0 ? 'PENDING • ' : ''}
              {formatIncidentDate(item.date)}
            </Text>
          </View>
          <View style={{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            backgroundColor: isOpen ? 'rgba(249, 115, 22, 0.1)' : 'rgba(218, 242, 44, 0.2)',
            borderWidth: 1,
            borderColor: isOpen ? 'rgba(249, 115, 22, 0.3)' : 'rgba(218, 242, 44, 0.5)',
          }}>
            <Text style={{ fontSize: 11, fontWeight: '900', color: isOpen ? '#EA580C' : '#65A30D', letterSpacing: 0.5 }}>
              {isOpen ? 'EN COURS' : 'CLÔTURÉ'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 24,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        zIndex: 10,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ color: '#111827', fontSize: 24, fontWeight: '900', letterSpacing: 0.5 }}>
              HELLO, {user?.email ? user.email.split('@')[0].toUpperCase() : 'MEHDI'}
            </Text>
            <Text style={{ color: '#6B7280', fontSize: 14, marginTop: 4, fontWeight: '700', letterSpacing: 2, textTransform: 'uppercase' }}>
              ZONE: ZEMAMRA
            </Text>
          </View>
          {/* Manual Sync Button */}
          <TouchableOpacity
            onPress={() => {
              syncPendingItems();
              fetchIncidents();
            }}
            style={{
              backgroundColor: '#F3F4F6',
              padding: 12,
              borderRadius: 4,
              borderWidth: 1,
              borderColor: isSyncing ? '#DAF22C' : '#E5E7EB',
            }}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size={24} color="#DAF22C" />
            ) : (
              <Ionicons name="sync-outline" size={24} color="#111827" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* List Container */}
      <View style={{ flex: 1, backgroundColor: '#F3F4F6', paddingTop: 24 }}>
        {isLoading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#DAF22C" />
          </View>
        ) : (
          <FlatList
            data={incidents}
            renderItem={renderIncidentItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', marginTop: 40 }}>
                <Text style={{ color: '#6B7280', fontSize: 14, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 }}>Aucun incident trouvé</Text>
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
                    <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '600', fontFamily: 'monospace' }}>{formatIncidentDate(selectedIncident.date)}</Text>
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
                        CLÔTURER L'INCIDENT
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
