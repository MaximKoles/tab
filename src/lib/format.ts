// Форматирование денег и дат (ru)

export const MONTHS_SHORT = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

// Формат дат как в исходной таблице: «1 янв.», «12 мая»
export const MONTHS_CSV = [
  "янв.", "февр.", "мар.", "апр.", "мая", "июн.",
  "июл.", "авг.", "сент.", "окт.", "нояб.", "дек.",
];

export const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export const MONTHS_NOM = [
  "январь", "февраль", "март", "апрель", "май", "июнь",
  "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь",
];

const moneyFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function fmtNum(n: number): string {
  return moneyFmt.format(n);
}

/** 5000 → «5 000 ₽» */
export function fmtMoney(n: number): string {
  return `${moneyFmt.format(n)} ₽`;
}

/** Доход зелёным со знаком плюс, расход — с минусом */
export function fmtSigned(amount: number, kind: "income" | "expense"): string {
  return kind === "income" ? `+${fmtMoney(amount)}` : `−${fmtMoney(amount)}`;
}

/** '2024-05-12' → «12 мая» */
export function fmtDate(iso: string): string {
  const { d, m } = parseISO(iso);
  return `${d} ${MONTHS_GEN[m - 1]}`;
}

/** '2024-05-12' → «12 мая 2024» */
export function fmtDateFull(iso: string): string {
  const { y, d, m } = parseISO(iso);
  return `${d} ${MONTHS_GEN[m - 1]} ${y}`;
}

export function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function isoOf(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function todayISO(): string {
  const now = new Date();
  return isoOf(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

/** Порядковый номер месяца в году для даты */
export function monthOf(iso: string): number {
  return parseISO(iso).m;
}

export function yearOf(iso: string): number {
  return parseISO(iso).y;
}
