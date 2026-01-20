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
  cardShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 12,
  },
  modalShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 20,
  },
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
        style={[{
          marginHorizontal: 16,
          marginBottom: 16,
          backgroundColor: '#191820',
          borderRadius: 12,
          borderLeftWidth: 4,
          borderLeftColor: isOpen ? '#F97316' : '#DAF22C',
          padding: 20,
        }, styles.cardShadow]}
        activeOpacity={0.8}
        onPress={() => {
          setSelectedIncident(item);
          setIsModalVisible(true);
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 4 }}>
              {item.type} - {item.village}
            </Text>
            <Text style={{ color: '#9CA3AF', fontSize: 14 }}>
              {item.synced === 0 ? 'CLOUD PENDING • ' : ''}
              {formatIncidentDate(item.date)}
            </Text>
          </View>
          <View style={[{
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 6,
          }, isOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: isOpen ? '#F97316' : '#DAF22C' }}>
              {isOpen ? 'EN COURS' : 'CLÔTURÉ'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#191820' }} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#191820" />

      {/* Header */}
      <View style={[{
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 32,
        backgroundColor: '#191820',
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        zIndex: 10,
      }, styles.headerShadow]}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View>
            <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>
              Hello, {user?.email ? user.email.split('@')[0] : 'Mehdi'}
            </Text>
            <Text style={{ color: '#DAF22C', fontSize: 18, marginTop: 4, fontWeight: '500' }}>
              Zone: Zemamra
            </Text>
          </View>
          {/* Manual Sync Button */}
          <TouchableOpacity
            onPress={() => {
              syncPendingItems();
              fetchIncidents();
            }}
            style={{
              backgroundColor: 'rgba(218, 242, 44, 0.15)',
              padding: 12,
              borderRadius: 50,
              borderWidth: 1,
              borderColor: isSyncing ? '#DAF22C' : 'transparent',
            }}
            disabled={isSyncing}
          >
            {isSyncing ? (
              <ActivityIndicator size={24} color="#DAF22C" />
            ) : (
              <Ionicons name="sync-outline" size={24} color="#DAF22C" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* List Container */}
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', paddingTop: 16 }}>
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
                <Text style={{ color: '#9CA3AF' }}>Aucun incident trouvé</Text>
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
        <View style={[{ flex: 1, justifyContent: 'flex-end' }, styles.modalOverlay]}>
          <View style={[{
            backgroundColor: '#191820',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            padding: 24,
            height: '80%',
          }, styles.modalShadow]}>
            {/* Modal Handle */}
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{ width: 64, height: 4, backgroundColor: '#4B5563', borderRadius: 2 }} />
            </View>

            {selectedIncident && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#DAF22C', fontWeight: 'bold', fontSize: 18, marginBottom: 4 }}>
                      {selectedIncident.type} - {selectedIncident.village}
                    </Text>
                    <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold' }}>Incident</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setIsModalVisible(false)}
                    style={{ backgroundColor: '#374151', padding: 8, borderRadius: 20 }}
                  >
                    <Ionicons name="close" size={24} color="white" />
                  </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 32 }}>
                  <View style={[{
                    paddingHorizontal: 12,
                    paddingVertical: 4,
                    borderRadius: 50,
                  }, selectedIncident.status !== 'closed' ? styles.statusBadgeOpen : styles.statusBadgeGreen]}>
                    <Text style={{
                      fontWeight: 'bold',
                      color: selectedIncident.status !== 'closed' ? '#F97316' : '#22C55E'
                    }}>
                      {selectedIncident.status !== 'closed' ? 'EN COURS' : 'CLÔTURÉ'}
                    </Text>
                  </View>
                  <View style={{ backgroundColor: '#374151', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 50 }}>
                    <Text style={{ color: '#D1D5DB' }}>{formatIncidentDate(selectedIncident.date)}</Text>
                  </View>
                </View>

                <View style={[{ padding: 16, borderRadius: 12, marginBottom: 24 }, styles.grayOverlay]}>
                  <Text style={{ color: '#9CA3AF', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 8 }}>
                    Équipement
                  </Text>
                  <Text style={{ color: 'white', fontSize: 18 }}>
                    {selectedIncident.equipment_used || "Non spécifié"}
                  </Text>
                </View>

                {Boolean(selectedIncident.reclamation) && (
                  <View style={[{ padding: 16, borderRadius: 12, marginBottom: 24 }, styles.grayOverlay]}>
                    <Text style={{ color: '#9CA3AF', fontSize: 12, textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 8 }}>
                      Réclamation
                    </Text>
                    <Text style={{ color: 'white', fontSize: 18 }}>
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
                        paddingVertical: 16,
                        borderRadius: 12,
                        alignItems: 'center',
                        flexDirection: 'row',
                        justifyContent: 'center',
                      }}
                      onPress={() => handleCloseIncident(selectedIncident.id)}
                    >
                      <Ionicons name="checkmark-circle" size={24} color="#191820" style={{ marginRight: 8 }} />
                      <Text style={{ color: '#191820', fontWeight: 'bold', fontSize: 18 }}>
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
