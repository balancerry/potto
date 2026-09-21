import React from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PottoFonts, usePottoColors } from '@/constants/potto-theme';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const colors = usePottoColors();
  const displayFont = Platform.OS === 'web' ? undefined : PottoFonts.display;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.paper }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <Image source={require('@/assets/icons/app-mark.png')} style={styles.mark} />
            <Text style={[styles.wordmark, { color: colors.ink, fontFamily: displayFont }]}>Potto</Text>
          </View>
          <Text style={[styles.title, { color: colors.ink, fontFamily: displayFont }]}>{title}</Text>
          {!!subtitle && <Text style={[styles.subtitle, { color: colors.inkSoft }]}>{subtitle}</Text>}
          <View style={styles.body}>{children}</View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  const colors = usePottoColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.inkSoft }]}>{label}</Text>
      {children}
      {!!error && <Text style={[styles.error, { color: colors.neg }]}>{error}</Text>}
    </View>
  );
}

export function authInputStyle(colors: ReturnType<typeof usePottoColors>, hasError?: boolean) {
  return {
    borderWidth: 1,
    borderColor: hasError ? colors.neg : colors.line,
    backgroundColor: colors.surfaceSunk,
    color: colors.ink,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 16,
  } as const;
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 36, paddingBottom: 40 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 28 },
  mark: {
    width: 36,
    height: 36,
  },
  wordmark: { fontSize: 26, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, lineHeight: 22, marginBottom: 8 },
  body: { marginTop: 20, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.2 },
  error: { fontSize: 13, marginTop: 2 },
});
