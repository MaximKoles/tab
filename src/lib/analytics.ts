// Агрегации для дашборда и аналитики

import type { Operation, Client } from "./types";
import { isoOf } from "./format";

export interface Totals {
  income: number;
  expense: number;
  profit: number;
  count: number;
}

export function totalsInRange(ops: Operation[], fromISO: string, toISO: string): Totals {
  let income = 0;
  let expense = 0;
  let count = 0;
  for (const op of ops) {
    if (op.date >= fromISO && op.date <= toISO) {
      count++;
      if (op.kind === "income") income += op.amount;
      else expense += op.amount;
    }
  }
  return { income, expense, profit: income - expense, count };
}

export function totalsForMonth(ops: Operation[], year: number, month: number): Totals {
  const from = isoOf(year, month, 1);
  const lastDay = new Date(year, month, 0).getDate();
  const to = isoOf(year, month, lastDay);
  return totalsInRange(ops, from, to);
}

export function totalsForYear(ops: Operation[], year: number): Totals {
  return totalsInRange(ops, isoOf(year, 1, 1), isoOf(year, 12, 31));
}

/** Серия доход/расход по 12 месяцам года */
export function monthlySeries(ops: Operation[], year: number): Array<{ income: number; expense: number }> {
  const series = Array.from({ length: 12 }, () => ({ income: 0, expense: 0 }));
  for (const op of ops) {
    if (!op.date.startsWith(String(year))) continue;
    const m = Number(op.date.slice(5, 7)) - 1;
    if (m < 0 || m > 11) continue;
    if (op.kind === "income") series[m].income += op.amount;
    else series[m].expense += op.amount;
  }
  return series;
}

export interface Ranked {
  key: string;
  income: number;
  expense: number;
  count: number;
}

/** Рейтинг по произвольному полю (источник / тип) */
export function rankBy(ops: Operation[], field: "source" | "type", kind?: "income" | "expense"): Ranked[] {
  const map = new Map<string, Ranked>();
  for (const op of ops) {
    if (kind && op.kind !== kind) continue;
    const key = (field === "source" ? op.source : op.type) || "Без категории";
    let item = map.get(key);
    if (!item) {
      item = { key, income: 0, expense: 0, count: 0 };
      map.set(key, item);
    }
    item.count++;
    if (op.kind === "income") item.income += op.amount;
    else item.expense += op.amount;
  }
  return Array.from(map.values()).sort((a, b) => (b.income - b.expense) - (a.income - a.expense));
}

export interface DealInfo {
  dealId: string;
  clientName: string;
  type: string;
  total: number;
  paid: number;
  remaining: number;
  lastDate: string;
  ops: Operation[];
}

/** Открытые сделки: предоплата есть, остаток не доплачен */
export function openDeals(ops: Operation[]): DealInfo[] {
  const deals = new Map<string, DealInfo>();
  for (const op of ops) {
    if (op.kind !== "income" || !op.dealId) continue;
    let d = deals.get(op.dealId);
    if (!d) {
      d = {
        dealId: op.dealId,
        clientName: op.clientName ?? "Без имени",
        type: op.type ?? "",
        total: op.dealTotal ?? 0,
        paid: 0,
        remaining: 0,
        lastDate: op.date,
        ops: [],
      };
      deals.set(op.dealId, d);
    }
    d.paid += op.amount;
    if (op.dealTotal) d.total = Math.max(d.total, op.dealTotal);
    if (op.date > d.lastDate) d.lastDate = op.date;
    d.ops.push(op);
  }
  return Array.from(deals.values())
    .map((d) => ({ ...d, remaining: Math.max(0, d.total - d.paid) }))
    .filter((d) => d.total > 0 && d.remaining > 0)
    .sort((a, b) => a.lastDate.localeCompare(b.lastDate));
}

export interface ClientStats {
  client: Client;
  paidTotal: number;
  opsCount: number;
  lastDate: string | null;
  debt: number; // остатки по открытым сделкам
}

export function clientStats(ops: Operation[], clients: Client[]): ClientStats[] {
  const stats = new Map<string, ClientStats>();
  for (const c of clients) {
    stats.set(c.id, { client: c, paidTotal: 0, opsCount: 0, lastDate: null, debt: 0 });
  }
  for (const op of ops) {
    if (!op.clientId) continue;
    const s = stats.get(op.clientId);
    if (!s) continue;
    s.opsCount++;
    if (op.kind === "income") {
      s.paidTotal += op.amount;
      if (!s.lastDate || op.date > s.lastDate) s.lastDate = op.date;
    }
  }
  for (const d of openDeals(ops)) {
    const op = d.ops[0];
    if (!op?.clientId) continue;
    const s = stats.get(op.clientId);
    if (s) s.debt += d.remaining;
  }
  return Array.from(stats.values()).sort((a, b) => b.paidTotal - a.paidTotal);
}
