import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Radius, Space, usePottoColors } from '@/constants/potto-theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'accent' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
}

export function Button({ label, onPress, variant = 'primary', disabled, loading, fullWidth }: ButtonProps) {
  const colors = usePottoColors();

  const bg = {
    primary: colors.ink,
    secondary: colors.surface,
    accent: colors.accent,
    danger: colors.negSoft,
    ghost: 'transparent',
  }[variant];
  const fg = {
    primary: colors.paper,
    secondary: colors.ink,
    accent: '#fff',
    danger: colors.neg,
    ghost: colors.inkSoft,
  }[variant];
  const border = variant === 'secondary' || variant === 'ghost' ? colors.line : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: border === 'transparent' ? 0 : 1,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          width: fullWidth ? '100%' : undefined,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View>
          <Text style={{ color: fg, fontWeight: '600', fontSize: 14.5 }}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="primary" />;
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="secondary" />;
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    paddingVertical: 14,
    paddingHorizontal: Space.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
