import { COLORS, RADIUS, SPACING } from '@/src/core/constants/theme';
import type { Incident } from '@/src/core/services/incidentAdminService';
import { Ionicons } from '@expo/vector-icons';
import { Platform, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

interface Props {
  incident: Incident;
  onPress: (incident: Incident) => void;
  style?: StyleProp<ViewStyle>;
}

export default function IncidentCard({ incident, onPress, style }: Props) {
  const isOpen = incident.status === 'open';

  return (
    <TouchableOpacity style={[styles.card, style]} onPress={() => onPress(incident)} activeOpacity={0.7}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{incident.type}</Text>
          </View>
          <Text style={styles.date}>{new Date(incident.created_at).toLocaleDateString()}</Text>
        </View>
        <Text style={styles.title} numberOfLines={1}>{incident.title || incident.incident_type}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {incident.description || 'Aucune description fournie.'}
        </Text>
        <View style={styles.location}>
          <Ionicons name="navigate-outline" size={13} color={COLORS.textSecondary} />
          <Text style={styles.meta} numberOfLines={1}>{incident.commune_name} • {incident.village}</Text>
        </View>
        <View style={styles.footer}>
          <Text style={styles.meta} numberOfLines={1}>Par: {incident.created_by_name || 'Agent Terrain'}</Text>
          {incident.reclamation ? (
            <View style={styles.reclamationBadge}>
              <Text style={styles.reclamationText}>RÉC</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.status, { backgroundColor: isOpen ? COLORS.signalRedTint : COLORS.signalGreenTint }]}>
        <Text style={[styles.statusText, { color: isOpen ? COLORS.signalRed : COLORS.signalGreen }]}>
          {isOpen ? 'EN COURS' : 'CLÔTURÉ'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
    }),
  },
  content: {
    flex: 1,
    minWidth: 0,
    paddingRight: SPACING.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeBadge: {
    backgroundColor: COLORS.background,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  date: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginTop: 6,
  },
  description: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    lineHeight: 18,
  },
  location: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.sm,
    gap: SPACING.xs,
  },
  meta: {
    flexShrink: 1,
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.background,
  },
  reclamationBadge: {
    backgroundColor: COLORS.signalOrangeTint,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  reclamationText: {
    fontSize: 9,
    fontWeight: '800',
    color: COLORS.signalOrange,
  },
  status: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    width: 90,
    alignItems: 'center',
  },
  statusText: {
    fontWeight: '800',
    fontSize: 11,
  },
});
