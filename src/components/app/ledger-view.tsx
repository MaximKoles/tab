"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, HandCoins, Lock, Trophy, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtMoney, fmtNum, fmtDateFull, weekdayOf, MONTHS_NOM, MONTHS_SHORT } from "@/lib/format";
import { totalsForMonth, openDeals } from "@/lib/analytics";
import { isPro } from "@/lib/limits";
import type { Operation } from "@/lib/types";
import { cn } from "@/lib/utils";

function monthLabel(y: number, m: number) {
  const nom = MONTHS_NOM[m - 1];
  return `${nom[0].toUpperCase()}${nom.slice(1)} ${y}`;
}

function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const d = new Date(y, m - 1 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function OperationRow({ op }: { op: Operation }) {
  const openEdit = useUi((s) => s.openEdit);
  const income = op.kind === "income";
  const letter = (op.type?.trim()?.[0] ?? (income ? "+" : "−")).toUpperCase();
  const hasDeal = (op.part === "prepay" || op.part === "rest") && !!op.dealTotal;
  return (
    <button
      onClick={() => openEdit(op.id)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60 active:bg-muted"
    >
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm",
          income
            ? "bg-gradient-to-br from-emerald-400 to-teal-600"
            : "bg-gradient-to-br from-rose-400 to-red-500"
        )}
        aria-hidden
      >
        {letter}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{op.type || "Без категории"}</div>
        <div className="truncate text-xs text-muted-foreground">
          {[op.clientName, op.note].filter(Boolean).join(" · ") || "—"}
        </div>
        {(op.source || op.part !== "single" || hasDeal) && (
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {op.source && (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {op.source}
              </Badge>
            )}
            {op.part === "prepay" && (
              <Badge className="bg-amber-100 px-1.5 py-0 text-[10px] text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                предоплата
              </Badge>
            )}
            {op.part === "rest" && (
              <Badge className="bg-sky-100 px-1.5 py-0 text-[10px] text-sky-800 dark:bg-sky-900 dark:text-sky-200">
                остаток
              </Badge>
            )}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div
          className={cn(
            "text-sm font-bold tabular-nums",
            income ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
          )}
        >
          {income ? "+" : "−"}
          {fmtMoney(op.amount)}
        </div>
        {hasDeal && (
          <div className="text-[10px] text-muted-foreground tabular-nums">
            сделка {fmtNum(op.dealTotal ?? 0)} ₽
          </div>
        )}
      </div>
    </button>
  );
}

export function LedgerView() {
  const operations = useStore((s) => s.operations);
  const settings = useStore((s) => s.settings);
  const license = useStore((s) => s.license);
  const openPro = useUi((s) => s.openPro);
  const openAdd = useUi((s) => s.openAdd);

  const now = new Date();
  const [{ y, m }, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });

  const totals = useMemo(() => totalsForMonth(operations, y, m), [operations, y, m]);
  const deals = useMemo(() => openDeals(operations), [operations]);

  const groups = useMemo(() => {
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    const monthOps = operations
      .filter((o) => o.date.startsWith(prefix))
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
    const map = new Map<string, Operation[]>();
    for (const op of monthOps) {
      const arr = map.get(op.date) ?? [];
      arr.push(op);
      map.set(op.date, arr);
    }
    return Array.from(map.entries());
  }, [operations, y, m]);

  /* месяцы года, в которых есть операции — для полосы навигации */
  const monthsWithData = useMemo(() => {
    const s = new Set<number>();
    for (const op of operations) if (op.date.startsWith(`${y}-`)) s.add(Number(op.date.slice(5, 7)));
    return s;
  }, [operations, y]);

  const goalPct =
    settings.monthlyGoal > 0 ? Math.min(100, Math.round((totals.income / settings.monthlyGoal) * 100)) : 0;
  const monthDeals = deals.filter((d) => d.lastDate.startsWith(`${y}-${String(m).padStart(2, "0")}`));
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;

  return (
    <div className="space-y-4">
      {/* ─── Hero-карточка месяца: итоги + навигация ─── */}
      <div className="relative overflow-hidden rounded-2xl bg-[linear-gradient(130deg,#047857_0%,#0d9488_52%,#0369a1_100%)] p-4 text-white shadow-xl shadow-emerald-900/15">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 -left-8 h-36 w-36 rounded-full bg-cyan-300/25 blur-2xl" />

        <div className="relative flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth(shiftMonth(y, m, -1))}
            aria-label="Предыдущий месяц"
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col items-center">
            <span className="text-base font-bold">{monthLabel(y, m)}</span>
            {!isCurrentMonth && (
              <button
                onClick={() => setMonth({ y: now.getFullYear(), m: now.getMonth() + 1 })}
                className="text-[10px] text-white/70 underline underline-offset-2 hover:text-white"
              >
                вернуться к текущему месяцу
              </button>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMonth(shiftMonth(y, m, 1))}
            aria-label="Следующий месяц"
            className="text-white hover:bg-white/15 hover:text-white"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="relative mt-3">
          <div className="text-[11px] text-white/75">Прибыль за месяц</div>
          <div className="text-3xl font-extrabold tracking-tight">
            {fmtNum(totals.profit)} <span className="text-lg font-semibold text-white/90">₽</span>
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-3 divide-x divide-white/15 rounded-xl bg-white/10 py-2 backdrop-blur-sm">
          <div className="px-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-white/70">Доход</div>
            <div className="mt-0.5 text-sm font-bold tabular-nums">{fmtNum(totals.income)}</div>
          </div>
          <div className="px-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-white/70">Расход</div>
            <div className="mt-0.5 text-sm font-bold tabular-nums">{fmtNum(totals.expense)}</div>
          </div>
          <div className="px-2 text-center">
            <div className="text-[10px] uppercase tracking-wide text-white/70">Операций</div>
            <div className="mt-0.5 text-sm font-bold tabular-nums">{totals.count}</div>
          </div>
        </div>

        {/* Полоса месяцев: кликабельна, видно заполненные */}
        <div className="relative mt-3 grid grid-cols-6 gap-1">
          {MONTHS_SHORT.map((name, idx) => {
            const mm = idx + 1;
            const isActive = mm === m;
            const has = monthsWithData.has(mm);
            const isNow = y === now.getFullYear() && mm === now.getMonth() + 1;
            return (
              <button
                key={mm}
                type="button"
                onClick={() => setMonth({ y, m: mm })}
                aria-label={`Перейти к ${name} ${y}`}
                className={cn(
                  "rounded-lg py-1.5 text-[11px] font-semibold transition-colors",
                  isActive
                    ? "bg-white text-teal-800 shadow"
                    : has
                      ? "bg-white/20 text-white hover:bg-white/30"
                      : "bg-white/10 text-white/50 hover:bg-white/20",
                  isNow && !isActive && "ring-1 ring-white/50"
                )}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Открытые доплаты ─── */}
      {monthDeals.length > 0 && (
        <Card className="border-amber-300/60 dark:border-amber-800/60">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <HandCoins className="h-4 w-4 text-amber-500" />
              Ждут доплаты
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {monthDeals.slice(0, 5).map((d) => {
              const paidPct = d.total > 0 ? Math.min(100, Math.round((d.paid / d.total) * 100)) : 0;
              return (
                <div
                  key={d.dealId}
                  className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {d.clientName} · {d.type || "заказ"}
                      </div>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        оплачено {fmtNum(d.paid)} из {fmtNum(d.total)} ₽
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-[10px] uppercase tracking-wide text-amber-700/70 dark:text-amber-400/70">
                        осталось
                      </div>
                      <div className="text-base font-bold text-amber-600 tabular-nums dark:text-amber-400">
                        {fmtMoney(d.remaining)}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-amber-200/70 dark:bg-amber-900/60">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all"
                      style={{ width: `${paidPct}%` }}
                    />
                  </div>
                  <Button
                    size="sm"
                    className="mt-2.5 h-9 w-full border-0 bg-gradient-to-br from-amber-400 to-orange-500 text-base font-bold text-white shadow-md shadow-amber-500/25 hover:from-amber-500 hover:to-orange-600"
                    onClick={() =>
                      openAdd({
                        kind: "income",
                        clientId: d.ops[0]?.clientId,
                        dealId: d.dealId,
                        part: "rest",
                      })
                    }
                  >
                    Записать {fmtMoney(d.remaining)}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ─── Цель по доходу (Pro) ─── */}
      {settings.monthlyGoal > 0 && (
        <Card>
          <CardContent className="p-4">
            {isPro(license) ? (
              <>
                <div className="mb-2 flex items-baseline justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    Цель месяца
                    {goalPct >= 100 && <Trophy className="h-4 w-4 text-amber-500" />}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {fmtMoney(totals.income)} / {fmtMoney(settings.monthlyGoal)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500 transition-all"
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
                  <span>
                    {goalPct >= 100
                      ? "Цель достигнута — супер!"
                      : `Осталось ${fmtMoney(Math.max(0, settings.monthlyGoal - totals.income))}`}
                  </span>
                  <span className="font-semibold tabular-nums">{goalPct}%</span>
                </div>
              </>
            ) : (
              <button className="flex w-full items-center gap-3 text-left" onClick={openPro}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-amber-500/25">
                  <Lock className="h-4 w-4 text-white" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">Цель месяца · Pro</div>
                  <div className="truncate text-xs text-muted-foreground">
                    Прогресс до цели и мотивация каждый день
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Список операций по дням ─── */}
      {groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <Wallet className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            В этом месяце пока пусто.
            <br />
            Нажмите «+», чтобы записать первую операцию.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, ops]) => {
            const dayNet = ops.reduce((s, o) => s + (o.kind === "income" ? o.amount : -o.amount), 0);
            return (
              <div key={date}>
                <div className="mb-1 flex items-baseline justify-between px-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {fmtDateFull(date)} · {weekdayOf(date)}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-semibold tabular-nums",
                      dayNet > 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : dayNet < 0
                          ? "text-rose-600 dark:text-rose-400"
                          : "text-muted-foreground"
                    )}
                  >
                    {dayNet > 0 ? "+" : ""}
                    {fmtMoney(dayNet)}
                  </span>
                </div>
                <Card className="divide-y divide-border/60 py-1">
                  {ops.map((op) => (
                    <OperationRow key={op.id} op={op} />
                  ))}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
