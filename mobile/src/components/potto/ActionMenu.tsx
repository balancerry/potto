import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { Radius, usePottoColors } from '@/constants/potto-theme';

export interface ActionMenuItem {
  label: string;
  onPress: () => void;
  destructive?: boolean;
}

export function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  const colors = usePottoColors();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState({ top: 64, right: 20 });
  const triggerRef = useRef<View>(null);

  const openMenu = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const menuHeight = items.length * 46 + 8;
      setAnchor({
        top: Math.min(y + height + 6, windowHeight - menuHeight - 12),
        right: Math.max(12, windowWidth - (x + width)),
      });
      setOpen(true);
    });
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={openMenu}
        style={[styles.trigger, { borderColor: colors.line, backgroundColor: colors.surface }]}>
        <Text style={{ color: colors.ink, fontSize: 18, fontWeight: '700' }}>{'⋯'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={[styles.menuWrap, { top: anchor.top, right: anchor.right }]}>
            <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              {items.map((item, i) => (
                <Pressable
                  key={item.label}
                  onPress={() => {
                    setOpen(false);
                    // Expo Router freezes inactive screens as soon as a new modal is pushed,
                    // so navigating in the same tick can freeze this menu mid-open behind it.
                    // A real delay (not setTimeout 0) gives the closed state a paint first.
                    setTimeout(item.onPress, 80);
                  }}
                  style={[styles.item, i < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
                  <Text style={{ color: item.destructive ? colors.neg : colors.ink, fontSize: 15, fontWeight: '600' }}>
                    {item.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,18,14,0.35)',
  },
  menuWrap: {
    position: 'absolute',
  },
  menu: {
    borderRadius: Radius.md,
    borderWidth: 1,
    minWidth: 160,
    overflow: 'hidden',
  },
  item: {
    paddingVertical: 13,
    paddingHorizontal: 18,
  },
});
