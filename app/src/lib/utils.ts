import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Calendar months (1-12) the stay covers, in order, capped at a full year;
 *  null without a valid check-in/check-out pair. Drives the per-month flood
 *  risk view ("list all the possibilities" for the user's own dates). */
export function stayMonthsList(checkIn: string, checkOut: string): number[] | null {
  if (!checkIn || !checkOut) return null;
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || !(a < b)) return null;
  const months: number[] = [];
  const d = new Date(a);
  while (d <= b && months.length < 12) {
    const m = d.getMonth() + 1;
    if (!months.includes(m)) months.push(m);
    d.setMonth(d.getMonth() + 1, 1);
  }
  return months;
}

/** The three months of the next full calendar quarter (Jan–Mar, Apr–Jun,
 *  Jul–Sep, Oct–Dec) after today — the flood-risk window when the user has
 *  not picked stay dates. */
export function nextQuarterMonths(today = new Date()): number[] {
  const start = ((Math.floor(today.getMonth() / 3) + 1) % 4) * 3 + 1;
  return [start, start + 1, start + 2];
}

/** "Oct", "Nov", … for a calendar month 1-12. */
export function monthShortName(month: number): string {
  return new Date(2000, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

/** Does any part of the stay fall in Bangkok's Sep–Oct rainy/flood window?
 *  Pure date math on the user's own inputs — current-month flood RISK comes
 *  from the backend's /flood-risk (the single seasonal-rain source). */
export function staySpansRainySeason(checkIn: string, checkOut: string): boolean {
  if (!checkIn || !checkOut) return false;
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  if (!(a < b)) return false;
  const d = new Date(a);
  while (d <= b) {
    const m = d.getMonth() + 1;
    if (m === 9 || m === 10) return true;
    d.setMonth(d.getMonth() + 1, 1);
  }
  return false;
}
