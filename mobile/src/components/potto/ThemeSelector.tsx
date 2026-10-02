import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, usePottoColors } from '@/constants/potto-theme';
import { THEME_OPTIONS } from '@/logic/theme';
import { useThemePreference } from '@/store/ThemeContext';

/** Light / Dark / System as a radio list. The choice applies immediately and is remembered. */
export function ThemeSelector() {
  const colors = usePottoColors();
  const { preference, setPreference } = useThemePreference();

  return (
    <View
      accessibilityRole="radiogroup"
      style={[styles.group, { borderColor: colors.line, backgroundColor: colors.surface }]}>
      {THEME_OPTIONS.map((option, index) => {
        const checked = option.value === preference;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            accessibilityLabel={`${option.label}. ${option.description}`}
            onPress={() => setPreference(option.value)}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
            ]}>
            <View style={styles.text}>
              <Text style={[styles.label, { color: colors.ink }]}>{option.label}</Text>
              <Text style={[styles.description, { color: colors.inkSoft }]}>{option.description}</Text>
            </View>
            <View style={[styles.radio, { borderColor: checked ? colors.accent : colors.line }]}>
              {checked ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderWidth: 1, borderRadius: Radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16, minHeight: 64 },
  text: { flex: 1 },
  label: { fontSize: 15.5, fontWeight: '600' },
  description: { fontSize: 12.5, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
