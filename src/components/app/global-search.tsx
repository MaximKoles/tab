"use client";

// Глобальный поиск по операциям и клиентам: кнопка в шапке или Ctrl/Cmd+K.
// Клик по клиенту — вкладка «Клиенты» и его карточка; клик по операции — редактирование.
// Фильтрацию делает cmdk по value/keywords, поэтому в keywords собраны все поля поиска.

import { useMemo } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { fmtMoney, fmtDateFull } from "@/lib/format";
import { clientStats } from "@/lib/analytics";
import { cn } from "@/lib/utils";
import type { Operation } from "@/lib/types";

function opKeywords(op: Operation): string {
  return [
    op.type,
    op.clientName,
    op.note,
    op.source,
    String(op.amount),
    fmtMoney(op.amount),
    op.kind === "income" ? "доход платёж" : "расход",
    op.part === "prepay" ? "предоплата" : "",
    op.part === "rest" ? "остаток" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function OperationResult({ op }: { op: Operation }) {
  const income = op.kind === "income";
  return (
    <>
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
          income ? "bg-positive-soft text-positive" : "bg-caution-soft text-caution"
        )}
        aria-hidden
      >
        {income ? "+" : "−"}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{op.type || "Без категории"}</div>
        <div className="truncate text-xs text-muted-foreground">
          {[op.clientName, fmtDateFull(op.date)].filter(Boolean).join(" · ")}
        </div>
      </div>
      <div
        className={cn(
          "shrink-0 text-sm font-bold tabular-nums",
          income ? "text-positive" : "text-foreground"
        )}
      >
        {income ? "+" : "−"}
        {fmtMoney(op.amount)}
      </div>
    </>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function GlobalSearch() {
  const searchOpen = useUi((s) => s.searchOpen);
  const closeSearch = useUi((s) => s.closeSearch);
  const setTab = useUi((s) => s.setTab);
  const openClient = useUi((s) => s.openClient);
  const openEdit = useUi((s) => s.openEdit);
  const openSearch = useUi((s) => s.openSearch);

  const operations = useStore((s) => s.operations);
  const clients = useStore((s) => s.clients);

  const stats = useMemo(() => clientStats(operations, clients), [operations, clients]);
  const hasData = operations.length > 0 || clients.length > 0;

  // Клиенты: показываем всех заведённых (до 50), cmdk сам отфильтрует по вводу
  const clientItems = useMemo(
    () =>
      stats.slice(0, 50).map((s) => ({
        ...s,
        keywords: [s.client.name, s.client.contact ?? "", s.client.note ?? "", "клиент"].join(" "),
      })),
    [stats]
  );

  // Операции: последние 200, отсортированные по дате
  const opItems = useMemo(
    () =>
      [...operations]
        .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)))
        .slice(0, 200)
        .map((op) => ({ op, keywords: opKeywords(op) })),
    [operations]
  );

  function pickClient(id: string) {
    closeSearch();
    setTab("clients");
    openClient(id);
  }

  function pickOperation(id: string) {
    closeSearch();
    openEdit(id);
  }

  return (
    <CommandDialog
      open={searchOpen}
      onOpenChange={(v) => (v ? openSearch() : closeSearch())}
      title="Поиск"
      description="Поиск по операциям и клиентам"
      className="top-[6%] max-h-[82dvh] translate-y-0 sm:top-[8%]"
      showCloseButton={false}
    >
      <CommandInput placeholder="Имя клиента, услуга, комментарий, сумма…" />
      <CommandList className="max-h-[min(430px,62dvh)]">
        {!hasData ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            Пока нет ни операций, ни клиентов — начните с кнопки «+».
          </div>
        ) : (
          <>
            <CommandEmpty className="py-8 text-center text-sm text-muted-foreground">
              Ничего не нашлось. Попробуйте другое слово.
            </CommandEmpty>

            {clientItems.length > 0 && (
              <CommandGroup heading="Клиенты">
                {clientItems.map((s) => (
                  <CommandItem
                    key={s.client.id}
                    value={`${s.client.name}-${s.client.id}`}
                    keywords={[s.keywords]}
                    onSelect={() => pickClient(s.client.id)}
                  >
                    <span
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-foreground"
                      aria-hidden
                    >
                      {initials(s.client.name) || <UserRound className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{s.client.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {s.client.contact ||
                          (s.lastDate ? `платёж ${fmtDateFull(s.lastDate)}` : "нет платежей")}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
                      {s.paidTotal > 0 ? fmtMoney(s.paidTotal) : ""}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            <CommandSeparator />

            {opItems.length > 0 && (
              <CommandGroup heading="Операции">
                {opItems.map(({ op, keywords }) => (
                  <CommandItem
                    key={op.id}
                    value={`${op.type ?? ""}-${op.clientName ?? ""}-${op.id}`}
                    keywords={[keywords]}
                    onSelect={() => pickOperation(op.id)}
                  >
                    <OperationResult op={op} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
