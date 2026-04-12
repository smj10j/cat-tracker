/**
 * Date helpers for native DateTimePicker components.
 *
 * These convert between YYYY-MM-DD strings and JS Date objects for
 * @react-native-community/datetimepicker, which requires Date instances.
 */

/** Parse a YYYY-MM-DD string into a local Date object. */
export function parseDate(str: string): Date {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Format a Date object as a YYYY-MM-DD string. */
export function formatDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
