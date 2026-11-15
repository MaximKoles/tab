"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronRight, Lock, Plus, TrendingDown, TrendingUp, Trophy, Wallet } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtMoney, fmtNum, fmtCompact, MONTHS_NOM, MONTHS_SHORT, WEEKDAYS_SHORT, ruPlural } from "@/lib/format";
import { totalsForMonth, openDeals } from "@/lib/analytics";
import { isPro } from "@/lib/limits";
import type { Operation } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Дательный падеж для «к январю» */
const MONTHS_DAT = [
  "январю", "февралю", "марту", "апрелю", "маю", "июню",
  "июлю", "августу", "сентябрю", "октябрю", "ноябрю", "декабрю",
];

function shiftMonth(y: number, m: number, delta: number): { y: number; m: number } {
  const d = new Date(y, m - 1 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

function monthIncome(operations: Operation[], y: number, m: number): number {
  const prefix = `${y}-${String(m).padStart(2, "0")}`;
  let sum = 0;
  for (const o of operations) if (o.date.startsWith(prefix) && o.kind === "income") sum += o.amount;
  return sum;
}

/* Одна операция — белая карточка в строке таймлайна */
function OperationRow({ op }: { op: Operation }) {
  const openEdit = useUi((s) => s.openEdit);
  const income = op.kind === "income";
  return (
    <button
      onClick={() => openEdit(op.id)}
      className="flex w-full items-center gap-3 rounded-[22px] bg-card px-3.5 py-2.5 text-left shadow-soft transition-transform active:scale-[0.99]"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{op.type || "Без категории"}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {[op.clientName, op.source].filter(Boolean).join(" · ") || "—"}
        </span>
        {(op.part === "prepay" || op.part === "rest") && (
          <span className="mt-1 flex">
            {op.part === "prepay" ? (
              <span className="rounded-full bg-lemon-soft px-2 py-0.5 text-[10px] font-semibold">предоплата</span>
            ) : (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                остаток
              </span>
            )}
          </span>
        )}
      </span>
      <span
        className={cn(
          "shrink-0 text-sm font-bold tabular-nums",
          income ? "text-positive" : "text-foreground"
        )}
      >
        {income ? "+" : "−"}
        {fmtMoney(op.amount)}
      </span>
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
  const ledgerNav = useUi((s) => s.ledgerNav);
  const clearLedgerNav = useUi((s) => s.clearLedgerNav);

  // После импорта таблицы открываем месяц последних данных
  useEffect(() => {
    if (ledgerNav) {
      setMonth(ledgerNav);
      clearLedgerNav();
    }
  }, [ledgerNav, clearLedgerNav]);

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

  /* Непрерывная полоса месяцев от первого года с данными до выбранного/текущего */
  const strip = useMemo(() => {
    let minY = now.getFullYear();
    for (const op of operations) {
      const yy = Number(op.date.slice(0, 4));
      if (yy < minY) minY = yy;
    }
    minY = Math.min(minY, y);
    const maxY = Math.max(y, now.getFullYear());
    const out: Array<{ y: number; m: number }> = [];
    for (let yy = minY; yy <= maxY; yy++) for (let mm = 1; mm <= 12; mm++) out.push({ y: yy, m: mm });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operations, y]);

  /* доход по месяцам полосы — для подписей под названиями */
  const stripIncomes = useMemo(() => {
    const map = new Map<string, number>();
    for (const op of operations) {
      if (op.kind !== "income") continue;
      const key = op.date.slice(0, 7);
      map.set(key, (map.get(key) ?? 0) + op.amount);
    }
    return map;
  }, [operations]);

  const stripRef = useRef<HTMLDivElement>(null);
  const selectedPillRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // держим выбранный месяц в зоне видимости полосы
    selectedPillRef.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [y, m]);

  const goalPct =
    settings.monthlyGoal > 0 ? Math.min(100, Math.round((totals.income / settings.monthlyGoal) * 100)) : 0;
  const monthPrefix = `${y}-${String(m).padStart(2, "0")}`;
  const monthDeals = deals.filter((d) => d.lastDate.startsWith(monthPrefix));
  const isCurrentMonth = y === now.getFullYear() && m === now.getMonth() + 1;

  /* Тренд: доход выбранного месяца против предыдущего */
  const prevMonth = useMemo(() => shiftMonth(y, m, -1), [y, m]);
  const prevIncome = useMemo(
    () => totalsForMonth(operations, prevMonth.y, prevMonth.m).income,
    [operations, prevMonth]
  );
  const trend = useMemo(() => {
    const cur = totals.income;
    if (prevIncome > 0) {
      const pct = Math.round(((cur - prevIncome) / prevIncome) * 100);
      if (pct >= 1000) {
        const times = Math.max(2, Math.round(cur / prevIncome));
        const pl = ruPlural(times, ["раз", "раза", "раз"]);
        return { up: true, text: `×${times} к ${MONTHS_DAT[prevMonth.m - 1]}` };
      }
      if (pct > 0) return { up: true, text: `+${pct}% к ${MONTHS_DAT[prevMonth.m - 1]}` };
      if (pct < 0) return { up: false, text: `−${Math.abs(pct)}% к ${MONTHS_DAT[prevMonth.m - 1]}` };
      return null; // ровно столько же — тренд не о чем сообщать
    }
    if (cur > 0) return { up: true, text: `${MONTHS_NOM[prevMonth.m - 1]} был без дохода` };
    return null;
  }, [totals.income, prevIncome, prevMonth]);

  /* Последний доход — больше не используется: повтор переехал в шторку ввода */

  return (
    <div className="space-y-4">
      {/* ─── Полоса месяцев ─── */}
      <div ref={stripRef} className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {strip.map(({ y: sy, m: sm }, idx) => {
          const selected = sy === y && sm === m;
          const isNow = sy === now.getFullYear() && sm === now.getMonth() + 1;
          const inc = stripIncomes.get(`${sy}-${String(sm).padStart(2, "0")}`);
          const firstOfYear = idx === 0 || strip[idx - 1].y !== sy;
          return (
            <div key={`${sy}-${sm}`} className="flex items-center gap-2">
              {firstOfYear && (
                <span className="shrink-0 pl-1 pr-0.5 text-xs font-semibold text-muted-foreground tabular-nums">
                  {sy}
                </span>
              )}
              <button
                ref={selected ? selectedPillRef : undefined}
                type="button"
                onClick={() => setMonth({ y: sy, m: sm })}
                aria-label={`Перейти к ${MONTHS_NOM[sm - 1]} ${sy}`}
                aria-current={selected ? "true" : undefined}
                className={cn(
                  "flex min-w-[58px] shrink-0 flex-col items-center rounded-[20px] px-2.5 py-2 transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-foreground shadow-soft hover:bg-muted"
                )}
              >
                <span className="text-[13px] font-semibold leading-tight">{MONTHS_SHORT[sm - 1]}</span>
                <span
                  className={cn(
                    "mt-0.5 text-[10px] leading-tight tabular-nums",
                    selected ? "text-lemon dark:text-caution" : inc ? "text-muted-foreground" : "text-muted-foreground/50"
                  )}
                >
                  {inc ? fmtCompact(inc) : "—"}
                </span>
                {isNow && !selected && <span className="mt-1 h-1 w-1 rounded-full bg-caution" />}
              </button>
            </div>
          );
        })}
      </div>

      {/* ─── Hero-карточка месяца: Прибыль · Доход · Расход в одну строку ─── */}
      <div className="rounded-[28px] bg-card p-4 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="min-w-0 text-sm text-muted-foreground">
            {MONTHS_NOM[m - 1][0].toUpperCase() + MONTHS_NOM[m - 1].slice(1)}
            {!isCurrentMonth && ` ${y}`}
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {!isCurrentMonth && (
              <button
                onClick={() => setMonth({ y: now.getFullYear(), m: now.getMonth() + 1 })}
                className="flex h-7 shrink-0 items-center rounded-full bg-muted px-2.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Вернуться к текущему месяцу"
              >
                К текущему
              </button>
            )}
            {trend && (
              <span
                className={cn(
                  "flex min-w-0 items-center gap-1 truncate rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  trend.up ? "bg-positive-soft text-positive" : "bg-caution-soft text-caution"
                )}
              >
                {trend.up ? (
                  <TrendingUp className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="truncate">{trend.text}</span>
              </span>
            )}
          </span>
        </div>
        <div className="mt-3 flex items-stretch">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] text-muted-foreground">Прибыль</div>
            <div
              className={cn(
                "mt-0.5 truncate text-[17px] font-bold tabular-nums",
                totals.profit < 0 && "text-caution"
              )}
            >
              {fmtNum(totals.profit)} ₽
            </div>
          </div>
          <div className="min-w-0 flex-1 border-l border-border pl-3">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-positive" />
              Доход
            </div>
            <div className="mt-0.5 truncate text-[17px] font-semibold tabular-nums">{fmtNum(totals.income)} ₽</div>
          </div>
          <div className="min-w-0 flex-1 border-l border-border pl-3">
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-caution" />
              Расход
            </div>
            <div className="mt-0.5 truncate text-[17px] font-semibold tabular-nums">{fmtNum(totals.expense)} ₽</div>
          </div>
        </div>
      </div>

      {/* ─── Кнопка записи — всегда наверху, листать не нужно ─── */}
      <button
        onClick={() => openAdd()}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-[15px] font-semibold text-primary-foreground transition-colors hover:bg-primary/85 active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" />
        Записать операцию
      </button>

      {/* ─── Открытые доплаты ─── */}
      {monthDeals.length > 0 && (
        <div className="rounded-[28px] bg-card p-4 shadow-soft">
          <div className="mb-3 text-sm font-semibold">Ждут доплаты</div>
          <div className="space-y-4">
            {monthDeals.slice(0, 5).map((d) => {
              const paidPct = d.total > 0 ? Math.min(100, Math.round((d.paid / d.total) * 100)) : 0;
              return (
                <div key={d.dealId}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-sm font-medium">
                      {d.clientName}
                      {d.type && <span className="text-muted-foreground"> · {d.type}</span>}
                    </span>
                    <span className="shrink-0 text-sm font-bold text-caution tabular-nums">
                      {fmtMoney(d.remaining)}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-caution transition-all" style={{ width: `${paidPct}%` }} />
                  </div>
                  <button
                    className="mt-2.5 flex h-10 w-full items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/85"
                    onClick={() =>
                      openAdd({
                        kind: "income",
                        clientId: d.ops[0]?.clientId,
                        dealId: d.dealId,
                        part: "rest",
                      })
                    }
                  >
                    Записать остаток
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Цель по доходу (Pro) ─── */}
      {settings.monthlyGoal > 0 && (
        <div className="rounded-[28px] bg-card p-4 shadow-soft">
          {isPro(license) ? (
            <>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  Цель месяца
                  {goalPct >= 100 && <Trophy className="h-4 w-4 text-caution" />}
                </span>
                <span className="text-sm font-bold tabular-nums">{goalPct}%</span>
              </div>
              <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full transition-all", goalPct >= 100 ? "bg-positive" : "bg-primary")}
                  style={{ width: `${goalPct}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-muted-foreground tabular-nums">
                {goalPct >= 100
                  ? "Цель достигнута — супер!"
                  : `Осталось ${fmtMoney(Math.max(0, settings.monthlyGoal - totals.income))}`}
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                цель {fmtNum(settings.monthlyGoal)} ₽
              </div>
            </>
          ) : (
            <button className="flex w-full items-center gap-3 text-left" onClick={openPro}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted">
                <Lock className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Цель месяца · Pro</span>
                <span className="block truncate text-xs text-muted-foreground">
                  Прогресс до цели каждый день
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          )}
        </div>
      )}

      {/* ─── Список операций: колонка дней + карточки ─── */}
      {groups.length === 0 ? (
        <button
          onClick={() => openAdd()}
          className="block w-full rounded-[28px] border border-dashed border-foreground/20 p-6 text-center transition-colors hover:bg-card"
          aria-label="Записать первую операцию за этот месяц"
        >
          <Wallet className="mx-auto h-8 w-8 text-muted-foreground/60" />
          <p className="mt-2.5 text-sm text-muted-foreground">
            В {MONTHS_NOM[m - 1]}е пока пусто — нажмите кнопку выше
          </p>
        </button>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, ops]) => {
            const [, mm, dd] = date.split("-").map(Number);
            const wd = WEEKDAYS_SHORT[new Date(Number(date.slice(0, 4)), mm - 1, dd).getDay()];
            return (
              <div key={date} className="flex gap-3">
                <div className="w-9 shrink-0 pt-2.5">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{wd}</div>
                  <div className="text-xl font-bold leading-tight tabular-nums">{dd}</div>
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  {ops.map((op) => (
                    <OperationRow key={op.id} op={op} />
                  ))}
                </div>
              </div>
            );
          })}
          <button
            onClick={() => openAdd()}
            className="flex w-full items-center justify-center gap-2 rounded-[22px] border border-dashed border-foreground/20 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
            Записать операцию
          </button>
        </div>
      )}
    </div>
  );
}
