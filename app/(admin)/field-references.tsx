import {
  SrmActionButton,
  SrmScreenHeader,
  SrmStatusBadge,
} from '@/components/ui/srm';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ReferenceRoute = '/(admin)/communes' | '/(admin)/incident-types' | '/(admin)/depart-hta';
type IconName = keyof typeof Ionicons.glyphMap;

interface ReferenceCard {
  title: string;
  description: string;
  meta: string;
  icon: IconName;
  iconColor: string;
  iconBackground: string;
  route: ReferenceRoute;
}

const FIELD_REFERENCE_CARDS: ReferenceCard[] = [
  {
    title: 'Communes',
    description: 'Zones disponibles dans les incidents et les rapports.',
    meta: 'LOCALISATION',
    icon: 'map-outline',
    iconColor: COLORS.signalGreen,
    iconBackground: COLORS.signalGreenTint,
    route: '/(admin)/communes',
  },
  {
    title: "Types d'incidents",
    description: 'Listes BT et MT visibles dans le formulaire terrain.',
    meta: 'CLASSIFICATION',
    icon: 'list-outline',
    iconColor: COLORS.signalBlue,
    iconBackground: COLORS.signalBlueTint,
    route: '/(admin)/incident-types',
  },
  {
    title: 'Départs HTA',
    description: 'Départs proposés pour les incidents moyenne tension.',
    meta: 'RÉSEAU MT',
    icon: 'git-branch-outline',
    iconColor: COLORS.signalOrange,
    iconBackground: COLORS.signalOrangeTint,
    route: '/(admin)/depart-hta',
  },
];

export default function FieldReferencesScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SrmScreenHeader
          kicker="ADMINISTRATION"
          title="Référentiels terrain"
          subtitle="Listes synchronisées avec les appareils terrain"
          rightSlot={
            <SrmActionButton
              label="Retour"
              icon="arrow-back"
              variant="secondary"
              onPress={() => router.back()}
              style={styles.backButton}
            />
          }
          style={styles.header}
        />

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>CONFIGURATION OPÉRATIONNELLE</Text>
          <Text style={styles.sectionHint}>
            Ces valeurs contrôlent les choix proposés aux agents lors de la saisie.
          </Text>
        </View>

        <View style={styles.cardStack}>
          {FIELD_REFERENCE_CARDS.map((item) => (
            <TouchableOpacity
              key={item.route}
              style={styles.card}
              activeOpacity={0.82}
              onPress={() => router.push(item.route)}
            >
              <View style={[styles.cardIcon, { backgroundColor: item.iconBackground }]}>
                <Ionicons name={item.icon} size={23} color={item.iconColor} />
              </View>

              <View style={styles.cardCopy}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <SrmStatusBadge label={item.meta} variant="neutral" />
                </View>
                <Text style={styles.cardDescription}>{item.description}</Text>
              </View>

              <Ionicons name="chevron-forward" size={22} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: SPACING.xl,
    paddingBottom: 36,
  },
  header: {
    borderRadius: RADIUS.lg,
    marginBottom: 22,
    paddingTop: SPACING.xxl,
  },
  backButton: {
    width: 104,
    height: 42,
  },
  sectionHeader: {
    marginBottom: SPACING.md,
  },
  sectionLabel: {
    ...TYPOGRAPHY.labelUppercase,
    color: COLORS.textSecondary,
  },
  sectionHint: {
    ...TYPOGRAPHY.label,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  cardStack: {
    gap: SPACING.md,
  },
  card: {
    minHeight: 104,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  cardIcon: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  cardTitle: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
    flex: 1,
  },
  cardDescription: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
});
