"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Crown, Lock, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { monthlySeries, rankBy, totalsForYear } from "@/lib/analytics";
import { fmtMoney, fmtNum, MONTHS_SHORT } from "@/lib/format";
import { isPro } from "@/lib/limits";
import { cn } from "@/lib/utils";

const EMERALD = "#10b981";
const ROSE = "#f43f5e";

function RankBars({
  title,
  items,
  metric,
  color,
}: {
  title: string;
  items: Array<{ key: string; income: number; expense: number; count: number }>;
  metric: "income" | "expense";
  color: string;
}) {
  const visible = items.filter((i) => i[metric] > 0).slice(0, 6);
  if (visible.length === 0) return null;
  const max = Math.max(...visible.map((i) => i[metric]));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {visible.map((item) => (
          <div key={item.key}>
            <div className="mb-1 flex items-baseline justify-between text-xs">
              <span className="truncate pr-2 font-medium">{item.key}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {fmtMoney(item[metric])} · {item.count}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(item[metric] / max) * 100}%`, backgroundColor: color }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

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
      <Card className="relative overflow-hidden">
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
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-background/70 backdrop-blur-[1px]"
          aria-label="Сравнение лет доступно в Pro"
        >
          <Lock className="h-5 w-5 text-amber-500" />
          <span className="text-sm font-semibold">Сравнение лет · Pro</span>
          <span className="text-xs text-muted-foreground">Нажмите, чтобы узнать больше</span>
        </button>
      </Card>
    );
  }

  return (
    <Card>
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
          <div className="space-y-3">
            {rows.map((r) => {
              const d = delta(r.cur, r.prev);
              const good = r.goodWhenUp ? d >= 0 : d <= 0;
              return (
                <div key={r.label} className="flex items-center gap-3">
                  <div className="w-16 shrink-0 text-sm text-muted-foreground">{r.label}</div>
                  <div className="flex-1 text-sm font-semibold tabular-nums">{fmtMoney(r.cur)}</div>
                  <div className="w-28 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                    {year - 1}: {fmtNum(r.prev)}
                  </div>
                  <div
                    className={cn(
                      "flex w-16 shrink-0 items-center justify-end gap-0.5 text-xs font-semibold tabular-nums",
                      good ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                    )}
                  >
                    {r.goodWhenUp ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : (
                      <TrendingDown className="h-3.5 w-3.5" />
                    )}
                    {d > 0 ? "+" : ""}
                    {d}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsView() {
  const operations = useStore((s) => s.operations);
  const now = new Date();

  const years = (() => {
    const set = new Set<number>([new Date().getFullYear()]);
    for (const op of operations) set.add(Number(op.date.slice(0, 4)));
    return Array.from(set).sort((a, b) => b - a);
  })();

  const [year, setYear] = useState<number>(years[0] ?? now.getFullYear());
  const totals = totalsForYear(operations, year);

  const chartData = useMemo(() => {
    const series = monthlySeries(operations, year);
    return series.map((s, i) => ({
      name: MONTHS_SHORT[i],
      Доход: s.income || 0,
      Расход: s.expense || 0,
    }));
  }, [operations, year]);

  const sources = useMemo(
    () => rankBy(operations, "source", "income"),
    [operations]
  );
  const incomeTypes = useMemo(
    () => rankBy(operations, "type", "income"),
    [operations]
  );
  const expenseTypes = useMemo(
    () => rankBy(operations, "type", "expense"),
    [operations]
  );

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
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Здесь появятся графики, когда будут операции. Загрузите демо-данные во вкладке «Ещё»,
          чтобы посмотреть, как это выглядит.
        </div>
      ) : (
        <>
          {/* Итоги года */}
          <Card>
            <CardContent className="grid grid-cols-4 gap-2 p-4 text-center">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Доход</div>
                <div className="mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {fmtNum(totals.income)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Расход</div>
                <div className="mt-0.5 text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                  {fmtNum(totals.expense)}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Прибыль</div>
                <div className="mt-0.5 text-sm font-bold tabular-nums">{fmtNum(totals.profit)}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Операций</div>
                <div className="mt-0.5 text-sm font-bold tabular-nums">{totals.count}</div>
              </div>
            </CardContent>
          </Card>

          {/* Доходы и расходы по месяцам */}
          <Card>
            <CardHeader className="pb-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                По месяцам, {year}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-2 pr-4 pt-3">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" opacity={0.12} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value: number | string) => fmtMoney(Number(value))}
                      contentStyle={{ borderRadius: 10, fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Доход" fill={EMERALD} radius={[3, 3, 0, 0]} maxBarSize={14} />
                    <Bar dataKey="Расход" fill={ROSE} radius={[3, 3, 0, 0]} maxBarSize={14} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Рейтинги */}
          <RankBars title="Источники клиентов" items={sources} metric="income" color={EMERALD} />
          <RankBars title="Типы дохода" items={incomeTypes} metric="income" color={EMERALD} />
          <RankBars title="На что уходят деньги" items={expenseTypes} metric="expense" color={ROSE} />

          {/* Сравнение лет */}
          <YearCompare year={year} />
        </>
      )}
    </div>
  );
}
