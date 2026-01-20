import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Profile() {
  const { user, isAdmin } = useAuth();

  const handleSignOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-brand-background p-4">
      <View className="items-center mt-10 mb-8">
        <View className="w-24 h-24 bg-brand-primary rounded-full items-center justify-center mb-4 shadow-sm">
          <Text className="text-4xl font-bold text-brand-dark">
            {user?.email?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text className="text-xl font-bold text-brand-dark">{user?.email}</Text>
        <View className="bg-brand-dark px-4 py-1.5 rounded-full mt-2">
          <Text className="text-brand-primary text-xs font-bold uppercase tracking-wider">
            {isAdmin ? 'Administrator' : 'Field Agent'}
          </Text>
        </View>
      </View>

      <View className="bg-white rounded-xl overflow-hidden shadow-sm border border-gray-100">
        {isAdmin && (
          <TouchableOpacity
            className="p-4 border-b border-gray-100 flex-row items-center justify-between bg-white"
            onPress={() => router.push('/(admin)/dashboard')}
          >
            <Text className="text-brand-dark font-medium">Admin Dashboard</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        )}

        <TouchableOpacity
          className="p-4 border-b border-gray-100 flex-row items-center justify-between bg-white"
        >
          <Text className="text-brand-dark font-medium">Settings</Text>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          className="p-4 flex-row items-center justify-between bg-white"
          onPress={handleSignOut}
        >
          <Text className="text-red-600 font-medium">Sign Out</Text>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
        </TouchableOpacity>
      </View>

      <View className="mt-auto mb-4 items-center">
        <Text className="text-gray-400 text-sm">Version 1.0.1</Text>
        <Text className="text-gray-400 text-xs mt-1">ONEE Incident Management System</Text>
      </View>
    </SafeAreaView>
  );
}
