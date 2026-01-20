import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Platform, Text, TextInput, TouchableOpacity, View, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../contexts/AuthContext';
import supabaseService from '../../services/supabase';
import { useOfflineStorage } from '../../hooks/useOfflineStorage';
import OfflineIncidentsModal from '../../components/OfflineIncidentsModal';
import CommuneManager from '../../components/CommuneManager';

// Define the incident type
interface Incident {
  id: string;
  title?: string;
  type?: 'BT' | 'MT';
  date?: string;
  village?: string;
  incident_type?: string;
  status?: 'open' | 'closed';
  commune_id?: string;
  equipment_used?: string;
  description?: string;
  reclamation?: boolean;
  reclamation_by?: string;
  reclamation_name?: string;
  created_by?: string;
  created_at?: string;
  communes?: {
    id: string;
    name: string;
    region: string;
  };
  user_profiles?: {
    id: string;
    name?: string;
  };
}

export default function Home() {
  const { user } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { isOnline } = useOfflineStorage();

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

  // Fetch incidents
  const fetchIncidents = async () => {
    try {
      setIsLoading(true);
      const response = await supabaseService.listIncidents(true);
      if (response && response.documents) {
        setIncidents(response.documents);
        setFilteredIncidents(response.documents);
      }
    } catch (error) {
      console.error('Error fetching incidents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchIncidents();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchIncidents();
    }, [])
  );

  const handleCloseIncident = async (incidentId: string) => {
    try {
      await supabaseService.updateIncident(incidentId, { status: 'closed' });
      Alert.alert("Succès", "Incident clôturé avec succès");
      setIsModalVisible(false);
      fetchIncidents();
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Impossible de clôturer l'incident");
    }
  };

  const renderIncidentItem = ({ item }: { item: Incident }) => {
    const isOpen = item.status !== 'closed';
    const borderColor = isOpen ? 'border-orange-500' : 'border-[#DAF22C]';

    return (
      <TouchableOpacity
        className={`mx-4 mb-4 bg-[#191820] rounded-xl border-l-4 ${borderColor} p-5 shadow-lg`}
        activeOpacity={0.8}
        onPress={() => {
          setSelectedIncident(item);
          setIsModalVisible(true);
        }}
      >
        <View className="flex-row justify-between items-start">
          <View className="flex-1">
            <Text className="text-white text-xl font-bold mb-1">
              {item.title || `${item.type} - ${item.village}`}
            </Text>
            <Text className="text-gray-400 text-sm">
              {item.village} • {formatIncidentDate(item.date)}
            </Text>
          </View>
          <View className={`px-2 py-1 rounded-md ${isOpen ? 'bg-orange-500/20' : 'bg-[#DAF22C]/20'}`}>
            <Text className={`text-xs font-bold ${isOpen ? 'text-orange-500' : 'text-[#DAF22C]'}`}>
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
      <View className="px-6 pt-4 pb-8 bg-[#191820] rounded-b-[30px] shadow-xl z-10">
        <View className="flex-row justify-between items-start">
          <View>
            <Text className="text-white text-3xl font-bold">
              Hello, {user?.name || 'Mehdi'}
            </Text>
            <Text className="text-[#DAF22C] text-lg mt-1 font-medium">
              Zone: Zemamra
            </Text>
          </View>
        </View>
      </View>

      {/* List Container - Gray Background */}
      <View className="flex-1 bg-gray-50 pt-4">
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#DAF22C" />
          </View>
        ) : (
          <FlatList
            data={filteredIncidents}
            renderItem={renderIncidentItem}
            keyExtractor={item => item.id}
            contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View className="items-center mt-10">
                <Text className="text-gray-400">Aucun incident trouvé</Text>
              </View>
            }
          />
        )}
      </View>

      {/* Incident Details Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={isModalVisible}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-[#191820] rounded-t-[30px] p-6 h-[80%] shadow-2xl">
            {/* Modal Handle */}
            <View className="items-center mb-6">
              <View className="w-16 h-1 bg-gray-600 rounded-full" />
            </View>

            {selectedIncident && (
              <>
                <View className="flex-row justify-between items-start mb-6">
                  <View className="flex-1">
                    <Text className="text-[#DAF22C] font-bold text-lg mb-1">{selectedIncident.type} - {selectedIncident.village}</Text>
                    <Text className="text-white text-3xl font-bold">{selectedIncident.title || "Incident"}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setIsModalVisible(false)} className="bg-gray-800 p-2 rounded-full">
                    <Ionicons name="close" size={24} color="white" />
                  </TouchableOpacity>
                </View>

                <View className="flex-row gap-2 mb-8">
                  <View className={`px-3 py-1 rounded-full ${selectedIncident.status !== 'closed' ? 'bg-orange-500/20' : 'bg-green-500/20'}`}>
                    <Text className={`${selectedIncident.status !== 'closed' ? 'text-orange-500' : 'text-green-500'} font-bold`}>
                      {selectedIncident.status !== 'closed' ? 'EN COURS' : 'CLÔTURÉ'}
                    </Text>
                  </View>
                  <View className="bg-gray-800 px-3 py-1 rounded-full">
                    <Text className="text-gray-300">{formatIncidentDate(selectedIncident.date)}</Text>
                  </View>
                </View>

                <View className="bg-gray-800/50 p-4 rounded-xl mb-6">
                  <Text className="text-gray-400 text-xs uppercase font-bold mb-2">Équipement</Text>
                  <Text className="text-white text-lg">{selectedIncident.equipment_used || "Non spécifié"}</Text>
                </View>

                {selectedIncident.reclamation && (
                  <View className="bg-gray-800/50 p-4 rounded-xl mb-6">
                    <Text className="text-gray-400 text-xs uppercase font-bold mb-2">Réclamation</Text>
                    <Text className="text-white text-lg">{selectedIncident.reclamation_name} ({selectedIncident.reclamation_by})</Text>
                  </View>
                )}

                <View className="flex-1" />

                {/* Actions */}
                <View className="gap-4 mb-8">
                  {selectedIncident.status !== 'closed' && (
                    <TouchableOpacity
                      className="bg-[#DAF22C] py-4 rounded-xl items-center flex-row justify-center"
                      onPress={() => handleCloseIncident(selectedIncident.id)}
                    >
                      <Ionicons name="checkmark-circle" size={24} color="#191820" style={{ marginRight: 8 }} />
                      <Text className="text-[#191820] font-bold text-lg">CLÔTURER L'INCIDENT</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    className="bg-gray-800 py-4 rounded-xl items-center flex-row justify-center"
                    onPress={() => {
                      setIsModalVisible(false);
                      const initialData = {
                        type: selectedIncident.type,
                        date: selectedIncident.date,
                        village: selectedIncident.village,
                        equipment_used: selectedIncident.equipment_used,
                        reclamation: selectedIncident.reclamation,
                        incident_type: selectedIncident.incident_type,
                        reclamation_by: selectedIncident.reclamation_by,
                        reclamation_name: selectedIncident.reclamation_name,
                        commune_id: selectedIncident.commune_id
                      };
                      router.push({
                        pathname: '/(tabs)/create-incident-new',
                        params: {
                          editMode: 'true',
                          incidentId: selectedIncident.id,
                          initialData: JSON.stringify(initialData)
                        }
                      });
                    }}
                  >
                    <Ionicons name="create" size={24} color="white" style={{ marginRight: 8 }} />
                    <Text className="text-white font-bold text-lg">MODIFIER</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
