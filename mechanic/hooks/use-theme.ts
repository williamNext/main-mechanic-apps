import { Colors } from '@main-mechanic/theme';

export function useAppTheme() {
  const scheme = 'light';
  return {
    colors: Colors[scheme],
    theme: scheme,
  };
}
