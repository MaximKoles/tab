// Импорт/экспорт CSV, совместимый с исходной таблицей «Пример заполнения — 2024».
// Колонки: Дата, Сумма, Тип, Описание, Имя, Контакты, (метка), Источник, Коммент, Месяц

import type { Client, Operation } from "./types";
import { isoOf, MONTHS_CSV } from "./format";

const MONTH_KEYS: Array<[string, number]> = [
  ["янв", 1], ["февр", 2], ["фев", 2], ["мар", 3], ["апр", 4],
  ["ма", 5], ["июн", 6], ["июл", 7], ["авг", 8], ["сент", 9],
  ["окт", 10], ["нояб", 11], ["ноя", 11], ["дек", 12],
];

/** Парсер CSV с кавычками (Google Sheets экспортирует с кавычками). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === ";" || ch === "\t") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const s = raw
    .replace(/[\s\u00A0\u202F₽]/g, "")
    .replace(/−/g, "-")
    .replace(/,/g, ".");
  const neg = s.includes("-");
  const num = parseFloat(s.replace(/-/g, ""));
  if (isNaN(num)) return null;
  return Math.abs(num) * (neg ? -1 : 1);
}

function monthFromWord(s: string): number | null {
  const low = s.toLowerCase().trim();
  for (const [key, num] of MONTH_KEYS) {
    if (low.startsWith(key)) return num;
  }
  return null;
}

function parseRuDate(raw: string, fallbackMonth: number | null, year: number): string | null {
  const s = raw.trim();
  if (!s) {
    if (fallbackMonth) return isoOf(year, fallbackMonth, 1);
    return null;
  }
  // ISO или 01.02.2024
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dot = s.match(/^(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?$/);
  if (dot) {
    const y = dot[3] ? (dot[3].length === 2 ? 2000 + Number(dot[3]) : Number(dot[3])) : year;
    return isoOf(y, Number(dot[2]), Number(dot[1]));
  }
  // «1 янв.» / «12 мая» / «4 февраля»
  const m = s.match(/^(\d{1,2})\s+([а-яё]+)/i);
  if (m) {
    const month = monthFromWord(m[2]);
    if (month) return isoOf(year, month, Number(m[1]));
  }
  if (fallbackMonth) return isoOf(year, fallbackMonth, 1);
  return null;
}

export interface CsvImportResult {
  operations: Operation[];
  clients: Client[];
  skipped: number;
}

/** Импорт строк таблицы → черновики операций и клиенты. */
export function importFromCsv(text: string, year: number): CsvImportResult {
  const rows = parseCsv(text);
  if (rows.length === 0) return { operations: [], clients: [], skipped: 0 };

  // Ищем строку заголовков
  let headerIdx = rows.findIndex((r) => r.some((c) => c.trim().toLowerCase() === "дата"));
  const header = headerIdx >= 0 ? rows[headerIdx].map((c) => c.trim().toLowerCase()) : null;
  const dataRows = headerIdx >= 0 ? rows.slice(headerIdx + 1) : rows;

  const col = (names: string[]) => {
    if (!header) return -1;
    for (const n of names) {
      const i = header.findIndex((h) => h === n || h.startsWith(n));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iDate = col(["дата"]);
  const iAmount = col(["сумма"]);
  const iType = col(["тип"]);
  const iDesc = col(["описание"]);
  const iName = col(["имя"]);
  const iContact = col(["контакты"]);
  const iSource = col(["источник"]);
  const iComment = col(["коммент"]);
  const iMonth = col(["месяц"]);

  const operations: Operation[] = [];
  const clients: Client[] = [];
  const clientsByName = new Map<string, Client>();
  let skipped = 0;

  const now = new Date().toISOString();
  let dealSeq = 0;

  for (const r of dataRows) {
    const amount = parseAmount(r[iAmount >= 0 ? iAmount : 1] ?? "");
    if (amount === null || amount === 0) {
      skipped++;
      continue;
    }
    const monthCol = iMonth >= 0 ? parseInt(r[iMonth], 10) : NaN;
    const fallbackMonth = !isNaN(monthCol) && monthCol >= 1 && monthCol <= 12 ? monthCol : null;
    const date = parseRuDate(r[iDate >= 0 ? iDate : 0] ?? "", fallbackMonth, year);
    if (!date) {
      skipped++;
      continue;
    }
    const kind = amount > 0 ? "income" : "expense";
    const name = iName >= 0 ? (r[iName] ?? "").trim() : "";
    const contact = iContact >= 0 ? (r[iContact] ?? "").trim() : "";

    let clientId: string | undefined;
    let clientName: string | undefined;
    if (name) {
      let client = clientsByName.get(name.toLowerCase());
      if (!client) {
        client = {
          id: crypto.randomUUID(),
          name,
          contact: contact || undefined,
          createdAt: now,
        };
        clientsByName.set(name.toLowerCase(), client);
        clients.push(client);
      } else if (contact && !client.contact) {
        client.contact = contact;
      }
      clientId = client.id;
      clientName = client.name;
    }

    const type = iType >= 0 ? (r[iType] ?? "").trim() : "";
    const source = iSource >= 0 ? (r[iSource] ?? "").trim() : "";
    const desc = iDesc >= 0 ? (r[iDesc] ?? "").trim() : "";
    const comment = iComment >= 0 ? (r[iComment] ?? "").trim() : "";
    const note = [desc, comment].filter(Boolean).join(" — ") || undefined;

    const looksLikeDeal = /предоплат|остаток|ост\./i.test(note ?? "");
    operations.push({
      id: crypto.randomUUID(),
      date,
      amount: Math.abs(amount),
      kind,
      type: type || undefined,
      source: source && kind === "income" ? source : undefined,
      clientId,
      clientName: clientName ?? (name || undefined),
      note,
      part: "single",
      dealId: undefined,
      dealTotal: undefined,
      createdAt: now,
      updatedAt: now,
    });
    // Пары «предоплата/остаток» одного клиента и одного типа объединяем в сделку
    if (looksLikeDeal && clientId && type) {
      const existing = operations.find(
        (o) =>
          o.clientId === clientId &&
          o.type === type &&
          o.dealId &&
          (o.note ? /предоплат/i.test(o.note) : false)
      );
      if (existing) {
        operations[operations.length - 1].dealId = existing.dealId;
        operations[operations.length - 1].part = "rest";
        existing.dealTotal = existing.amount + Math.abs(amount);
        operations[operations.length - 1].dealTotal = existing.amount + Math.abs(amount);
      } else {
        const dealId = `deal-${now}-${dealSeq++}`;
        operations[operations.length - 1].dealId = dealId;
        operations[operations.length - 1].part = "prepay";
      }
    }
  }

  return { operations, clients, skipped };
}

function csvEscape(v: string): string {
  if (/[",;\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/** Экспорт в формат исходной таблицы. */
export function exportToCsv(operations: Operation[], clients: Client[]): string {
  const header = "Дата,Сумма,Тип,Описание,Имя,Контакты,,Источник,Коммент,Месяц";
  const lines = [header];
  const sorted = [...operations].sort((a, b) => a.date.localeCompare(b.date));
  for (const op of sorted) {
    const { d, m } = { d: Number(op.date.slice(8, 10)), m: Number(op.date.slice(5, 7)) };
    const dateStr = `${d} ${MONTHS_CSV[m - 1]}`;
    const sign = op.kind === "income" ? "" : "-";
    const amountStr = `${sign}${new Intl.NumberFormat("ru-RU").format(op.amount)} ₽`;
    const client = op.clientId ? clients.find((c) => c.id === op.clientId) : undefined;
    const name = client?.name ?? op.clientName ?? "";
    const contact = client?.contact ?? "";
    const [desc, comment] = splitNote(op.note ?? "");
    lines.push(
      [
        dateStr,
        amountStr,
        op.type ?? "",
        desc,
        name,
        contact,
        "",
        op.source ?? "",
        comment,
        String(m),
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\n");
}

function splitNote(note: string): [string, string] {
  const idx = note.indexOf(" — ");
  if (idx > 0) return [note.slice(0, idx), note.slice(idx + 3)];
  return [note, ""];
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
