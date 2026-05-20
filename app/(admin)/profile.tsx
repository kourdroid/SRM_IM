import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AdminProfile() {
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6', padding: 20 }}>
      {/* Profile Header */}
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 40 }}>
        <View style={{
          width: 100,
          height: 100,
          backgroundColor: '#DAF22C',
          borderRadius: 50,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          borderWidth: 4,
          borderColor: '#FFFFFF'
        }}>
          <Text style={{ fontSize: 40, fontWeight: '900', color: '#111827' }}>
            {user?.email?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 }}>{user?.email}</Text>
        <View style={{
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 4,
          borderWidth: 1,
          borderColor: '#E5E7EB',
        }}>
          <Text style={{ color: '#111827', fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 }}>
            {isAdmin ? 'Administrator' : 'Field Agent'}
          </Text>
        </View>
      </View>

      {/* Menu Options */}
      <View style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E5E7EB',
      }}>

        <TouchableOpacity
          style={{
            padding: 20,
            borderBottomWidth: 1,
            borderBottomColor: '#F3F4F6',
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 32, height: 32, backgroundColor: '#F3F4F6', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="settings" size={16} color="#111827" />
            </View>
            <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16 }}>Settings</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FFFFFF',
          }}
          onPress={handleSignOut}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 32, height: 32, backgroundColor: '#FEF2F2', borderRadius: 4, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            </View>
            <Text style={{ color: '#EF4444', fontWeight: 'bold', fontSize: 16 }}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 'auto', marginBottom: 16, alignItems: 'center' }}>
        <Text style={{ color: '#9CA3AF', fontSize: 14, fontWeight: 'bold' }}>Version 1.0.1</Text>
        <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4, letterSpacing: 1, textTransform: 'uppercase' }}>ONEE Incident Management System</Text>
      </View>
    </SafeAreaView>
  );
}
