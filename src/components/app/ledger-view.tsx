"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, HandCoins, Lock } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtMoney, fmtDateFull, MONTHS_NOM } from "@/lib/format";
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
  return (
    <button
      onClick={() => openEdit(op.id)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors hover:bg-muted/60"
    >
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          income
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
        )}
        aria-hidden
      >
        {income ? "+" : "−"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{op.type || "Без категории"}</div>
        <div className="truncate text-xs text-muted-foreground">
          {[op.clientName, op.note].filter(Boolean).join(" · ") || "—"}
        </div>
        {(op.source || op.part !== "single") && (
          <div className="mt-1 flex flex-wrap gap-1">
            {op.source && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">{op.source}</Badge>}
            {op.part === "prepay" && <Badge className="px-1.5 py-0 text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">предоплата</Badge>}
            {op.part === "rest" && <Badge className="px-1.5 py-0 text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200">остаток</Badge>}
          </div>
        )}
      </div>
      <div
        className={cn(
          "shrink-0 text-sm font-semibold tabular-nums",
          income ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
        )}
      >
        {income ? "+" : "−"}
        {fmtMoney(op.amount)}
      </div>
    </button>
  );
}

export function LedgerView() {
  const operations = useStore((s) => s.operations);
  const settings = useStore((s) => s.settings);
  const license = useStore((s) => s.license);
  const openAdd = useUi((s) => s.openAdd);
  const openPro = useUi((s) => s.openPro);

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

  const goalPct = settings.monthlyGoal > 0 ? Math.min(100, Math.round((totals.income / settings.monthlyGoal) * 100)) : 0;
  const monthDeals = deals.filter((d) => d.lastDate.startsWith(`${y}-${String(m).padStart(2, "0")}`));

  return (
    <div className="space-y-4">
      {/* Переключатель месяца */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => setMonth(shiftMonth(y, m, -1))} aria-label="Предыдущий месяц">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-base font-semibold">{monthLabel(y, m)}</h2>
        <Button variant="ghost" size="icon" onClick={() => setMonth(shiftMonth(y, m, 1))} aria-label="Следующий месяц">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Итоги месяца */}
      <Card>
        <CardContent className="grid grid-cols-3 gap-2 p-4 text-center">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Доход</div>
            <div className="mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums sm:text-base">
              {fmtMoney(totals.income)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Расход</div>
            <div className="mt-0.5 text-sm font-bold text-rose-600 dark:text-rose-400 tabular-nums sm:text-base">
              {fmtMoney(totals.expense)}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Прибыль</div>
            <div
              className={cn(
                "mt-0.5 text-sm font-bold tabular-nums sm:text-base",
                totals.profit >= 0 ? "text-foreground" : "text-rose-600 dark:text-rose-400"
              )}
            >
              {fmtMoney(totals.profit)}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Цель по доходу (Pro) */}
      {settings.monthlyGoal > 0 && (
        <Card>
          <CardContent className="p-4">
            {isPro(license) ? (
              <>
                <div className="mb-2 flex items-baseline justify-between text-sm">
                  <span className="text-muted-foreground">Цель месяца</span>
                  <span className="font-semibold tabular-nums">
                    {fmtMoney(totals.income)} / {fmtMoney(settings.monthlyGoal)}
                  </span>
                </div>
                <Progress value={goalPct} className="h-2.5" />
                <div className="mt-1 text-right text-xs text-muted-foreground">{goalPct}%</div>
              </>
            ) : (
              <button className="flex w-full items-center gap-3 text-left" onClick={openPro}>
                <Lock className="h-4 w-4 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">Цель месяца · Pro</div>
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

      {/* Открытые доплаты */}
      {monthDeals.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-900">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <HandCoins className="h-4 w-4 text-amber-500" />
              Ждут доплаты
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {monthDeals.slice(0, 5).map((d) => (
              <div key={d.dealId} className="flex items-center gap-2 rounded-lg bg-muted/60 p-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {d.clientName} · {d.type || "заказ"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    оплачено {fmtMoney(d.paid)} из {fmtMoney(d.total)}
                  </div>
                </div>
                <div className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                  {fmtMoney(d.remaining)}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 shrink-0"
                  onClick={() =>
                    openAdd({
                      kind: "income",
                      clientId: d.ops[0]?.clientId,
                      dealId: d.dealId,
                      part: "rest",
                    })
                  }
                >
                  Записать
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Список операций */}
      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          В этом месяце пока пусто.
          <br />
          Нажмите «+», чтобы записать первую операцию.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(([date, ops]) => (
            <div key={date}>
              <div className="mb-1 px-2 text-xs font-medium text-muted-foreground">
                {fmtDateFull(date)}
              </div>
              <Card className="divide-y divide-border/60 py-1">
                {ops.map((op) => (
                  <OperationRow key={op.id} op={op} />
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
