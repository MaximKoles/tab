// Текстовый отчёт за месяц — чтобы скопировать бухгалтеру или себе в заметки

import type { Operation, Client } from "./types";
import { totalsForMonth } from "./analytics";
import { fmtNum, MONTHS_NOM } from "./format";

const MONTHS_ACC = [
  "январе", "феврале", "марте", "апреле", "мае", "июне",
  "июле", "августе", "сентябре", "октябре", "ноябре", "декабре",
];

/** Свободный текст: сводка месяца + топ клиентов + разбивка доходов */
export function buildMonthReport(
  operations: Operation[],
  clients: Client[],
  year: number,
  month: number
): string {
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  const monthOps = operations.filter((o) => o.date.startsWith(prefix));
  const totals = totalsForMonth(operations, year, month);

  if (monthOps.length === 0) {
    return `Гонорар · ${MONTHS_NOM[month - 1][0].toUpperCase()}${MONTHS_NOM[month - 1].slice(1)} ${year}\nОпераций в ${MONTHS_ACC[month - 1]} не было.`;
  }

  // Доходы по клиентам
  const byClient = new Map<string, number>();
  // Доходы по типам услуг
  const byType = new Map<string, number>();
  // Расходы по типам
  const byExpense = new Map<string, number>();
  for (const op of monthOps) {
    if (op.kind === "income") {
      const key = op.clientId
        ? clients.find((c) => c.id === op.clientId)?.name ?? op.clientName ?? "Без имени"
        : op.clientName || "Без имени";
      byClient.set(key, (byClient.get(key) ?? 0) + op.amount);
      const t = op.type || "Без категории";
      byType.set(t, (byType.get(t) ?? 0) + op.amount);
    } else {
      const t = op.type || "Прочее";
      byExpense.set(t, (byExpense.get(t) ?? 0) + op.amount);
    }
  }

  const topClients = Array.from(byClient.entries()).sort((a, b) => b[1] - a[1]);
  const incomeTypes = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);
  const expenseTypes = Array.from(byExpense.entries()).sort((a, b) => b[1] - a[1]);

  const lines: string[] = [];
  const nom = MONTHS_NOM[month - 1];
  lines.push(`Гонорар · ${nom[0].toUpperCase()}${nom.slice(1)} ${year}`);
  lines.push(`Доход: ${fmtNum(totals.income)} ₽`);
  if (totals.expense > 0) {
    lines.push(`Расход: ${fmtNum(totals.expense)} ₽`);
  }
  lines.push(`Прибыль: ${fmtNum(totals.profit)} ₽`);
  lines.push(`Платежей: ${monthOps.filter((o) => o.kind === "income").length}, клиентов: ${byClient.size}`);

  if (topClients.length > 0) {
    lines.push("");
    lines.push("Клиенты:");
    for (const [name, sum] of topClients) {
      lines.push(`· ${name} — ${fmtNum(sum)} ₽`);
    }
  }

  if (incomeTypes.length > 0) {
    lines.push("");
    lines.push("Доходы по услугам:");
    for (const [t, sum] of incomeTypes) {
      lines.push(`· ${t} — ${fmtNum(sum)} ₽`);
    }
  }

  if (expenseTypes.length > 0) {
    lines.push("");
    lines.push("Расходы:");
    for (const [t, sum] of expenseTypes) {
      lines.push(`· ${t} — ${fmtNum(sum)} ₽`);
    }
  }

  return lines.join("\n");
}

/** Копирование в буфер с запасным вариантом для старых браузеров */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* падаем в запасной вариант */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
