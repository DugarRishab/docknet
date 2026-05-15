import { useEffect, useState } from 'react';

const TOKENS = [
  '--background',
  '--foreground',
  '--primary',
  '--primary-foreground',
  '--muted',
  '--muted-foreground',
  '--border',
  '--destructive',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
] as const;

type Token = (typeof TOKENS)[number];

export type ThemeColors = Record<Token, string>;

function readTokens(): ThemeColors {
  const styles = getComputedStyle(document.documentElement);
  const result = {} as ThemeColors;
  for (const token of TOKENS) {
    result[token] = styles.getPropertyValue(token).trim();
  }
  return result;
}

/**
 * Reads CSS custom properties from `:root`/`.dark` so canvas-rendered
 * visualizers can stay in sync with shadcn theme tokens.
 */
export function useThemeColors(): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(() => {
    if (typeof window === 'undefined') {
      return Object.fromEntries(TOKENS.map((t) => [t, ''])) as ThemeColors;
    }
    return readTokens();
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const observer = new MutationObserver(() => setColors(readTokens()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class', 'style'],
    });
    return () => observer.disconnect();
  }, []);

  return colors;
}
