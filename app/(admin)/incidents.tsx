import { supabase } from '@/lib/supabase';
import type { Incident } from '@/types';
import { FlashList } from '@shopify/flash-list';
import { format } from 'date-fns';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AdminIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [filteredIncidents, setFilteredIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchIncidents();
  }, []);

  useEffect(() => {
    if (search) {
      const filtered = incidents.filter(
        (i) =>
          i.village.toLowerCase().includes(search.toLowerCase()) ||
          i.incident_type.toLowerCase().includes(search.toLowerCase())
      );
      setFilteredIncidents(filtered);
    } else {
      setFilteredIncidents(incidents);
    }
  }, [search, incidents]);

  const fetchIncidents = async () => {
    try {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setIncidents([]);
        setFilteredIncidents([]);
      } else {
        setIncidents(data || []);
        setFilteredIncidents(data || []);
      }
    } catch {
      setIncidents([]);
      setFilteredIncidents([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'open' ? 'closed' : 'open';
    const { error } = await supabase
      .from('incidents')
      .update({ status: newStatus })
      .eq('id', id);

    if (!error) {
      fetchIncidents();
    }
  };

  const renderItem = ({ item }: { item: Incident }) => (
    <View className="bg-white p-4 mb-3 rounded-lg shadow-sm border border-gray-100">
      <View className="flex-row justify-between items-start mb-2">
        <View className="flex-row items-center flex-1">
          <View
            className={`px-2 py-1 rounded mr-2 ${item.type === 'MT' ? 'bg-red-100' : 'bg-blue-100'}`}
          >
            <Text
              className={`text-xs font-bold ${item.type === 'MT' ? 'text-red-700' : 'text-blue-700'}`}
            >
              {item.type}
            </Text>
          </View>
          <Text className="font-bold text-gray-900 text-lg flex-1" numberOfLines={1}>
            {item.title || item.incident_type}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => toggleStatus(item.id, item.status)}
          className={`px-3 py-1 rounded-full ${item.status === 'open' ? 'bg-green-100' : 'bg-gray-100'}`}
        >
          <Text
            className={`text-xs font-bold capitalize ${item.status === 'open' ? 'text-green-700' : 'text-gray-600'}`}
          >
            {item.status}
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row justify-between mt-2">
        <Text className="text-gray-500 text-sm">{item.village}</Text>
        <Text className="text-gray-400 text-sm">
          {format(new Date(item.date), 'MMM d, yyyy')}
        </Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50 p-4">
      <View className="mb-4">
        <TextInput
          className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-gray-900"
          placeholder="Search by village or type..."
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" />
      ) : (
        <FlashList
          data={filteredIncidents}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="items-center justify-center py-10">
              <Text className="text-gray-500">No incidents found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
