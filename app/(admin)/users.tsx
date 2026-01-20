import { supabase } from '@/lib/supabase';
import type { UserProfile } from '@/types';
import { FlashList } from '@shopify/flash-list';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        setUsers([]);
      } else {
        setUsers(data || []);
      }
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }: { item: UserProfile }) => (
    <View className="bg-white p-4 mb-3 rounded-lg shadow-sm border border-gray-100 flex-row justify-between items-center">
      <View>
        <Text className="font-bold text-gray-900 text-lg">{item.name || 'Unknown'}</Text>
        <Text className="text-gray-500 text-sm">ID: {item.id.substring(0, 8)}...</Text>
      </View>
      <View
        className={`px-3 py-1 rounded-full ${item.role === 'admin' ? 'bg-purple-100' : 'bg-blue-100'}`}
      >
        <Text
          className={`text-xs font-bold capitalize ${item.role === 'admin' ? 'text-purple-700' : 'text-blue-700'}`}
        >
          {item.role}
        </Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-gray-50 p-4">
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" />
      ) : (
        <FlashList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <View className="items-center justify-center py-10">
              <Text className="text-gray-500">No users found</Text>
            </View>
          }
        />
      )}
    </View>
  );
}
