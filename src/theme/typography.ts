// Extracted from mockups/*.png — see src/theme/design-tokens.json for source notes.
// fontFamily is approximate (a rounded geometric sans, visually close to SF Pro Rounded /
// Poppins / Nunito) — no exact family is identifiable from screenshots alone.
export const typography = {
  fontFamily: 'System',
  scale: {
    displayAmount: { fontSize: 34, fontWeight: '700' },
    headerStat: { fontSize: 15, fontWeight: '700' },
    screenTitle: { fontSize: 17, fontWeight: '600' },
    listTitle: { fontSize: 16, fontWeight: '600' },
    listAmount: { fontSize: 16, fontWeight: '600' },
    listSubtitle: { fontSize: 12, fontWeight: '400' },
    segmentLabel: { fontSize: 13, fontWeight: '500' },
    placeholder: { fontSize: 14, fontWeight: '400' },
    keypadDigit: { fontSize: 24, fontWeight: '500' },
    buttonLabel: { fontSize: 15, fontWeight: '600' },
  },
} as const;

export type Typography = typeof typography;
