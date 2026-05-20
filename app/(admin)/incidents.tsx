import { IncidentAdminService, type Incident } from '@/src/core/services/incidentAdminService';
import { FlashList } from '@shopify/flash-list';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ManageIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => { loadInitial(); }, []);

  const loadInitial = async () => {
    try {
      const data = await IncidentAdminService.getIncidents(20);
      setIncidents(data);
    } catch (e) {
      Alert.alert('Error', String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore || incidents.length === 0) return;
    setLoadingMore(true);
    try {
      const last = incidents[incidents.length - 1];
      const data = await IncidentAdminService.getIncidents(20, last.created_at);
      if (data.length > 0) {
        setIncidents(prev => [...prev, ...data]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMore(false);
    }
  };

  const toggleStatus = async (item: Incident) => {
    const newStatus = item.status === 'open' ? 'closed' : 'open';
    try {
      await IncidentAdminService.updateIncidentStatus({ id: item.id, status: newStatus });
      setIncidents(prev => prev.map(i => i.id === item.id ? { ...i, status: newStatus } : i));
    } catch (e: any) {
      if (e.message?.includes('NETWORK_OFFLINE')) {
        Alert.alert('Offline Action Blocked', 'Admin mutations require an active network connection to prevent sync conflicts.');
      } else {
        Alert.alert('Error updating status', String(e));
      }
    }
  };

  const renderItem = ({ item }: { item: Incident }) => {
    const isOpen = item.status === 'open';

    return (
      <View style={styles.card}>
        <View style={styles.cardContent}>
          <Text style={styles.description} numberOfLines={2}>
            {item.description || 'No description provided'}
          </Text>
          <Text style={styles.createdBy}>
            Reported by: {item.created_by_name || 'System'}
          </Text>
          <Text style={styles.date}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
          {item.reclamation && (
            <Text style={styles.reclamationBadge}>Reclamation</Text>
          )}
        </View>
        <TouchableOpacity
          style={[styles.statusBadge, isOpen ? styles.statusOpen : styles.statusClosed]}
          onPress={() => toggleStatus(item)}
          activeOpacity={0.7}
        >
          <Text style={[styles.statusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
            {item.status.toUpperCase()}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlashList
        data={incidents}
        renderItem={renderItem}
        estimatedItemSize={100}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={styles.footerLoader} /> : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 10,
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardContent: {
    flex: 1,
    paddingRight: 16,
  },
  description: {
    fontWeight: '700',
    color: '#111827',
    fontSize: 15,
  },
  createdBy: {
    color: '#4B5563',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  date: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 2,
  },
  reclamationBadge: {
    color: '#F97316',
    fontSize: 11,
    marginTop: 6,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  statusOpen: {
    backgroundColor: '#FEE2E2',
  },
  statusClosed: {
    backgroundColor: '#DCFCE7',
  },
  statusText: {
    fontWeight: '700',
    fontSize: 13,
  },
  statusTextOpen: {
    color: '#B91C1C',
  },
  statusTextClosed: {
    color: '#15803D',
  },
  footerLoader: {
    marginVertical: 16,
  },
});
