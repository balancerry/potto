import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { usePottoColors } from '@/constants/potto-theme';

const TABS = [
  { key: 'overview', label: 'Overview', path: '' },
  { key: 'activity', label: 'Activity', path: '/transactions' },
  { key: 'people', label: 'People', path: '/members' },
  { key: 'settle', label: 'Settle', path: '/settle' },
] as const;

export function PotSectionNav({ potId, current }: { potId: string; current: (typeof TABS)[number]['key'] }) {
  const colors = usePottoColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroll}>
      {TABS.map((tab) => {
        const selected = tab.key === current;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) router.replace(`/pot/${potId}${tab.path}`);
            }}
            style={[
              styles.tab,
              { backgroundColor: selected ? colors.accent : 'transparent' },
            ]}>
            <Text style={{ color: selected ? colors.onAccent : colors.inkSoft, fontSize: 14, fontWeight: '600' }}>{tab.label}</Text>
          </Pressable>
        );
      })}
      <View style={styles.end} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 20 },
  tab: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minHeight: 44, justifyContent: 'center' },
  end: { width: 8 },
});
