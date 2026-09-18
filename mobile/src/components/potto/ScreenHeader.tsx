import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { PottoFonts, usePottoColors } from '@/constants/potto-theme';

export function ScreenHeader({
  title,
  onBack,
  right,
}: {
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const colors = usePottoColors();
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={onBack ?? (() => router.back())}
        style={[styles.iconBtn, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.ink, fontSize: 18 }}>{'←'}</Text>
      </Pressable>
      <Text
        numberOfLines={1}
        style={[
          styles.title,
          { color: colors.ink, fontFamily: Platform.OS === 'web' ? undefined : PottoFonts.display },
        ]}>
        {title}
      </Text>
      {right ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  spacer: { width: 36 },
});
