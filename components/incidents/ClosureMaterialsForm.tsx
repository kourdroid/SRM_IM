import MaterialUsageSelector, { type MaterialUsageChoice } from '@/components/MaterialUsageSelector';
import { createEmptyMaterialFormRow, type MaterialFormRow } from '@/lib/materials';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface Props {
  usage: MaterialUsageChoice;
  onUsageChange: (usage: MaterialUsageChoice) => void;
  rows: MaterialFormRow[];
  onRowsChange: (rows: MaterialFormRow[]) => void;
  disabled?: boolean;
}

export default function ClosureMaterialsForm({ usage, onUsageChange, rows, onRowsChange, disabled = false }: Props) {
  const updateRow = (id: string, patch: Partial<MaterialFormRow>) => {
    onRowsChange(rows.map(row => row.id === id ? { ...row, ...patch } : row));
  };

  return (
    <View style={styles.block}>
      <Text style={styles.title}>Matériel utilisé</Text>
      <Text style={styles.help}>Déclarez le matériel utilisé ou confirmez qu’aucun matériel n’a été utilisé.</Text>
      <MaterialUsageSelector value={usage} onChange={onUsageChange} disabled={disabled} />
      {usage === 'used' ? (
        <View style={styles.rows}>
          {rows.map((row, index) => (
            <View key={row.id} style={styles.row}>
              <TextInput
                style={styles.nameInput}
                value={row.materialName}
                onChangeText={value => updateRow(row.id, { materialName: value })}
                placeholder={index === 0 ? 'Matériel' : 'Autre matériel'}
                placeholderTextColor={COLORS.textMuted}
                editable={!disabled}
              />
              <TextInput
                style={styles.quantityInput}
                value={row.quantity}
                onChangeText={value => updateRow(row.id, { quantity: value })}
                placeholder="Qté"
                placeholderTextColor={COLORS.textMuted}
                keyboardType="decimal-pad"
                editable={!disabled}
              />
              {rows.length > 1 ? (
                <TouchableOpacity
                  style={styles.remove}
                  onPress={() => onRowsChange(rows.filter(item => item.id !== row.id))}
                  disabled={disabled}
                  accessibilityRole="button"
                  accessibilityLabel="Retirer ce matériel"
                >
                  <Ionicons name="trash-outline" size={18} color={COLORS.signalRed} />
                </TouchableOpacity>
              ) : null}
            </View>
          ))}
          <TouchableOpacity
            style={styles.add}
            onPress={() => onRowsChange([...rows, createEmptyMaterialFormRow()])}
            disabled={disabled}
          >
            <Ionicons name="add" size={18} color={COLORS.textPrimary} />
            <Text style={styles.addText}>Ajouter un matériel</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
}

const input = {
  backgroundColor: COLORS.surface,
  borderRadius: RADIUS.md,
  borderWidth: 1,
  borderColor: COLORS.borderStrong,
  padding: SPACING.md,
  color: COLORS.textPrimary,
  fontSize: 15,
} as const;

const styles = StyleSheet.create({
  block: {
    marginTop: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  title: {
    ...TYPOGRAPHY.labelUppercase,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  help: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  rows: { gap: SPACING.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  nameInput: {
    ...input,
    flex: 1,
    minWidth: 0,
    fontWeight: '600',
  },
  quantityInput: {
    ...input,
    width: 84,
    fontWeight: '800',
    textAlign: 'center',
  },
  remove: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#FECACA',
    backgroundColor: COLORS.signalRedTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  add: {
    alignSelf: 'flex-start',
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
  },
  addText: {
    ...TYPOGRAPHY.bodyBold,
    color: COLORS.textPrimary,
  },
});
