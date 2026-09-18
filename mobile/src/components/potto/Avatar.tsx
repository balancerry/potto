import { StyleSheet, Text, View } from 'react-native';

import { usePottoColors } from '@/constants/potto-theme';
import { initials } from '@/utils/money';

export function Avatar({ name, size = 44, admin = false }: { name: string; size?: number; admin?: boolean }) {
  const colors = usePottoColors();
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: admin ? colors.gold : colors.accentSoft,
        },
      ]}>
      <Text style={{ color: admin ? '#fff' : colors.accent, fontWeight: '700', fontSize: size * 0.36 }}>
        {initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
