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

export const WEEKDAYS = [
  "воскресенье", "понедельник", "вторник", "среда",
  "четверг", "пятница", "суббота",
];

export const WEEKDAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

const moneyFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export function fmtNum(n: number): string {
  return moneyFmt.format(n);
}

/** 5000 → «5 000 ₽» */
export function fmtMoney(n: number): string {
  return `${moneyFmt.format(n)} ₽`;
}

/** Компактно для подписей: 50000 → «50к», 12500 → «12,5к», 1200000 → «1,2М» */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  const trim = (s: string) => s.replace(".0", "").replace(".", ",");
  if (abs >= 1_000_000) return `${trim((n / 1_000_000).toFixed(1))}М`;
  if (abs >= 1_000) return `${trim((n / 1_000).toFixed(1))}к`;
  return String(n);
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

/** '2024-05-12' → «воскресенье» */
export function weekdayOf(iso: string): string {
  const { y, m, d } = parseISO(iso);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
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

/** Русское склонение после числа: ruPlural(3, ["раз", "раза", "раз"]) → «раза» */
export function ruPlural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
