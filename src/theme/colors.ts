// Extracted from mockups/*.png — see src/theme/design-tokens.json for source notes.
// Close-enough approximations, refine by hand if exact hex values matter.
export const lightColors = {
  background: {
    screen: '#FFFFFF',
    headerAccent: '#CFF3DA',
    keypadKey: '#F0F0F0',
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#9B9B9B',
    placeholder: '#C6C6C6',
    onDark: '#FFFFFF',
  },
  category: {
    green: { background: '#CFF3DA', icon: '#234D2E' },
    pink: { background: '#F7D6DE', icon: '#A24F63' },
    purple: { background: '#E7DAF5', icon: '#7A5AA8' },
    blue: { background: '#D8E7F7', icon: '#3E6FA6' },
    peach: { background: '#F6DECB', icon: '#B97A4C' },
    teal: { background: '#D6F1EC', icon: '#327E71' },
  },
  status: {
    paid: { background: '#CFF3DA', text: '#1A1A1A' },
    unpaid: { background: '#E2E2E2', text: '#6E6E6E' },
  },
  segment: {
    track: '#EDEDED',
    active: '#131313',
    activeText: '#FFFFFF',
    inactiveText: '#8C8C8C',
  },
  keypad: {
    digitBackground: '#F0F0F0',
    digitText: '#1A1A1A',
    deleteKeyBackground: '#F7C9CF',
    toggleKeyBackground: '#CFF3DA',
    currencyKeyBackground: '#F5E27A',
    confirmKeyBackground: '#131313',
    confirmIcon: '#FFFFFF',
  },
  pill: {
    textInputBackground: '#D9E4FA',
    movementTypeBackground: '#F0DFF5',
  },
  button: {
    deleteBackground: '#F2705C',
    deleteText: '#FFFFFF',
  },
  navigation: {
    activeIcon: '#2F80ED',
    inactiveIcon: '#1A1A1A',
    background: '#FFFFFF',
  },
  identity: {
    // Not from the mockups -- a user-specified accent, used as the OTP code boxes' filled state.
    badgeBackground: '#FFCCDB',
  },
} as const;

export type Colors = typeof lightColors;
