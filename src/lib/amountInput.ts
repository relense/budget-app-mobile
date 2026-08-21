// Pure text-manipulation helpers backing the shared numeric keypad (mockups/*.png's calculator
// UI) -- kept free of any component state so the typing rules are unit-testable directly,
// independent of whichever screen embeds the keypad.

export function appendDigit(text: string, digit: string): string {
  const decimals = text.split('.')[1];
  if (decimals !== undefined && decimals.length >= 2) return text;
  if (text === '0') return digit;
  return text + digit;
}

export function appendDecimalPoint(text: string): string {
  if (text.includes('.')) return text;
  return text === '' ? '0.' : `${text}.`;
}

export function backspaceAmount(text: string): string {
  return text.slice(0, -1);
}

export function amountTextToCents(text: string): number {
  const value = parseFloat(text);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}
