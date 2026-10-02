import { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

/**
 * The scheme forced by the user's Theme setting, or null while it is "System".
 * Provided by ThemeProvider; everything that draws colors reads it through
 * useResolvedScheme(), so an explicit choice applies on every platform without
 * depending on the OS echoing a change event back to JS.
 */
export const ForcedSchemeContext = createContext<'light' | 'dark' | null>(null);

/** What is actually showing: the forced scheme, else the device's. */
export function useResolvedScheme(): 'light' | 'dark' {
  const forced = useContext(ForcedSchemeContext);
  const device = useColorScheme();
  return forced ?? (device === 'dark' ? 'dark' : 'light');
}
