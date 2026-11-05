// Демо-данные — копия примера из исходной таблицы «Пример заполнения — 2024»
import type { Client, Operation } from "./types";

export function demoClients(): Client[] {
  const t = new Date().toISOString();
  return [
    { id: "cl-ivan", name: "Иван", contact: "79001223309", createdAt: t },
    { id: "cl-anna", name: "Анна", contact: "@username2", createdAt: t },
    { id: "cl-petr", name: "Пётр", contact: "телеграм @petruha", createdAt: t },
    { id: "cl-elena", name: "Елена", contact: "79000000000", createdAt: t },
    { id: "cl-olga", name: "Ольга", contact: "7912345678", createdAt: t },
  ];
}

export function demoOperations(): Operation[] {
  const t = new Date().toISOString();
  const Y = new Date().getFullYear();
  const iso = (m: number, d: number) =>
    `${Y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const mk = (
    id: string,
    date: string,
    amount: number,
    kind: "income" | "expense",
    extra: Partial<Operation> = {}
  ): Operation => ({
    id,
    date,
    amount,
    kind,
    part: "single",
    createdAt: t,
    updatedAt: t,
    ...extra,
  });

  return [
    mk("op-1", iso(1, 1), 5000, "income", {
      type: "Таплинк",
      source: "Рекомендация",
      clientId: "cl-ivan",
      clientName: "Иван",
      note: "предоплата @username1",
      part: "prepay",
      dealId: "deal-demo-ivan",
      dealTotal: 10000,
    }),
    mk("op-2", iso(1, 2), 700, "income", { type: "Партнёрка" }),
    mk("op-3", iso(2, 4), 3000, "income", {
      type: "Консультация",
      source: "Инста",
      clientId: "cl-anna",
      clientName: "Анна",
      note: "перевела на Киви",
    }),
    mk("op-4", iso(2, 12), 5000, "income", {
      type: "Таплинк",
      source: "Рекомендация",
      clientId: "cl-ivan",
      clientName: "Иван",
      note: "остаток @username1",
      part: "rest",
      dealId: "deal-demo-ivan",
      dealTotal: 10000,
    }),
    mk("op-5", iso(2, 13), 300, "expense", { type: "Обслуживание", note: "Оплата за обслуживание карты" }),
    mk("op-6", iso(3, 10), 4000, "income", {
      type: "Консультация",
      source: "Яндекс",
      clientId: "cl-petr",
      clientName: "Пётр",
      note: "Помощь в настройке платежей — бонус 1000р",
    }),
    mk("op-7", iso(3, 19), 23, "expense", { type: "Комиссии", note: "комиссия при выводе с Яндекса" }),
    mk("op-8", iso(4, 9), 500, "income", {
      type: "Таплинк",
      clientId: "cl-elena",
      clientName: "Елена",
      note: "правки @username3",
    }),
    mk("op-9", iso(4, 22), 50, "expense", { type: "Прочее", note: "карандаш — Ашан" }),
    mk("op-10", iso(5, 12), 15000, "income", {
      type: "Дизайн баннера",
      source: "Таргет",
      clientId: "cl-olga",
      clientName: "Ольга",
      note: "предоплата за новогодний баннер",
      part: "prepay",
      dealId: "deal-demo-olga",
      dealTotal: 30000,
    }),
    mk("op-11", iso(5, 14), 500, "expense", { type: "Таргет", note: "затраты на таргет" }),
    mk("op-12", iso(5, 15), 15000, "income", {
      type: "Дизайн баннера",
      source: "Таргет",
      clientId: "cl-olga",
      clientName: "Ольга",
      note: "ост. за новогодний баннер",
      part: "rest",
      dealId: "deal-demo-olga",
      dealTotal: 30000,
    }),
  ];
}
