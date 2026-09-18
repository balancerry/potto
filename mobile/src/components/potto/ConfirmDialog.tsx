import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, usePottoColors } from '@/constants/potto-theme';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const colors = usePottoColors();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={[styles.card, { backgroundColor: colors.surface }]} onPress={() => {}}>
          <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.inkSoft }]}>{message}</Text>
          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              style={[styles.btn, styles.cancelBtn, { borderColor: colors.line, backgroundColor: colors.surface }]}>
              <Text style={{ color: colors.ink, fontWeight: '600', fontSize: 14.5 }}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={[styles.btn, { backgroundColor: destructive ? colors.neg : colors.ink }]}>
              <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14.5 }}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,18,14,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    padding: 22,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 10,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtn: {
    borderWidth: 1,
  },
});
