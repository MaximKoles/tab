"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { BarChart3, Crown, Lock, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { monthlyDynamics, monthlyTypeSeries, rankBy, totalsForYear } from "@/lib/analytics";
import { fmtMoney, fmtNum, MONTHS_SHORT } from "@/lib/format";
import { isPro } from "@/lib/limits";
import { cn } from "@/lib/utils";

/* ────────────────────────── палитра и утилиты ────────────────────────── */

/** Тёплая сдержанная палитра серий */
const PALETTE = [
  "#1c1b17", // чернила
  "#bf5b33", // терракота
  "#5e7d5a", // шалфей
  "#d9b93b", // тёмный лимон
  "#5d5876", // приглушённый фиолетовый
  "#4e6572", // сине-серый
  "#8c8271", // тёплый серый
  "#a39d8e", // светло-серый
];
const GRAY = "#a39d8e";
const POSITIVE = "#1f7a4d";
const CAUTION = "#bf5b33";
const INK = "#1c1b17";

const pctOf = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

/** Компактные подписи оси: 7500 → «7,5к», 1200000 → «1,2М» */
function compactAxis(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) {
    const s = (v / 1_000_000).toFixed(1).replace(".0", "").replace(".", ",");
    return `${s}М`;
  }
  if (abs >= 1_000) {
    const s = (v / 1_000).toFixed(1).replace(".0", "").replace(".", ",");
    return `${s}к`;
  }
  return String(v);
}

/* ────────────────────────── подсказки (тултипы) ────────────────────────── */

interface TipEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string;
  payload?: Record<string, unknown>;
}

function TipBox({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-[140px] rounded-2xl border border-border/60 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
      {children}
    </div>
  );
}

function TipRow({
  color,
  label,
  value,
  strong,
  valueClass,
}: {
  color?: string;
  label: string;
  value: string;
  strong?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 py-px">
      {color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />}
      <span className={cn("min-w-0 flex-1 truncate", strong ? "font-semibold" : "text-muted-foreground")}>
        {label}
      </span>
      <span className={cn("shrink-0 tabular-nums", strong ? "font-bold" : "font-medium", valueClass)}>{value}</span>
    </div>
  );
}

function HeroTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  const profit = payload.find((p) => p.dataKey === "profit")?.value as number | undefined;
  const avg = payload.find((p) => p.dataKey === "avg")?.value as number | undefined;
  return (
    <TipBox>
      <div className="mb-1 text-[11px] font-semibold capitalize">{label}</div>
      {profit !== undefined && <TipRow color={INK} label="Прибыль" value={fmtMoney(profit)} strong />}
      {avg !== undefined && <TipRow color={GRAY} label="Средняя" value={fmtMoney(Math.round(avg))} />}
    </TipBox>
  );
}

function TypeTip({
  active,
  payload,
  label,
  colors,
  mode,
}: {
  active?: boolean;
  payload?: TipEntry[];
  label?: string | number;
  colors: Map<string, string>;
  mode: "abs" | "share";
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload as Record<string, number>;
  const entries = Array.from(colors.keys())
    .map((t) => ({
      t,
      v: mode === "share" ? (row[`${t}__abs`] ?? 0) : (row[t] ?? 0),
      shown: row[t],
    }))
    .filter((e) => (mode === "share" ? (e.shown ?? 0) > 0 : e.v > 0))
    .sort((a, b) => b.v - a.v);
  const total = row.__total ?? 0;
  return (
    <TipBox>
      <div className="mb-1 text-[11px] font-semibold capitalize">{label}</div>
      {entries.map((e) => (
        <TipRow
          key={e.t}
          color={colors.get(e.t)}
          label={e.t}
          value={mode === "share" ? `${Math.round(e.shown ?? 0)}% · ${fmtNum(e.v)}` : fmtMoney(e.v)}
        />
      ))}
      <div className="mt-1 border-t border-border/50 pt-1">
        <TipRow label="Доход за месяц" value={fmtMoney(total)} strong />
      </div>
    </TipBox>
  );
}

function IeTip({ active, payload, label }: { active?: boolean; payload?: TipEntry[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  const income = Number(payload.find((p) => p.dataKey === "Доход")?.value ?? 0);
  const expense = Number(payload.find((p) => p.dataKey === "Расход")?.value ?? 0);
  const profit = income - expense;
  return (
    <TipBox>
      <div className="mb-1 text-[11px] font-semibold capitalize">{label}</div>
      <TipRow color={POSITIVE} label="Доход" value={fmtMoney(income)} />
      <TipRow color={CAUTION} label="Расход" value={fmtMoney(expense)} />
      <div className="mt-1 border-t border-border/50 pt-1">
        <TipRow
          label="Прибыль"
          value={fmtMoney(profit)}
          strong
          valueClass={profit < 0 ? "text-caution" : undefined}
        />
      </div>
    </TipBox>
  );
}

/* ────────────────────────── переключатель режима ────────────────────────── */

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex shrink-0 rounded-full bg-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
            value === o.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ────────────────────────── hero-карточка динамики ────────────────────────── */

function HeroDynamics({
  year,
  avg,
  best,
  yearProfit,
  inPlus,
  activeCount,
  spark,
  badge,
}: {
  year: number;
  avg: number;
  best: { month: number; profit: number } | null;
  yearProfit: number;
  inPlus: number;
  activeCount: number;
  spark: Array<{ name: string; profit: number; avg: number }>;
  badge: { month: number; label: string; up: boolean } | null;
}) {
  return (
    <div className="rounded-[28px] bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm text-muted-foreground">Средняя прибыль в месяц · {year}</div>
          <div className="mt-1 text-[38px] font-bold leading-tight tracking-tight tabular-nums">
            {fmtNum(avg)}
            <span className="ml-1 text-2xl font-semibold text-muted-foreground">₽</span>
          </div>
        </div>
        {badge && (
          <span
            className={cn(
              "mt-1 flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
              badge.up ? "bg-positive-soft text-positive" : "bg-caution-soft text-caution"
            )}
          >
            {badge.up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {MONTHS_SHORT[badge.month]} {badge.label}
          </span>
        )}
      </div>

      {spark.length > 0 ? (
        <>
          <div className="mt-2 h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={spark} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INK} stopOpacity={0.14} />
                    <stop offset="100%" stopColor={INK} stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip
                  content={<HeroTip />}
                  cursor={{ stroke: "rgba(28,27,23,0.25)", strokeWidth: 1, strokeDasharray: "3 3" }}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Прибыль"
                  stroke={INK}
                  strokeWidth={2}
                  fill="url(#heroFill)"
                  dot={{ r: 2.5, fill: INK, strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: INK, stroke: "#e8d34f", strokeWidth: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  name="Средняя"
                  stroke={GRAY}
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full" style={{ background: INK }} />
              прибыль за месяц
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: GRAY }} />
              средняя
            </span>
          </div>
        </>
      ) : (
        <div className="mt-3 rounded-[18px] bg-muted py-6 text-center text-xs text-muted-foreground">
          За {year} год пока нет операций — заполните месяц, и здесь появится динамика
        </div>
      )}

      <div className="mt-4 grid grid-cols-3 border-t border-border pt-3.5 text-center">
        <div>
          <div className="text-[11px] text-muted-foreground">
            {best ? `Лучший · ${MONTHS_SHORT[best.month]}` : "Лучший"}
          </div>
          <div className="mt-0.5 text-base font-bold tabular-nums">{best ? fmtNum(best.profit) : "—"}</div>
        </div>
        <div className="border-x border-border">
          <div className="text-[11px] text-muted-foreground">Прибыль за год</div>
          <div className="mt-0.5 text-base font-bold tabular-nums">{fmtNum(yearProfit)}</div>
        </div>
        <div>
          <div className="text-[11px] text-muted-foreground">Месяцев в плюсе</div>
          <div className="mt-0.5 text-base font-bold tabular-nums">
            {inPlus} из {activeCount}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── рейтинги (тихие полосы) ────────────────────────── */

function RankBars({
  title,
  subtitle,
  items,
  metric,
  total,
  barColor,
  headerRight,
}: {
  title: string;
  subtitle?: string;
  items: Array<{ key: string; income: number; expense: number; count: number }>;
  metric: "income" | "expense";
  total: number;
  barColor?: string;
  headerRight?: ReactNode;
}) {
  const visible = items.filter((i) => i[metric] > 0).slice(0, 6);
  if (visible.length === 0) return null;
  const max = Math.max(...visible.map((i) => i[metric]));
  const color = barColor ?? INK;
  return (
    <div className="rounded-[28px] bg-card p-4 shadow-soft">
      <div className={cn("mb-3 flex items-start justify-between gap-2", headerRight && "flex-row")}>
        <div className="min-w-0">
          <div className="text-sm font-semibold">{title}</div>
          {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
        </div>
        {headerRight}
      </div>
      <div className="space-y-3">
        {visible.map((item) => (
          <div key={item.key}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate font-medium">
                {item.key} <span className="text-[10px] font-normal text-muted-foreground">· {item.count}</span>
              </span>
              <span className="shrink-0 tabular-nums">
                <span className="font-bold">{fmtMoney(item[metric])}</span>{" "}
                <span className="text-[10px] text-muted-foreground">{pctOf(item[metric], total)}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(item[metric] / max) * 100}%`, background: color }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ────────────────────────── сравнение лет (Pro) ────────────────────────── */

function YearCompare({ year }: { year: number }) {
  const operations = useStore((s) => s.operations);
  const license = useStore((s) => s.license);
  const openPro = useUi((s) => s.openPro);

  const cur = totalsForYear(operations, year);
  const prev = totalsForYear(operations, year - 1);
  const hasPrev = prev.count > 0;

  const delta = (a: number, b: number) =>
    b > 0 ? Math.round(((a - b) / b) * 100) : a > 0 ? 100 : 0;

  const rows: Array<{ label: string; cur: number; prev: number; goodWhenUp: boolean }> = [
    { label: "Доход", cur: cur.income, prev: prev.income, goodWhenUp: true },
    { label: "Расход", cur: cur.expense, prev: prev.expense, goodWhenUp: false },
    { label: "Прибыль", cur: cur.profit, prev: prev.profit, goodWhenUp: true },
  ];

  if (!isPro(license)) {
    return (
      <div className="relative overflow-hidden rounded-[28px] bg-card shadow-soft">
        <div className="pointer-events-none select-none p-4 opacity-40 blur-[3px]">
          <div className="grid grid-cols-3 gap-2 text-center text-sm font-semibold">
            <span className="text-positive">{fmtMoney(cur.income)}</span>
            <span className="text-caution">{fmtMoney(cur.expense)}</span>
            <span>{fmtMoney(cur.profit)}</span>
          </div>
          <div className="mt-3 space-y-2">
            {[70, 45, 60].map((w, i) => (
              <div key={i} className="h-2 rounded-full bg-muted" style={{ width: `${w}%` }} />
            ))}
          </div>
        </div>
        <button
          onClick={openPro}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5"
          aria-label="Сравнение лет доступно в Pro"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
            <Lock className="h-4 w-4 text-muted-foreground" />
          </span>
          <span className="text-sm font-bold">Сравнение лет · Pro</span>
          <span className="text-[11px] text-muted-foreground">Как этот год прошёл на фоне прошлого</span>
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[28px] bg-card p-4 shadow-soft">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Crown className="h-4 w-4 text-muted-foreground" />
        {year} против {year - 1}
      </div>
      {!hasPrev ? (
        <p className="text-sm text-muted-foreground">
          За {year - 1} год пока нет данных — сравнение появится, когда будет что сравнивать.
        </p>
      ) : (
        <div className="space-y-2.5">
          {rows.map((r) => {
            const d = delta(r.cur, r.prev);
            const good = r.goodWhenUp ? d >= 0 : d <= 0;
            return (
              <div key={r.label} className="flex items-center gap-2">
                <div className="w-16 shrink-0 text-xs text-muted-foreground">{r.label}</div>
                <div className="flex-1 text-sm font-bold tabular-nums">{fmtMoney(r.cur)}</div>
                <div className="w-24 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                  {year - 1}: {fmtNum(r.prev)}
                </div>
                <span
                  className={cn(
                    "flex w-[68px] shrink-0 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums",
                    good ? "bg-positive-soft text-positive" : "bg-caution-soft text-caution"
                  )}
                >
                  {r.goodWhenUp ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {d > 0 ? "+" : ""}
                  {d}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────── главный компонент ────────────────────────── */

export function AnalyticsView() {
  const operations = useStore((s) => s.operations);
  const now = new Date();

  const years = (() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const op of operations) set.add(Number(op.date.slice(0, 4)));
    return Array.from(set).sort((a, b) => b - a);
  })();

  /* По умолчанию — текущий год; если в нём нет операций, открываем год последних данных */
  const defaultYear = (() => {
    if (operations.length === 0) return now.getFullYear();
    const hasCur = operations.some((o) => o.date.startsWith(String(now.getFullYear())));
    if (hasCur) return now.getFullYear();
    let max = "";
    for (const op of operations) if (op.date > max) max = op.date;
    return Number(max.slice(0, 4));
  })();

  const [year, setYear] = useState<number>(defaultYear);
  const [mode, setMode] = useState<"abs" | "share">("abs");
  /* «Откуда деньги»: разбивка дохода по источникам или услугам */
  const [moneyFrom, setMoneyFrom] = useState<"sources" | "types">("sources");

  const totals = totalsForYear(operations, year);

  /* помесячная динамика и производные показатели */
  const dynamics = useMemo(() => monthlyDynamics(operations, year), [operations, year]);
  const activeMonths = useMemo(() => dynamics.filter((d) => d.active), [dynamics]);
  const firstActive = dynamics.findIndex((d) => d.active);
  const lastActive = useMemo(() => {
    for (let i = dynamics.length - 1; i >= 0; i--) if (dynamics[i].active) return i;
    return -1;
  }, [dynamics]);

  const avgProfit = activeMonths.length > 0 ? Math.round(totals.profit / activeMonths.length) : 0;
  const best = useMemo(
    () =>
      activeMonths.length > 0
        ? activeMonths.reduce((a, b) => (b.profit > a.profit ? b : a))
        : null,
    [activeMonths]
  );
  const inPlus = activeMonths.filter((d) => d.profit > 0).length;

  const prevActive = useMemo(() => {
    for (let i = lastActive - 1; i >= 0; i--) if (dynamics[i].active) return dynamics[i];
    return null;
  }, [dynamics, lastActive]);
  const badge = (() => {
    if (lastActive < 0 || !prevActive || prevActive.profit <= 0) return null;
    const cur = dynamics[lastActive].profit;
    const up = cur >= prevActive.profit;
    const pct = Math.round(((cur - prevActive.profit) / prevActive.profit) * 100);
    const label =
      Math.abs(pct) >= 1000
        ? `×${Math.max(2, Math.round(cur / prevActive.profit))}`
        : `${pct >= 0 ? "+" : "−"}${Math.abs(pct)}%`;
    return { month: lastActive, label, up };
  })();

  const spark = useMemo(
    () =>
      firstActive < 0
        ? []
        : dynamics
            .slice(firstActive, lastActive + 1)
            .map((d) => ({ name: MONTHS_SHORT[d.month], profit: d.profit, avg: Math.round(d.avgProfit) })),
    [dynamics, firstActive, lastActive]
  );

  /* структура доходов по типам услуг */
  const typeSeries = useMemo(() => monthlyTypeSeries(operations, year, 4), [operations, year]);
  const typeColors = useMemo(() => {
    const m = new Map<string, string>();
    typeSeries.types.forEach((t, i) => m.set(t, t === "Остальные" ? GRAY : PALETTE[i % PALETTE.length]));
    return m;
  }, [typeSeries]);

  const absData = useMemo(
    () =>
      typeSeries.rows.map((r) => ({
        ...r,
        name: MONTHS_SHORT[r.month],
        __total: typeSeries.types.reduce((s, t) => s + (r[t] ?? 0), 0),
      })),
    [typeSeries]
  );
  const shareData = useMemo(
    () =>
      absData.map((r) => {
        const total = r.__total;
        const out: Record<string, number | string | undefined> = { name: r.name, __total: total };
        for (const t of typeSeries.types) {
          const v = (r[t] as number) ?? 0;
          out[t] = total > 0 ? Math.round((v / total) * 100) : undefined;
          out[`${t}__abs`] = v;
        }
        return out;
      }),
    [absData, typeSeries]
  );
  const stackData = mode === "abs" ? absData : shareData;

  const typeYearTotals = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of typeSeries.rows) for (const t of typeSeries.types) m[t] = (m[t] ?? 0) + (r[t] ?? 0);
    return m;
  }, [typeSeries]);

  /* доходы и расходы по месяцам */
  const ieData = useMemo(
    () =>
      dynamics.map((d) => ({
        name: MONTHS_SHORT[d.month],
        Доход: d.income,
        Расход: d.expense,
      })),
    [dynamics]
  );

  /* донат по источникам — заменён карточкой «Откуда деньги» */
  const opsInYear = useMemo(
    () => operations.filter((o) => o.date.startsWith(String(year))),
    [operations, year]
  );
  const sourceRanked = useMemo(
    () =>
      rankBy(opsInYear, "source", "income").map((i) =>
        i.key === "Без категории" ? { ...i, key: "Без источника" } : i
      ),
    [opsInYear]
  );
  const typeRanked = useMemo(() => rankBy(opsInYear, "type", "income"), [opsInYear]);
  const moneyFromItems = moneyFrom === "sources" ? sourceRanked : typeRanked;

  const expenseTypes = useMemo(() => rankBy(opsInYear, "type", "expense"), [opsInYear]);

  const empty = operations.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger
            className="h-10 w-32 rounded-full border-border bg-card text-sm shadow-soft"
            aria-label="Год"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y} год
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {empty ? (
        <div className="rounded-[28px] border border-dashed border-foreground/20 p-8 text-center">
          <BarChart3 className="mx-auto h-9 w-9 text-muted-foreground/60" />
          <p className="mt-3 text-sm text-muted-foreground">
            Здесь появятся графики, когда будут операции. Загрузите демо-данные во вкладке «Ещё»,
            чтобы посмотреть, как это выглядит.
          </p>
        </div>
      ) : (
        <>
          {/* Динамика года: средняя прибыль, лучший месяц, спарклайн */}
          <HeroDynamics
            year={year}
            avg={avgProfit}
            best={best ? { month: best.month, profit: best.profit } : null}
            yearProfit={totals.profit}
            inPlus={inPlus}
            activeCount={activeMonths.length}
            spark={spark}
            badge={badge}
          />

          {/* Откуда деньги: рейтинги источников и услуг */}
          <RankBars
            title="Откуда деньги"
            subtitle={`доля от дохода за ${year} год`}
            items={moneyFromItems}
            metric="income"
            total={totals.income}
            headerRight={
              <Segmented
                value={moneyFrom}
                onChange={setMoneyFrom}
                options={[
                  { value: "sources", label: "Источники" },
                  { value: "types", label: "Услуги" },
                ]}
              />
            }
          />

          {/* Структура доходов по типам услуг, помесячно */}
          {typeSeries.types.length > 0 && (
            <div className="rounded-[28px] bg-card p-4 shadow-soft">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Услуги по месяцам</div>
                  <p className="text-[11px] text-muted-foreground">из чего складывается доход</p>
                </div>
                <Segmented
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "abs", label: "Суммы" },
                    { value: "share", label: "Доли" },
                  ]}
                />
              </div>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stackData} margin={{ top: 8, right: 2, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" opacity={0.1} />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 10, fill: "currentColor" }}
                      tickLine={false}
                      axisLine={false}
                      interval={0}
                      tickMargin={4}
                      opacity={0.65}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "currentColor" }}
                      tickLine={false}
                      axisLine={false}
                      width={46}
                      opacity={0.65}
                      tickFormatter={mode === "share" ? (v: number) => `${v}%` : compactAxis}
                      domain={mode === "share" ? [0, 100] : undefined}
                      ticks={mode === "share" ? [0, 25, 50, 75, 100] : undefined}
                    />
                    <Tooltip
                      content={<TypeTip colors={typeColors} mode={mode} />}
                      cursor={{ fill: "rgba(127,127,127,0.08)" }}
                    />
                    {typeSeries.types.map((t) => (
                      <Bar
                        key={t}
                        dataKey={t}
                        stackId="types"
                        fill={typeColors.get(t)}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={22}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* легенда: цвет и доля услуги (суммы — в «Откуда деньги», без повторов) */}
              <div className="mt-3 space-y-1.5">
                {typeSeries.types.map((t) => (
                  <div key={t} className="flex items-center gap-2 text-xs">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: typeColors.get(t) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-foreground/90">{t}</span>
                    <span className="w-9 shrink-0 text-right text-[11px] text-muted-foreground tabular-nums">
                      {pctOf(typeYearTotals[t] ?? 0, totals.income)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Доходы и расходы по месяцам */}
          <div className="rounded-[28px] bg-card p-4 shadow-soft">
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                Доходы и расходы
              </span>
              <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: POSITIVE }} />
                доход
              </span>
              <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                <span className="h-2 w-2 rounded-full" style={{ background: CAUTION }} />
                расход
              </span>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ieData} barGap={2} margin={{ top: 8, right: 2, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" opacity={0.1} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tickMargin={4}
                    opacity={0.65}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "currentColor" }}
                    tickLine={false}
                    axisLine={false}
                    width={46}
                    opacity={0.65}
                    tickFormatter={compactAxis}
                  />
                  <Tooltip content={<IeTip />} cursor={{ fill: "rgba(127,127,127,0.08)" }} />
                  <Bar dataKey="Доход" fill={POSITIVE} radius={[4, 4, 0, 0]} maxBarSize={14} />
                  <Bar dataKey="Расход" fill={CAUTION} radius={[4, 4, 0, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Куда уходят деньги */}
          <RankBars
            title="На что уходят деньги"
            subtitle="структура расходов за год"
            items={expenseTypes}
            metric="expense"
            total={totals.expense}
            barColor={CAUTION}
          />

          {/* Сравнение лет (Pro) */}
          <YearCompare year={year} />
        </>
      )}
    </div>
  );
}
