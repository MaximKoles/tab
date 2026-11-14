"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { BarChart3, Crown, Lock, Sparkles, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { monthlyDynamics, monthlyTypeSeries, rankBy, totalsForYear } from "@/lib/analytics";
import { fmtMoney, fmtNum, MONTHS_NOM, MONTHS_SHORT } from "@/lib/format";
import { isPro } from "@/lib/limits";
import { cn } from "@/lib/utils";

/* ────────────────────────── палитра и утилиты ────────────────────────── */

/** Яркая палитра для серий диаграмм */
const PALETTE = [
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#0ea5e9", // sky
  "#f43f5e", // rose
  "#14b8a6", // teal
  "#d946ef", // fuchsia
  "#84cc16", // lime
];
const GRAY = "#94a3b8";
const EMERALD = "#10b981";
const ROSE = "#f43f5e";

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
    <div className="min-w-[140px] rounded-xl border border-border/50 bg-popover/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
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
      {profit !== undefined && <TipRow color="#ffffff" label="Прибыль" value={fmtMoney(profit)} strong />}
      {avg !== undefined && <TipRow label="Средняя" value={fmtMoney(Math.round(avg))} />}
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
      <TipRow color={EMERALD} label="Доход" value={fmtMoney(income)} />
      <TipRow color={ROSE} label="Расход" value={fmtMoney(expense)} />
      <div className="mt-1 border-t border-border/50 pt-1">
        <TipRow
          label="Прибыль"
          value={fmtMoney(profit)}
          strong
          valueClass={profit < 0 ? "text-rose-500" : undefined}
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
    <div className="flex shrink-0 rounded-lg bg-muted p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
            value === o.value
              ? "bg-background text-foreground shadow-sm"
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
    <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(130deg,#047857_0%,#0d9488_52%,#0369a1_100%)] p-4 text-white shadow-xl shadow-emerald-900/15">
      <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-cyan-300/25 blur-2xl" />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-white/75">
            <Sparkles className="h-3.5 w-3.5" />
            Динамика {year}
          </div>
          <div className="mt-2 text-[11px] text-white/75">Средняя прибыль в месяц</div>
          <div className="text-3xl font-extrabold tracking-tight">
            {fmtNum(avg)} <span className="text-lg font-semibold text-white/90">₽</span>
          </div>
        </div>
        {badge && (
          <span
            className={cn(
              "mt-1 flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold backdrop-blur-sm",
              !badge.up && "text-rose-200"
            )}
          >
            {badge.up ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {MONTHS_SHORT[badge.month]} {badge.label}
          </span>
        )}
      </div>

      {spark.length > 0 ? (
        <>
          <div className="relative mt-2 h-20 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={spark} margin={{ top: 6, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#ffffff" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <YAxis hide />
                <Tooltip
                  content={<HeroTip />}
                  cursor={{ stroke: "rgba(255,255,255,0.4)", strokeWidth: 1, strokeDasharray: "3 3" }}
                />
                <Area
                  type="monotone"
                  dataKey="profit"
                  name="Прибыль"
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  fill="url(#heroFill)"
                  dot={{ r: 2.5, fill: "#ffffff", strokeWidth: 0 }}
                  activeDot={{ r: 4, fill: "#ffffff", stroke: "rgba(255,255,255,0.4)", strokeWidth: 3 }}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  name="Средняя"
                  stroke="rgba(255,255,255,0.85)"
                  strokeWidth={1.5}
                  strokeDasharray="5 4"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="relative mt-1 flex items-center gap-4 text-[10px] text-white/70">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-4 rounded-full bg-white" />
              прибыль за месяц
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-4 border-t-2 border-dashed border-white/80" />
              средняя
            </span>
          </div>
        </>
      ) : (
        <div className="relative mt-3 rounded-xl bg-white/10 py-6 text-center text-xs text-white/80">
          За {year} год пока нет операций — заполните месяц, и здесь появится динамика
        </div>
      )}

      <div className="relative mt-3 grid grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/10 py-2 backdrop-blur-sm">
        <div className="px-2 text-center">
          <div className="text-[10px] uppercase tracking-wide text-white/70">
            {best ? `Лучший · ${MONTHS_SHORT[best.month]}` : "Лучший"}
          </div>
          <div className="mt-0.5 text-sm font-bold tabular-nums">{best ? fmtNum(best.profit) : "—"}</div>
        </div>
        <div className="px-2 text-center">
          <div className="text-[10px] uppercase tracking-wide text-white/70">Всего за год</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums">{fmtNum(yearProfit)}</div>
        </div>
        <div className="px-2 text-center">
          <div className="text-[10px] uppercase tracking-wide text-white/70">Месяцев в плюсе</div>
          <div className="mt-0.5 text-sm font-bold tabular-nums">
            {inPlus} из {activeCount}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────── рейтинг (градиентные полосы) ────────────────────────── */

function RankBars({
  title,
  subtitle,
  items,
  metric,
  total,
  headerRight,
}: {
  title: string;
  subtitle?: string;
  items: Array<{ key: string; income: number; expense: number; count: number }>;
  metric: "income" | "expense";
  total: number;
  headerRight?: ReactNode;
}) {
  const visible = items.filter((i) => i[metric] > 0).slice(0, 6);
  if (visible.length === 0) return null;
  const max = Math.max(...visible.map((i) => i[metric]));
  return (
    <Card>
      <CardHeader className={cn("pb-2", headerRight && "flex-row items-start justify-between gap-2")}>
        <div className="min-w-0">
          <CardTitle className="text-sm">{title}</CardTitle>
          {subtitle && <p className="text-[11px] font-normal text-muted-foreground">{subtitle}</p>}
        </div>
        {headerRight}
      </CardHeader>
      <CardContent className="space-y-3">
        {visible.map((item, idx) => {
          const color = PALETTE[idx % PALETTE.length];
          return (
            <div key={item.key}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                <span className="min-w-0 truncate font-medium">
                  {item.key}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">· {item.count}</span>
                </span>
                <span className="shrink-0 tabular-nums">
                  <span className="font-semibold">{fmtMoney(item[metric])}</span>{" "}
                  <span className="text-[10px] text-muted-foreground">{pctOf(item[metric], total)}%</span>
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(item[metric] / max) * 100}%`,
                    background: `linear-gradient(90deg, ${color}, ${color}80)`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
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
      <Card className="relative overflow-hidden border-amber-500/25">
        <CardContent className="blur-[3px]">
          <div className="grid grid-cols-3 gap-2 text-center text-sm font-semibold">
            <span className="text-emerald-600">{fmtMoney(cur.income)}</span>
            <span className="text-rose-600">{fmtMoney(cur.expense)}</span>
            <span>{fmtMoney(cur.profit)}</span>
          </div>
          <div className="mt-3 space-y-2">
            {[70, 45, 60].map((w, i) => (
              <div key={i} className="h-2.5 rounded-full bg-muted" style={{ width: `${w}%` }} />
            ))}
          </div>
        </CardContent>
        <button
          onClick={openPro}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-1.5 bg-background/60 backdrop-blur-[2px]"
          aria-label="Сравнение лет доступно в Pro"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/30">
            <Lock className="h-4 w-4 text-white" />
          </span>
          <span className="text-sm font-bold">Сравнение лет · Pro</span>
          <span className="text-[11px] text-muted-foreground">Как этот год прошёл на фоне прошлого</span>
        </button>
      </Card>
    );
  }

  return (
    <Card className="border-amber-500/25">
      <CardHeader className="flex-row items-center justify-between pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Crown className="h-4 w-4 text-amber-500" />
          {year} против {year - 1}
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                      "flex w-[68px] shrink-0 items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                      good
                        ? "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-600 dark:bg-rose-400/10 dark:text-rose-400"
                    )}
                  >
                    {r.goodWhenUp ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {d > 0 ? "+" : ""}
                    {d}%
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
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
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Аналитика</h2>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28" aria-label="Год">
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
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/50" />
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
            <Card>
              <CardHeader className="flex-row items-start justify-between gap-2 pb-2">
                <div className="min-w-0">
                  <CardTitle className="text-sm">Услуги по месяцам</CardTitle>
                  <p className="text-[11px] font-normal text-muted-foreground">
                    из чего складывается доход
                  </p>
                </div>
                <Segmented
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: "abs", label: "Суммы" },
                    { value: "share", label: "Доли" },
                  ]}
                />
              </CardHeader>
              <CardContent className="p-2 pr-3 pt-0">
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
                        cursor={{ fill: "rgba(127,127,127,0.10)" }}
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
                {/* легенда: цвет, сумма за год, доля */}
                <div className="mt-3 space-y-1.5">
                  {typeSeries.types.map((t) => (
                    <div key={t} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: typeColors.get(t) }}
                      />
                      <span className="min-w-0 flex-1 truncate text-foreground/90">{t}</span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {fmtNum(typeYearTotals[t] ?? 0)} ₽
                      </span>
                      <span className="w-9 shrink-0 text-right text-[10px] text-muted-foreground tabular-nums">
                        {pctOf(typeYearTotals[t] ?? 0, totals.income)}%
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Доходы и расходы по месяцам */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-muted-foreground" />
                  Доходы и расходы
                </span>
                <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: EMERALD }} />
                  доход
                </span>
                <span className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground">
                  <span className="h-2 w-2 rounded-full" style={{ background: ROSE }} />
                  расход
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pr-3 pt-0">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={ieData} barGap={2} margin={{ top: 8, right: 2, bottom: 0, left: 0 }}>
                    <defs>
                      <linearGradient id="gradInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#059669" />
                      </linearGradient>
                      <linearGradient id="gradExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fb7185" />
                        <stop offset="100%" stopColor="#e11d48" />
                      </linearGradient>
                    </defs>
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
                    <Tooltip content={<IeTip />} cursor={{ fill: "rgba(127,127,127,0.10)" }} />
                    <Bar dataKey="Доход" fill="url(#gradInc)" radius={[4, 4, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="Расход" fill="url(#gradExp)" radius={[4, 4, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Куда уходят деньги */}
          <RankBars
            title="На что уходят деньги"
            subtitle="структура расходов за год"
            items={expenseTypes}
            metric="expense"
            total={totals.expense}
          />

          {/* Сравнение лет (Pro) */}
          <YearCompare year={year} />
        </>
      )}
    </div>
  );
}
