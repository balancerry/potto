'use client';

import { Toaster } from 'sonner';
import { useTheme } from '@/components/theme/theme-provider';

/** Sonner needs the resolved theme explicitly; an explicit app choice may differ from the OS. */
export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  return <Toaster richColors position="top-center" closeButton theme={resolvedTheme} />;
}
