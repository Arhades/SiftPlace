import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
