import type { Currency } from "@/lib/domain/types";

const SYMBOL: Record<Currency, string> = { GTQ: "Q", USD: "$" };

export function formatMoney(amount: number, currency: Currency) {
  return `${SYMBOL[currency]}${amount.toLocaleString("es-GT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
