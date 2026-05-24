import { Colors } from '@/constants/theme';

export function useAppTheme() {
  const scheme = 'light';
  return {
    colors: Colors[scheme],
    theme: scheme,
  };
}
