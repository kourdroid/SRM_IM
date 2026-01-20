import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function signInWithEmail() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      router.replace('/(tabs)/home');
    }
    setLoading(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-white p-6 justify-center">
      <View className="items-center mb-12">
        <Text className="text-4xl font-bold text-brand-dark uppercase tracking-widest mb-4">
          ONEE
        </Text>
        <Text className="text-xl font-medium text-gray-500">Welcome Back</Text>
      </View>

      <View className="space-y-4">

        <View className="flex-row items-center border border-gray-200 rounded-xl px-4 h-14 bg-white">
          <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-3 text-brand-dark text-base"
            placeholder="Email"
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <View className="flex-row items-center border border-gray-200 rounded-xl px-4 h-14 bg-white">
          <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
          <TextInput
            className="flex-1 ml-3 text-brand-dark text-base"
            placeholder="Password"
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          className="bg-brand-primary rounded-xl h-14 items-center justify-center mt-6 shadow-sm"
          onPress={signInWithEmail}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text className="text-brand-dark font-bold text-lg">Login</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-gray-500">Don't have an account? </Text>
          <Link href="/(auth)/signup" asChild>
            <TouchableOpacity>
              <Text className="text-brand-primary font-bold">Sign Up</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <View className="flex-row justify-center mt-2">
          {/* Optional: Add Magic Link if needed, styling it minimally */}
        </View>
      </View>
    </SafeAreaView>
  );
}
