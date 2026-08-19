/**
 * xucasa brand tokens — derived from the web app's :root CSS variables in index.css.
 * Primary: Redfin-inspired red (HSL 359 73% 45%)
 * Body font: DM Sans | Display font: Outfit
 */

const colors = {
  light: {
    // Legacy aliases
    text: '#0D1828',
    tint: '#C71E21',

    background: '#FAFAFA',
    foreground: '#0D1828',

    card: '#FFFFFF',
    cardForeground: '#0D1828',

    primary: '#C71E21',
    primaryForeground: '#FFFFFF',

    secondary: '#EEF3FA',
    secondaryForeground: '#0D1828',

    muted: '#F0F4FA',
    mutedForeground: '#697A90',

    accent: '#F0F4FA',
    accentForeground: '#0D1828',

    destructive: '#EF4444',
    destructiveForeground: '#FFFFFF',

    border: '#DCE4EF',
    input: '#DCE4EF',
  },

  dark: {
    text: '#E2EAF5',
    tint: '#E04547',

    background: '#08101E',
    foreground: '#E2EAF5',

    card: '#0F1829',
    cardForeground: '#E2EAF5',

    primary: '#E04547',
    primaryForeground: '#FFFFFF',

    secondary: '#1A2540',
    secondaryForeground: '#E2EAF5',

    muted: '#1A2540',
    mutedForeground: '#7A90AA',

    accent: '#1A2540',
    accentForeground: '#E2EAF5',

    destructive: '#DC3030',
    destructiveForeground: '#FFFFFF',

    border: '#1E2E45',
    input: '#1E2E45',
  },

  // 0.75rem = 12px — from web --radius: 0.75rem
  radius: 12,
};

export default colors;
