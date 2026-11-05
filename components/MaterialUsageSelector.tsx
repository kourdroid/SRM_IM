import { Ionicons } from '@expo/vector-icons';
import { Text, TouchableOpacity, View } from 'react-native';

export type MaterialUsageChoice = 'used' | 'none' | null;

export default function MaterialUsageSelector({ value, onChange, disabled = false }: {
  value: MaterialUsageChoice;
  onChange: (value: 'used' | 'none') => void;
  disabled?: boolean;
}) {
  return (
    <View accessibilityRole="radiogroup" style={{ gap: 8, marginBottom: 12 }}>
      {(['used', 'none'] as const).map(choice => (
        <TouchableOpacity
          key={choice}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === choice, disabled }}
          disabled={disabled}
          onPress={() => onChange(choice)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48,
            padding: 12, borderRadius: 8, borderWidth: 1,
            borderColor: value === choice ? '#111827' : '#D1D5DB',
            backgroundColor: value === choice ? '#F3F4F6' : '#FFFFFF', opacity: disabled ? 0.6 : 1 }}
        >
          <Ionicons name={value === choice ? 'radio-button-on' : 'radio-button-off'} size={22} color="#111827" />
          <Text style={{ flex: 1, color: '#111827', fontSize: 14, fontWeight: '700' }}>
            {choice === 'used' ? 'Avec matériel' : 'Aucun matériel utilisé'}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
