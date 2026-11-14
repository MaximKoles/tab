"use client";

import { useEffect, useMemo, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { useUi } from "@/lib/ui-store";
import { todayISO, fmtMoney } from "@/lib/format";
import { isPro, FREE_LIMITS } from "@/lib/limits";
import { openDeals } from "@/lib/analytics";
import type { OpKind, PayPart } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FormState {
  kind: OpKind;
  amount: string;
  date: string;
  type: string;
  source: string;
  clientName: string;
  contact: string;
  part: PayPart;
  dealTotal: string;
  dealId: string;
  note: string;
}

const emptyForm = (): FormState => ({
  kind: "income",
  amount: "",
  date: todayISO(),
  type: "",
  source: "",
  clientName: "",
  contact: "",
  part: "single",
  dealTotal: "",
  dealId: "",
  note: "",
});

export function AddOperationSheet() {
  const { addSheet, closeAdd } = useUi();
  const { operations, clients, categories, license } = useStore();
  const addOperation = useStore((s) => s.addOperation);
  const updateOperation = useStore((s) => s.updateOperation);
  const deleteOperation = useStore((s) => s.deleteOperation);
  const addClient = useStore((s) => s.addClient);

  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);

  const editing = useMemo(
    () => (addSheet.editId ? operations.find((o) => o.id === addSheet.editId) ?? null : null),
    [addSheet.editId, operations]
  );

  // Инициализация формы при открытии
  useEffect(() => {
    if (!addSheet.open) return;
    if (editing) {
      const client = editing.clientId
        ? clients.find((c) => c.id === editing.clientId)
        : undefined;
      setForm({
        kind: editing.kind,
        amount: String(editing.amount),
        date: editing.date,
        type: editing.type ?? "",
        source: editing.source ?? "",
        clientName: client?.name ?? editing.clientName ?? "",
        contact: client?.contact ?? "",
        part: editing.part,
        dealTotal: editing.dealTotal ? String(editing.dealTotal) : "",
        dealId: editing.dealId ?? "",
        note: editing.note ?? "",
      });
    } else {
      const base = emptyForm();
      const p = addSheet.prefill ?? {};
      let clientName = "";
      if (p.clientId) {
        const c = clients.find((x) => x.id === p.clientId);
        clientName = c?.name ?? "";
      }
      // Подтягиваем тип и клиента из сделки (для статуса «Остаток»)
      if (p.dealId) {
        const dealOps = operations.filter((o) => o.dealId === p.dealId);
        if (dealOps.length > 0) {
          base.type = dealOps.find((o) => o.type)?.type ?? "";
          if (!clientName) clientName = dealOps[0].clientName ?? "";
        }
      }
      setForm({
        ...base,
        kind: p.kind ?? "income",
        part: p.part ?? "single",
        clientName,
        dealId: p.dealId ?? "",
        amount: p.amount !== undefined ? String(p.amount) : base.amount,
        type: p.type ?? base.type,
        source: p.source ?? base.source,
      });
    }
  }, [addSheet.open, addSheet.prefill, editing, clients, operations]);

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }));

  // Открытые сделки выбранного клиента (для статуса «Остаток»)
  const clientDeals = useMemo(() => {
    if (!form.clientName.trim()) return [];
    const client = clients.find(
      (c) => c.name.toLowerCase() === form.clientName.trim().toLowerCase()
    );
    if (!client) return [];
    return openDeals(operations).filter((d) =>
      d.ops.some((o) => o.clientId === client.id)
    );
  }, [form.clientName, clients, operations]);

  const selectedDeal = clientDeals.find((d) => d.dealId === form.dealId);

  // Если выбран остаток по сделке — подставляем сумму остатка
  useEffect(() => {
    if (form.part === "rest" && selectedDeal && !editing) {
      patch({ amount: String(selectedDeal.remaining), dealTotal: String(selectedDeal.total) });
    }
  }, [form.dealId, form.part]);

  const income = form.kind === "income";

  const amountNum = parseFloat(form.amount.replace(/\s/g, "").replace(",", "."));
  const amountValid = !isNaN(amountNum) && amountNum > 0;

  const matchedClient = clients.find(
    (c) => c.name.trim().toLowerCase() === form.clientName.trim().toLowerCase() && form.clientName.trim() !== ""
  );
  const showContact = income && form.clientName.trim() !== "" && !matchedClient;

  async function handleSave() {
    if (!amountValid) {
      toast.error("Укажите сумму больше нуля");
      return;
    }
    if (!form.date) {
      toast.error("Укажите дату");
      return;
    }
    if (income && form.part !== "single" && !form.dealTotal && !selectedDeal) {
      toast.error("Для предоплаты укажите полную сумму сделки");
      return;
    }
    if (income && form.part === "rest" && !form.dealId && clientDeals.length > 0) {
      toast.error("Выберите сделку, по которой вносите остаток");
      return;
    }
    // Лимиты бесплатной версии
    if (!isPro(license) && !editing) {
      if (operations.length >= FREE_LIMITS.operations) {
        toast.error(`В бесплатной версии до ${FREE_LIMITS.operations} операций`);
        useUi.getState().openPro();
        return;
      }
      if (
        income &&
        !matchedClient &&
        form.clientName.trim() !== "" &&
        clients.length >= FREE_LIMITS.clients
      ) {
        toast.error(`В бесплатной версии до ${FREE_LIMITS.clients} клиентов`);
        useUi.getState().openPro();
        return;
      }
    }

    setSaving(true);
    try {
      // Клиент: находим или создаём
      let clientId: string | undefined;
      let clientName: string | undefined;
      if (income && form.clientName.trim()) {
        if (matchedClient) {
          clientId = matchedClient.id;
          clientName = matchedClient.name;
          if (form.contact.trim() && !matchedClient.contact) {
            useStore.getState().updateClient(matchedClient.id, { contact: form.contact.trim() });
          }
        } else {
          const created = addClient({
            name: form.clientName.trim(),
            contact: form.contact.trim() || undefined,
          });
          clientId = created.id;
          clientName = created.name;
        }
      }

      const dealTotal = parseFloat(form.dealTotal.replace(/\s/g, "").replace(",", ".")) || undefined;

      if (editing) {
        updateOperation(editing.id, {
          date: form.date,
          amount: amountNum,
          kind: form.kind,
          type: form.type.trim() || undefined,
          source: income && form.source.trim() ? form.source.trim() : undefined,
          clientId,
          clientName,
          note: form.note.trim() || undefined,
          part: income ? form.part : "single",
          dealTotal: income && form.part !== "single" ? dealTotal : undefined,
          dealId: income && form.part !== "single" ? form.dealId || editing.dealId : undefined,
        });
        toast.success("Изменения сохранены");
      } else {
        const isDeal = income && form.part !== "single";
        addOperation({
          date: form.date,
          amount: amountNum,
          kind: form.kind,
          type: form.type.trim() || undefined,
          source: income && form.source.trim() ? form.source.trim() : undefined,
          clientId,
          clientName,
          note: form.note.trim() || undefined,
          part: income ? form.part : "single",
          dealId: isDeal
            ? form.part === "prepay" || !form.dealId
              ? `deal-${Date.now()}`
              : form.dealId
            : undefined,
          dealTotal: isDeal ? dealTotal : undefined,
        });
        toast.success(
          income ? `Доход ${fmtMoney(amountNum)} записан` : `Расход ${fmtMoney(amountNum)} записан`
        );
      }
      closeAdd();
    } finally {
      setSaving(false);
    }
  }

  function handleDelete() {
    if (!editing) return;
    deleteOperation(editing.id);
    toast.success("Операция удалена");
    closeAdd();
  }

  return (
    <Drawer open={addSheet.open} onOpenChange={(v) => !v && closeAdd()}>
      <DrawerContent className="mx-auto max-w-md">
        <div className="mx-auto max-h-[82dvh] w-full max-w-md overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
          <DrawerHeader className="px-0 pb-2 pt-1">
            <DrawerTitle>{editing ? "Изменить операцию" : "Новая операция"}</DrawerTitle>
          </DrawerHeader>

          {/* Доход / Расход */}
          <div className="mb-3 grid grid-cols-2 gap-2" role="tablist" aria-label="Тип операции">
            {(["income", "expense"] as OpKind[]).map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={form.kind === k}
                onClick={() => patch({ kind: k })}
                className={cn(
                  "min-h-[46px] rounded-full font-semibold transition-colors",
                  form.kind === k
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {k === "income" ? "Доход" : "Расход"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="op-amount">Сумма, ₽</Label>
                <Input
                  id="op-amount"
                  inputMode="decimal"
                  placeholder="0"
                  autoFocus
                  value={form.amount}
                  onChange={(e) => patch({ amount: e.target.value })}
                  className="h-11 text-lg font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="op-date">Дата</Label>
                <Input
                  id="op-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => patch({ date: e.target.value })}
                  className="h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="op-type">{income ? "Тип дохода" : "Тип расхода"}</Label>
              <Input
                id="op-type"
                list={income ? "dl-income-types" : "dl-expense-types"}
                placeholder={income ? "Например: Таплинк" : "Например: Таргет"}
                value={form.type}
                onChange={(e) => patch({ type: e.target.value })}
              />
              <datalist id="dl-income-types">
                {categories.incomeTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              <datalist id="dl-expense-types">
                {categories.expenseTypes.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>

            {income && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="op-client">Клиент</Label>
                  <Input
                    id="op-client"
                    list="dl-clients"
                    placeholder="Имя клиента"
                    value={form.clientName}
                    onChange={(e) => patch({ clientName: e.target.value })}
                  />
                  <datalist id="dl-clients">
                    {clients.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                {showContact && (
                  <div className="space-y-1.5">
                    <Label htmlFor="op-contact">Контакт нового клиента</Label>
                    <Input
                      id="op-contact"
                      placeholder="Телефон или @телеграм"
                      value={form.contact}
                      onChange={(e) => patch({ contact: e.target.value })}
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="op-source">Источник клиента</Label>
                  <Input
                    id="op-source"
                    list="dl-sources"
                    placeholder="Откуда пришёл клиент"
                    value={form.source}
                    onChange={(e) => patch({ source: e.target.value })}
                  />
                  <datalist id="dl-sources">
                    {categories.sources.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>

                {/* Часть оплаты */}
                <div className="space-y-1.5">
                  <Label>Оплата</Label>
                  <div className="grid grid-cols-3 gap-2" role="group" aria-label="Часть оплаты">
                    {(
                      [
                        ["single", "Вся сумма"],
                        ["prepay", "Предоплата"],
                        ["rest", "Остаток"],
                      ] as Array<[PayPart, string]>
                    ).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => patch({ part: val })}
                        aria-pressed={form.part === val}
                        className={cn(
                          "min-h-[40px] rounded-full text-sm font-semibold transition-colors",
                          form.part === val
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {form.part !== "single" && (
                  <>
                    {form.part === "rest" && clientDeals.length > 0 && (
                      <div className="space-y-1.5">
                        <Label>Сделка</Label>
                        <Select value={form.dealId} onValueChange={(v) => patch({ dealId: v })}>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Выберите сделку" />
                          </SelectTrigger>
                          <SelectContent>
                            {clientDeals.map((d) => (
                              <SelectItem key={d.dealId} value={d.dealId}>
                                {d.type || "Сделка"} · осталось {fmtMoney(d.remaining)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    {!selectedDeal && (
                      <div className="space-y-1.5">
                        <Label htmlFor="op-deal-total">Полная сумма сделки, ₽</Label>
                        <Input
                          id="op-deal-total"
                          inputMode="decimal"
                          placeholder="Сколько стоит заказ целиком"
                          value={form.dealTotal}
                          onChange={(e) => patch({ dealTotal: e.target.value })}
                        />
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="op-note">Комментарий</Label>
              <Input
                id="op-note"
                placeholder="Детали, номер заказа…"
                value={form.note}
                onChange={(e) => patch({ note: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            {editing && (
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 shrink-0 rounded-full text-destructive hover:text-destructive"
                onClick={handleDelete}
                aria-label="Удалить операцию"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              className="h-12 flex-1 rounded-full text-base font-semibold"
              onClick={handleSave}
              disabled={saving}
            >
              {editing ? "Сохранить" : "Записать"}
            </Button>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
