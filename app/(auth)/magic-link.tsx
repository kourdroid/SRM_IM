import { supabase } from '@/lib/supabase';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function MagicLink() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendMagicLink() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
      },
    });

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      Alert.alert('Success', 'Check your email for the login link!');
    }
    setLoading(false);
  }

  return (
    <SafeAreaView className="flex-1 bg-white p-6 justify-center">
      <View className="items-center mb-10">
        <Text className="text-3xl font-bold text-gray-900">Magic Link</Text>
        <Text className="text-gray-500 mt-2">Sign in without a password</Text>
      </View>

      <View className="space-y-4">
        <View>
          <Text className="text-gray-700 mb-1 font-medium">Email</Text>
          <TextInput
            className="w-full border border-gray-300 rounded-lg px-4 py-3 bg-gray-50 text-gray-900"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>

        <TouchableOpacity
          className="bg-blue-600 rounded-lg py-4 items-center mt-4"
          onPress={sendMagicLink}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg">Send Magic Link</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-4">
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text className="text-blue-600 font-bold">Back to Login</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
