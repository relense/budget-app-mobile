// Fredoka (via @expo-google-fonts/fredoka, loaded in app/_layout.tsx) -- confirmed as the
// mockups' actual typeface (previously 'System' here, a documented placeholder guess). Each
// static weight is its own font family name (no variable-font weight interpolation). Every
// scale entry below sets *only* fontFamily, deliberately never fontWeight alongside it --
// setting both made iOS synthesize extra bold on top of an already-bold static font file
// (e.g. Fredoka_700Bold + fontWeight: '700' rendered visibly heavier than the font file alone),
// which is what "still looks fat" turned out to be, not the font failing to load.
const FONT_FAMILY_BY_WEIGHT = {
  '400': 'Fredoka_400Regular',
  '500': 'Fredoka_500Medium',
  '600': 'Fredoka_600SemiBold',
  '700': 'Fredoka_700Bold',
} as const;

export const typography = {
  fontFamily: FONT_FAMILY_BY_WEIGHT['400'],
  scale: {
    displayAmount: { fontSize: 34, fontFamily: FONT_FAMILY_BY_WEIGHT['700'] },
    headerStat: { fontSize: 15, fontFamily: FONT_FAMILY_BY_WEIGHT['700'] },
    screenTitle: { fontSize: 17, fontFamily: FONT_FAMILY_BY_WEIGHT['600'] },
    listTitle: { fontSize: 16, fontFamily: FONT_FAMILY_BY_WEIGHT['600'] },
    listAmount: { fontSize: 16, fontFamily: FONT_FAMILY_BY_WEIGHT['600'] },
    listSubtitle: { fontSize: 12, fontFamily: FONT_FAMILY_BY_WEIGHT['400'] },
    segmentLabel: { fontSize: 16, fontFamily: FONT_FAMILY_BY_WEIGHT['500'] },
    placeholder: { fontSize: 14, fontFamily: FONT_FAMILY_BY_WEIGHT['400'] },
    keypadDigit: { fontSize: 31, fontFamily: FONT_FAMILY_BY_WEIGHT['400'] },
    buttonLabel: { fontSize: 15, fontFamily: FONT_FAMILY_BY_WEIGHT['600'] },
    // The large typed-amount readout on calculator-style screens (add category budget, add
    // expense, etc.) -- deliberately regular weight, not bold, per explicit feedback that the
    // bold version read as too heavy at this size.
    calculatorAmount: { fontSize: 50, fontFamily: FONT_FAMILY_BY_WEIGHT['400'] },
  },
} as const;

export type Typography = typeof typography;
