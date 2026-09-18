export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function toRupees(paise: number): number {
  return paise / 100;
}

export function formatMoney(paise: number, opts: { showSign?: boolean } = {}): string {
  const { showSign = false } = opts;
  const abs = Math.round(Math.abs(paise));
  const neg = paise < 0 && abs !== 0;
  // Decide decimal places from integer paise, not the divided float, so a
  // value like 189950 always renders as "1,899.50" (never "1,899.5") and
  // whole-rupee amounts never pick up float noise from the division below.
  const hasPaise = abs % 100 !== 0;
  const rupees = abs / 100;
  const str = rupees.toLocaleString('en-IN', {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: hasPaise ? 2 : 0,
  });
  let out = `₹${str}`;
  if (neg) out = `-${out}`;
  else if (showSign) out = `+${out}`;
  return out;
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function formatDateFull(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

let counter = 0;
export function uid(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
