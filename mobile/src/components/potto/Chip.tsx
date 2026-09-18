import { Pressable, StyleSheet, Text } from 'react-native';

import { Radius, usePottoColors } from '@/constants/potto-theme';

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = usePottoColors();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.ink : colors.surface,
          borderColor: selected ? colors.ink : colors.line,
        },
      ]}>
      <Text numberOfLines={1} style={[styles.chipText, { color: selected ? colors.paper : colors.inkSoft }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexShrink: 0,
    flexDirection: 'row',
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontWeight: '600',
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: 'center',
    includeFontPadding: false,
  },
});
