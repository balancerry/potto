import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Radius, usePottoColors } from '@/constants/potto-theme';

interface AmountInputProps {
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  error?: string;
  autoFocus?: boolean;
}

export function AmountInput({ value, onChangeText, placeholder = '0', error, autoFocus }: AmountInputProps) {
  const colors = usePottoColors();

  const handleChange = (text: string) => {
    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const safe = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : cleaned;
    onChangeText(safe);
  };

  return (
    <View>
      <View
        style={[
          styles.wrap,
          { backgroundColor: colors.surfaceSunk, borderColor: error ? colors.neg : colors.line },
        ]}>
        <Text style={[styles.rupee, { color: colors.inkSoft }]}>{'₹'}</Text>
        <TextInput
          value={value}
          onChangeText={handleChange}
          placeholder={placeholder}
          placeholderTextColor={colors.inkSoft}
          keyboardType="decimal-pad"
          autoFocus={autoFocus}
          style={[styles.input, { color: colors.ink }]}
        />
      </View>
      {!!error && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  rupee: {
    fontWeight: '600',
    fontSize: 19,
    marginRight: 4,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: '600',
    paddingVertical: 12,
  },
  error: {
    fontSize: 12,
    marginTop: 5,
  },
});
