/** INR + date formatting helpers (en-IN, DD-MM-YYYY). */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** en-IN digit grouping: 12,34,567 */
export function formatINRNumber(amount: number): string {
  const negative = amount < 0;
  const rounded = Math.round(Math.abs(amount) * 100) / 100;
  const [intPart, decPart] = rounded.toFixed(rounded % 1 === 0 ? 0 : 2).split('.');
  let grouped = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  return `${negative ? '-' : ''}${grouped}${decPart ? `.${decPart}` : ''}`;
}

export function formatINR(amount: number): string {
  return `₹${formatINRNumber(amount)}`;
}

/** Parse YYYY-MM-DD as local calendar date (avoids UTC off-by-one). */
export function parseLocalDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  const iso = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(iso);
}

/** ISO date (YYYY-MM-DD or full ISO) → DD-MM-YYYY */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = parseLocalDate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

/** "2026-07" → "July 2026" */
export function formatMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return month;
  return `${MONTHS[m - 1]} ${y}`;
}

/** "2026-07" → "Jul 2026" */
export function formatMonthShort(month: string): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return month;
  return `${MONTHS[m - 1].slice(0, 3)} ${y}`;
}

export function daysUntil(iso: string): number {
  const target = parseLocalDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
}
