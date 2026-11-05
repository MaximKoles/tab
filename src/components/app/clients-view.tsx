"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { clientStats } from "@/lib/analytics";
import { fmtMoney, fmtDate } from "@/lib/format";
import { isPro, FREE_LIMITS } from "@/lib/limits";
import type { Client } from "@/lib/types";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ClientsView() {
  const { operations, clients, license } = useStore();
  const addClient = useStore((s) => s.addClient);
  const updateClient = useStore((s) => s.updateClient);
  const deleteClient = useStore((s) => s.deleteClient);
  const openAdd = useUi((s) => s.openAdd);
  const openPro = useUi((s) => s.openPro);

  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact: "", note: "" });

  const stats = useMemo(() => clientStats(operations, clients), [operations, clients]);
  const filtered = stats.filter(
    (s) =>
      !query.trim() ||
      s.client.name.toLowerCase().includes(query.toLowerCase()) ||
      (s.client.contact ?? "").toLowerCase().includes(query.toLowerCase())
  );

  const detail = detailId ? stats.find((s) => s.client.id === detailId) : null;
  const detailOps = useMemo(() => {
    if (!detailId) return [];
    return operations
      .filter((o) => o.clientId === detailId && o.kind === "income")
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [detailId, operations]);

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

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени или контакту"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Поиск клиентов"
          />
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 sm:mr-1" />
          <span className="hidden sm:inline">Клиент</span>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          Клиентов пока нет. Добавьте первого — или просто записывайте доходы с именем клиента,
          он появится здесь автоматически.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(({ client, paidTotal, opsCount, lastDate, debt }) => (
            <Card
              key={client.id}
              className="cursor-pointer p-3 transition-colors hover:bg-muted/50"
              onClick={() => setDetailId(client.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setDetailId(client.id)}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  {initials(client.name) || <UserRound className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium">{client.name}</span>
                    {debt > 0 && (
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        долг {fmtMoney(debt)}
                      </Badge>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {client.contact || "—"}
                    {lastDate && ` · был платёж ${fmtDate(lastDate)}`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {fmtMoney(paidTotal)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{opsCount} плат.</div>
                </div>
              </div>
            </Card>
          ))}
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
            <Button onClick={handleAddClient} className="bg-emerald-600 hover:bg-emerald-700">
              Добавить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Диалог клиента */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle>{detail.client.name}</DialogTitle>
                <DialogDescription>
                  {detail.client.contact || "Контакт не указан"}
                  {detail.client.note ? ` · ${detail.client.note}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted p-3 text-center">
                <div>
                  <div className="text-[11px] text-muted-foreground">Заплатил</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {fmtMoney(detail.paidTotal)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Долг</div>
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                    {fmtMoney(detail.debt)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">Платежей</div>
                  <div className="text-sm font-bold tabular-nums">{detail.opsCount}</div>
                </div>
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

              <div className="space-y-1">
                <div className="text-sm font-medium">История платежей</div>
                {detailOps.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    Платежей ещё не было
                  </div>
                ) : (
                  <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
                    {detailOps.map((op) => (
                      <div
                        key={op.id}
                        className="flex items-center justify-between rounded-lg bg-muted/60 px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="truncate">{op.type || "Платёж"}</div>
                          <div className="text-xs text-muted-foreground">{fmtDate(op.date)}</div>
                        </div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          +{fmtMoney(op.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter className="flex-row gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="text-rose-600 hover:text-rose-700">
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
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          deleteClient(detail.client.id);
                          setDetailId(null);
                          toast.success("Клиент удалён");
                        }}
                      >
                        Удалить
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => {
                    setDetailId(null);
                    openAdd({ kind: "income", clientId: detail.client.id });
                  }}
                >
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
