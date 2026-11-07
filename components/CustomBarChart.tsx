import { COLORS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

type Props = {
  data: { value: number; label: string }[];
  title: string;
};

const MONTHS: Record<string, { short: string; full: string }> = {
  Jan: { short: 'Jan', full: 'Janvier' },
  Feb: { short: 'Fév', full: 'Février' },
  Mar: { short: 'Mar', full: 'Mars' },
  Apr: { short: 'Avr', full: 'Avril' },
  May: { short: 'Mai', full: 'Mai' },
  Jun: { short: 'Juin', full: 'Juin' },
  Jul: { short: 'Juil', full: 'Juillet' },
  Aug: { short: 'Août', full: 'Août' },
  Sep: { short: 'Sep', full: 'Septembre' },
  Oct: { short: 'Oct', full: 'Octobre' },
  Nov: { short: 'Nov', full: 'Novembre' },
  Dec: { short: 'Déc', full: 'Décembre' },
};

export default function CustomBarChart({ data, title }: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selected = selectedIndex === null ? undefined : data[selectedIndex];
  const highest = Math.max(1, ...data.map(point => point.value));

  const bars = data.map((point, index) => {
    const isSelected = index === selectedIndex;
    return {
      value: point.value,
      label: MONTHS[point.label]?.short ?? point.label,
      frontColor: isSelected ? COLORS.textPrimary : COLORS.signalBlue,
      topLabelComponent: isSelected
        ? () => <Text style={styles.barValue}>{point.value}</Text>
        : undefined,
    };
  });

  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.caption, selected && styles.captionActive]} accessibilityLiveRegion="polite">
        {selected
          ? `${MONTHS[selected.label]?.full ?? selected.label} : ${selected.value} incident${selected.value > 1 ? 's' : ''}`
          : 'Touchez un mois pour voir son nombre d’incidents.'}
      </Text>
      <View style={styles.chart}>
        <BarChart
          data={bars}
          barWidth={22}
          noOfSections={4}
          maxValue={Math.ceil(highest * 1.2)}
          barBorderRadius={4}
          yAxisThickness={0}
          xAxisThickness={0}
          hideRules
          isAnimated
          onPress={(_item: unknown, index: number) => {
            setSelectedIndex(current => current === index ? null : index);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...TYPOGRAPHY.title,
    color: COLORS.textPrimary,
  },
  caption: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    marginBottom: SPACING.lg,
  },
  captionActive: {
    color: COLORS.textPrimary,
  },
  chart: {
    alignItems: 'center',
  },
  barValue: {
    ...TYPOGRAPHY.label,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
});
