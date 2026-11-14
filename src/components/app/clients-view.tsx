"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowDownUp, Check, Copy, HandCoins, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { clientStats, openDeals, type ClientStats } from "@/lib/analytics";
import { fmtMoney, fmtNum, fmtDate, fmtDateFull, ruPlural } from "@/lib/format";
import { isPro, FREE_LIMITS } from "@/lib/limits";
import type { Operation } from "@/lib/types";
import { cn } from "@/lib/utils";

const AVATAR_CLASSES = [
  "bg-muted text-foreground",
  "bg-positive-soft text-positive",
  "bg-caution-soft text-caution",
  "bg-lemon-soft text-foreground",
  "bg-[#e5e3ef] text-[#5d5876]",
  "bg-[#e2eaef] text-[#4e6572]",
];

function avatarClass(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_CLASSES[h % AVATAR_CLASSES.length];
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

/** Контакт в ссылку: @ник → Telegram, телефон → tel:, почта → mailto:, url → ссылка */
function contactHref(contact: string): string | null {
  const c = contact.trim();
  if (!c) return null;
  if (/^https?:\/\//i.test(c)) return c;
  if (c.startsWith("@")) return `https://t.me/${c.slice(1)}`;
  if (/^(t\.me|wa\.me)\//i.test(c)) return `https://${c}`;
  if (/^\+?[\d\s\-()]{6,}$/.test(c)) return `tel:${c.replace(/[^\d+]/g, "")}`;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return `mailto:${c}`;
  return null;
}

type SortKey = "paid" | "name" | "debt" | "recent";
type FilterKey = "all" | "debt" | "stale";

const SORT_LABELS: Record<SortKey, string> = {
  paid: "по сумме",
  name: "по алфавиту",
  debt: "по долгу",
  recent: "по свежести",
};

const STALE_DAYS = 45;

function daysSince(date: string | null): number | null {
  if (!date) return null;
  const d = new Date(date);
  return Math.floor((Date.now() - d.getTime()) / 86_400_000);
}

/** Платежи клиента, сгруппированные по месяцам */
function groupByMonth(ops: Operation[]): Array<{ key: string; label: string; total: number; ops: Operation[] }> {
  const map = new Map<string, Operation[]>();
  for (const op of ops) {
    const key = op.date.slice(0, 7);
    const arr = map.get(key) ?? [];
    arr.push(op);
    map.set(key, arr);
  }
  return Array.from(map.entries()).map(([key, list]) => {
    const [y, m] = key.split("-").map(Number);
    const nom = ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"][m - 1];
    return {
      key,
      label: `${nom[0].toUpperCase()}${nom.slice(1)} ${y}`,
      total: list.reduce((s, o) => s + o.amount, 0),
      ops: list,
    };
  });
}

export function ClientsView() {
  const { operations, clients, license } = useStore();
  const addClient = useStore((s) => s.addClient);
  const updateClient = useStore((s) => s.updateClient);
  const deleteClient = useStore((s) => s.deleteClient);
  const openAdd = useUi((s) => s.openAdd);
  const openPro = useUi((s) => s.openPro);
  // карточка клиента живёт в ui-store — так её открывает и глобальный поиск
  const detailId = useUi((s) => s.clientDetailId);
  const closeClient = useUi((s) => s.closeClient);

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("paid");
  const [filter, setFilter] = useState<FilterKey>("all");
  // диалог «новый клиент» открывает «+» в шапке (ui-store)
  const addOpen = useUi((s) => s.clientFormOpen);
  const setAddOpen = (v: boolean) => (v ? useUi.getState().openClientForm() : useUi.getState().closeClientForm());
  const [form, setForm] = useState({ name: "", contact: "", note: "" });
  const [copied, setCopied] = useState(false);

  const stats = useMemo(() => clientStats(operations, clients), [operations, clients]);

  const totals = useMemo(() => {
    const paid = stats.reduce((s, x) => s + x.paidTotal, 0);
    const debt = stats.reduce((s, x) => s + x.debt, 0);
    return { paid, debt };
  }, [stats]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = stats.filter((s) => {
      if (
        q &&
        !s.client.name.toLowerCase().includes(q) &&
        !(s.client.contact ?? "").toLowerCase().includes(q) &&
        !(s.client.note ?? "").toLowerCase().includes(q)
      )
        return false;
      if (filter === "debt" && s.debt <= 0) return false;
      if (filter === "stale") {
        const d = daysSince(s.lastDate);
        if (d === null || d < STALE_DAYS) return false;
      }
      return true;
    });
    const sorted = [...list];
    switch (sortKey) {
      case "name":
        sorted.sort((a, b) => a.client.name.localeCompare(b.client.name, "ru"));
        break;
      case "debt":
        sorted.sort((a, b) => b.debt - a.debt || b.paidTotal - a.paidTotal);
        break;
      case "recent":
        sorted.sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));
        break;
      default:
        sorted.sort((a, b) => b.paidTotal - a.paidTotal);
    }
    return sorted;
  }, [stats, query, filter, sortKey]);

  const detail = detailId ? stats.find((s) => s.client.id === detailId) ?? null : null;

  const detailOps = useMemo(() => {
    if (!detailId) return [];
    return operations
      .filter((o) => o.clientId === detailId && o.kind === "income")
      .sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
  }, [detailId, operations]);

  const detailMonthGroups = useMemo(() => groupByMonth(detailOps), [detailOps]);
  const detailSources = useMemo(
    () => Array.from(new Set(detailOps.map((o) => o.source).filter(Boolean))) as string[],
    [detailOps]
  );
  const avgCheck = detail && detail.opsCount > 0 ? Math.round(detail.paidTotal / detail.opsCount) : 0;
  const staleDays = detail ? daysSince(detail.lastDate) : null;

  // Кнопка «Записать платёж» открывает шторку ввода; если у клиента есть
  // незакрытая сделка — сразу подставляем остаток, чтобы не искать вручную
  function recordPayment(clientId: string) {
    closeClient();
    const deal = openDeals(operations).find((d) => d.ops.some((o) => o.clientId === clientId));
    if (deal) {
      openAdd({ kind: "income", clientId, part: "rest", dealId: deal.dealId, amount: deal.remaining });
    } else {
      openAdd({ kind: "income", clientId });
    }
  }

  function handleAddClient() {
    if (!form.name.trim()) {
      toast.error("Укажите имя клиента");
      return;
    }
    if (!isPro(license) && clients.length >= FREE_LIMITS.clients) {
      toast.error(`В бесплатной версии до ${FREE_LIMITS.clients} клиентов`);
      openPro();
      return;
    }
    addClient({
      name: form.name.trim(),
      contact: form.contact.trim() || undefined,
      note: form.note.trim() || undefined,
    });
    toast.success("Клиент добавлен");
    setForm({ name: "", contact: "", note: "" });
    setAddOpen(false);
  }

  async function copyContact(contact: string) {
    try {
      await navigator.clipboard.writeText(contact);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      toast.success("Контакт скопирован");
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  return (
    <div className="space-y-4">
      {/* Поиск */}
      {clients.length > 0 && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Имя, контакт, заметка…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="h-12 rounded-full border-border bg-card pl-10 shadow-soft"
            aria-label="Поиск клиентов"
          />
        </div>
      )}

      {/* Фильтры и сортировка */}
      {clients.length > 0 && (
        <div className="no-scrollbar -mx-5 flex items-center gap-2 overflow-x-auto px-5">
          <div className="flex shrink-0 rounded-full border border-border bg-card p-1" role="group" aria-label="Фильтр клиентов">
            {(
              [
                ["all", "Все"],
                ["debt", "С долгом"],
                ["stale", `Молчат ${STALE_DAYS}+ дн.`],
              ] as Array<[FilterKey, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                aria-pressed={filter === key}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
                  filter === key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
            <SelectTrigger
              className="h-10 w-auto shrink-0 gap-1 rounded-full border-border bg-card text-xs shadow-soft"
              aria-label="Сортировка клиентов"
            >
              <ArrowDownUp className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {SORT_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Сводка */}
      {clients.length > 0 && (
        <div className="grid grid-cols-3 rounded-[28px] bg-card px-2 py-4 text-center shadow-soft">
          <div>
            <div className="text-[11px] text-muted-foreground">Клиентов</div>
            <div className="mt-0.5 text-lg font-bold tabular-nums">{clients.length}</div>
          </div>
          <div className="border-x border-border">
            <div className="text-[11px] text-muted-foreground">Получено</div>
            <div className="mt-0.5 text-lg font-bold text-positive tabular-nums">{fmtNum(totals.paid)}</div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground">Ждёт оплаты</div>
            <div
              className={cn(
                "mt-0.5 text-lg font-bold tabular-nums",
                totals.debt > 0 ? "text-caution" : "text-muted-foreground"
              )}
            >
              {fmtNum(totals.debt)}
            </div>
          </div>
        </div>
      )}

      {/* Список клиентов */}
      {clients.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-foreground/20 p-8 text-center text-sm text-muted-foreground">
          Клиентов пока нет. Добавьте первого кнопкой «+» — или просто записывайте доходы с именем
          клиента, он появится здесь автоматически.
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-[28px] border border-dashed border-foreground/20 p-8 text-center text-sm text-muted-foreground">
          Под фильтр ничего не попало. Попробуйте другой фильтр или очистите поиск.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ client, paidTotal, opsCount, lastDate, debt }: ClientStats) => {
            const stale = daysSince(lastDate);
            return (
              <div
                key={client.id}
                className="flex cursor-pointer items-center gap-3 rounded-[22px] bg-card p-3.5 shadow-soft transition-transform active:scale-[0.99]"
                onClick={() => useUi.getState().openClient(client.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && useUi.getState().openClient(client.id)}
              >
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    avatarClass(client.name)
                  )}
                >
                  {initials(client.name) || <UserRound className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[15px] font-semibold">{client.name}</span>
                    {debt > 0 && (
                      <span className="shrink-0 rounded-full bg-caution-soft px-2 py-0.5 text-[10px] font-semibold text-caution">
                        долг
                      </span>
                    )}
                    {stale !== null && stale >= STALE_DAYS && (
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        молчит
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {client.contact || "—"}
                    {lastDate && ` · платёж ${fmtDate(lastDate)}`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[15px] font-bold tabular-nums">{fmtMoney(paidTotal)}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {opsCount} {ruPlural(opsCount, ["платёж", "платежа", "платежей"])}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Диалог добавления клиента */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cl-name">Имя</Label>
              <Input
                id="cl-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Как зовут клиента"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-contact">Контакт</Label>
              <Input
                id="cl-contact"
                value={form.contact}
                onChange={(e) => setForm({ ...form, contact: e.target.value })}
                placeholder="Телефон или @телеграм"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cl-note">Заметка</Label>
              <Input
                id="cl-note"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="Например: постоянный, любит созвоны"
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleAddClient} className="rounded-full">
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог клиента */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && closeClient()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      avatarClass(detail.client.name)
                    )}
                    aria-hidden
                  >
                    {initials(detail.client.name) || <UserRound className="h-4 w-4" />}
                  </span>
                  {detail.client.name}
                </DialogTitle>
                <DialogDescription>
                  Клиент с {fmtDateFull(detail.client.createdAt.slice(0, 10))}
                </DialogDescription>
              </DialogHeader>

              {/* Контакт: ссылка + копирование */}
              {detail.client.contact && (
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-3.5 py-2.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{detail.client.contact}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label="Скопировать контакт"
                    onClick={() => copyContact(detail.client.contact!)}
                  >
                    {copied ? <Check className="h-4 w-4 text-positive" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  {contactHref(detail.client.contact) && (
                    <Button variant="outline" size="sm" className="h-8 shrink-0 rounded-full" asChild>
                      <a
                        href={contactHref(detail.client.contact)!}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Написать
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {/* Статистика */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[18px] bg-muted p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">Заплатил всего</div>
                  <div className="text-sm font-bold text-positive tabular-nums">
                    {fmtMoney(detail.paidTotal)}
                  </div>
                </div>
                <div className="rounded-[18px] bg-muted p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">Средний чек</div>
                  <div className="text-sm font-bold tabular-nums">{fmtMoney(avgCheck)}</div>
                </div>
                <div className="rounded-[18px] bg-muted p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">Платежей</div>
                  <div className="text-sm font-bold tabular-nums">{detail.opsCount}</div>
                </div>
                <div className="rounded-[18px] bg-muted p-3 text-center">
                  <div className="text-[11px] text-muted-foreground">Долг</div>
                  <div
                    className={cn(
                      "text-sm font-bold tabular-nums",
                      detail.debt > 0 ? "text-caution" : "text-muted-foreground"
                    )}
                  >
                    {fmtMoney(detail.debt)}
                  </div>
                </div>
              </div>

              {staleDays !== null && staleDays >= STALE_DAYS && (
                <div className="rounded-2xl bg-caution-soft px-3.5 py-2.5 text-xs text-caution">
                  Последний платёж был {staleDays} дн. назад — повод напомнить о себе.
                </div>
              )}

              {/* Редактирование полей */}
              <div className="space-y-2 rounded-lg border p-3">
                <div className="text-xs font-medium text-muted-foreground">Данные клиента</div>
                <div className="space-y-1.5">
                  <Label htmlFor="cl-edit-name">Имя</Label>
                  <Input
                    id="cl-edit-name"
                    defaultValue={detail.client.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== detail.client.name) {
                        updateClient(detail.client.id, { name: v });
                        toast.success("Имя обновлено");
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cl-edit-contact">Контакт</Label>
                  <Input
                    id="cl-edit-contact"
                    defaultValue={detail.client.contact ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (detail.client.contact ?? "")) {
                        updateClient(detail.client.id, { contact: v || undefined });
                        toast.success("Контакт обновлён");
                      }
                    }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cl-edit-note">Заметка</Label>
                  <Input
                    id="cl-edit-note"
                    defaultValue={detail.client.note ?? ""}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v !== (detail.client.note ?? "")) {
                        updateClient(detail.client.id, { note: v || undefined });
                        toast.success("Заметка обновлена");
                      }
                    }}
                    placeholder="Например: постоянный, платит по пятницам"
                  />
                </div>
              </div>

              {/* Источники клиента */}
              {detailSources.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Пришёл через:</span>
                  {detailSources.map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}

              {/* История платежей по месяцам */}
              <div className="space-y-1">
                <div className="text-sm font-medium">История платежей</div>
                {detailMonthGroups.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Платежей ещё не было
                  </div>
                ) : (
                  <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                    {detailMonthGroups.map((g) => (
                      <div key={g.key}>
                        <div className="flex items-baseline justify-between px-1 py-1 text-xs">
                          <span className="font-medium text-muted-foreground">{g.label}</span>
                          <span className="font-bold tabular-nums text-positive">
                            {fmtMoney(g.total)}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {g.ops.map((op) => (
                            <div
                              key={op.id}
                              className="flex items-center justify-between rounded-2xl bg-muted/70 px-3.5 py-2.5 text-sm"
                            >
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 truncate">
                                  {op.type || "Платёж"}
                                  {op.part === "prepay" && (
                                    <span className="shrink-0 rounded-full bg-lemon-soft px-2 py-0.5 text-[10px] font-semibold">
                                      предоплата
                                    </span>
                                  )}
                                  {op.part === "rest" && (
                                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                      остаток
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground">{fmtDate(op.date)}</div>
                              </div>
                              <div className="font-bold text-positive tabular-nums">
                                +{fmtMoney(op.amount)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="flex-row gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="rounded-full text-destructive hover:text-destructive">
                      Удалить
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить клиента?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Операции останутся в журнале, но потеряют связь с клиентом.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        className="rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => {
                          deleteClient(detail.client.id);
                          closeClient();
                          toast.success("Клиент удалён");
                        }}
                      >
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  className="flex-1 rounded-full"
                  onClick={() => recordPayment(detail.client.id)}
                >
                  <HandCoins className="mr-1 h-4 w-4" />
                  Записать платёж
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
