import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePottoColors } from '@/constants/potto-theme';

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const colors = usePottoColors();

  const showToast = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(msg);
    timer.current = setTimeout(() => setMessage(null), 2200);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {message && (
        <SafeAreaView pointerEvents="none" style={styles.wrap}>
          <Text style={[styles.toast, { backgroundColor: colors.ink, color: colors.paper }]}>{message}</Text>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 24,
    alignItems: 'center',
  },
  toast: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 30,
    fontSize: 13.5,
    fontWeight: '600',
    overflow: 'hidden',
  },
});
