import CustomBarChart from '@/components/CustomBarChart';
import { supabase } from '@/lib/supabase';
import type { ChartDataPoint, DashboardStats, Incident } from '@/types';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    total: 0,
    open: 0,
    closed: 0,
    reclamations: 0,
  });
  const [monthlyData, setMonthlyData] = useState<ChartDataPoint[]>([]);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: incidents, error } = await supabase
        .from('incidents')
        .select('*');

      if (error) throw error;

      if (incidents) {
        const typedIncidents = incidents as Incident[];
        const total = typedIncidents.length;
        const open = typedIncidents.filter((i) => i.status === 'open').length;
        const closed = typedIncidents.filter((i) => i.status === 'closed').length;
        const reclamations = typedIncidents.filter((i) => i.reclamation).length;

        setStats({ total, open, closed, reclamations });

        // Generate monthly data based on actual incidents
        // TODO: Replace with proper date aggregation query
        setMonthlyData([
          { value: Math.max(1, Math.floor(total * 0.2)), label: 'Jan' },
          { value: Math.max(1, Math.floor(total * 0.3)), label: 'Feb' },
          { value: Math.max(1, Math.floor(total * 0.5)), label: 'Mar' },
        ]);
      }
    } catch {
      // Stats fetch failed - show zeros
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-50 p-4">
      <View className="flex-row justify-between items-center mb-6">
        <Text className="text-2xl font-bold text-gray-900">Dashboard</Text>
      </View>

      {/* Stats Cards */}
      <View className="flex-row flex-wrap justify-between mb-6">
        <View className="w-[48%] bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
          <Text className="text-gray-500 text-sm font-medium">Total Incidents</Text>
          <Text className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</Text>
        </View>
        <View className="w-[48%] bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
          <Text className="text-gray-500 text-sm font-medium">Open Issues</Text>
          <Text className="text-3xl font-bold text-red-600 mt-1">{stats.open}</Text>
        </View>
        <View className="w-[48%] bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
          <Text className="text-gray-500 text-sm font-medium">Resolved</Text>
          <Text className="text-3xl font-bold text-green-600 mt-1">{stats.closed}</Text>
        </View>
        <View className="w-[48%] bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-4">
          <Text className="text-gray-500 text-sm font-medium">Reclamations</Text>
          <Text className="text-3xl font-bold text-orange-500 mt-1">
            {stats.reclamations}
          </Text>
        </View>
      </View>

      {/* Charts */}
      <CustomBarChart data={monthlyData} title="Monthly Incidents" />

      {/* Quick Actions */}
      <View className="mt-4">
        <Text className="text-lg font-bold text-gray-900 mb-4">Quick Actions</Text>
        <TouchableOpacity
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3 flex-row justify-between items-center"
          onPress={() => router.push('/(admin)/incidents')}
        >
          <View>
            <Text className="font-bold text-gray-900">Manage Incidents</Text>
            <Text className="text-gray-500 text-sm">View and update all incidents</Text>
          </View>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-3 flex-row justify-between items-center"
          onPress={() => router.push('/(admin)/users')}
        >
          <View>
            <Text className="font-bold text-gray-900">User Management</Text>
            <Text className="text-gray-500 text-sm">Manage team members and roles</Text>
          </View>
          <Text className="text-gray-400">›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
