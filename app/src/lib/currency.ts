// Multi-currency display. All backend math runs in THB (the base currency);
// this converts THB amounts into the user's chosen currency for display using
// the /rates table, with the same hardcoded fallback the backend ships so the
// UI never shows blanks if /rates is unreachable.

import type { RatesResponse } from "@/lib/api";

export const CURRENCIES = ["THB", "USD", "EUR", "GBP", "SGD", "JPY", "AUD", "CNY"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const SYMBOLS: Record<string, string> = {
  THB: "฿", USD: "$", EUR: "€", GBP: "£",
  SGD: "S$", JPY: "¥", AUD: "A$", CNY: "CN¥",
};

/** Units of each currency per 1 THB — approximate fallback, mirrors backend rates.py. */
const FALLBACK_PER_THB: Record<string, number> = {
  THB: 1, USD: 0.028, EUR: 0.026, GBP: 0.022,
  SGD: 0.038, JPY: 4.35, AUD: 0.043, CNY: 0.2,
};

let table: Record<string, number> = { ...FALLBACK_PER_THB };

export function setRates(res: RatesResponse | null) {
  if (res?.rates) table = { ...FALLBACK_PER_THB, ...res.rates };
}

export function fromTHB(amountTHB: number, currency: string): number {
  return amountTHB * (table[currency] ?? 1);
}

export function toTHB(amount: number, currency: string): number {
  const per = table[currency] ?? 1;
  return per ? amount / per : amount;
}

/** "$420" / "฿15,000" / "¥65,300" — whole units, user's currency. */
export function fmtMoney(amountTHB: number | null | undefined, currency: string): string {
  if (amountTHB == null) return "—";
  const v = fromTHB(amountTHB, currency);
  const rounded = currency === "JPY" || currency === "THB" ? Math.round(v) : Math.round(v);
  return (SYMBOLS[currency] ?? currency) + rounded.toLocaleString("en-US");
}

/** Primary in the user's currency, with the THB figure alongside when they differ. */
export function fmtMoneyDual(amountTHB: number | null | undefined, currency: string): string {
  if (amountTHB == null) return "—";
  if (currency === "THB") return fmtMoney(amountTHB, "THB");
  return `${fmtMoney(amountTHB, currency)} (${fmtMoney(amountTHB, "THB")})`;
}

/** Sensible budget default per currency (≈ ฿20,000). */
export function defaultBudgetFor(currency: string): number {
  return Math.max(1, Math.round(fromTHB(20000, currency)));
}
